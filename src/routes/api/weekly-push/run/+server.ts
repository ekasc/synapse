import { json } from '@sveltejs/kit';
import { getOrAssembleWeeklyDigest, updateDigestCacheProse } from '$lib/server/weekly-digest-data';
import { composeWeeklyProse } from '$lib/server/weekly-prose';
import { createWeeklyPushRepository } from '$lib/server/push/subscriptions';
import { deliverWeeklyDigestPush } from '$lib/server/push/deliver';

// Invoked by the Worker's Sunday scheduled handler with the shared trigger
// secret. Populates each subscriber's weekly cache, then delivers that user's
// own plan to every Web Push subscription and prunes expired endpoints.
export async function POST(event) {
	const env = event.platform?.env as Record<string, string> | undefined;
	const secret = env?.WEEKLY_PUSH_SECRET ?? '';
	const provided = event.request.headers.get('x-push-secret') ?? '';
	if (!secret || provided !== secret) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	if (!binding) {
		return json({ error: 'database unavailable' }, { status: 503 });
	}

	const vapid = {
		subject: env?.VAPID_SUBJECT ?? '',
		privateKey: env?.VAPID_PRIVATE_KEY ?? '',
		publicKey: env?.VAPID_PUBLIC_KEY ?? ''
	};
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	const now = new Date();

	const repository = createWeeklyPushRepository(binding);
	const subscriptions = await repository.list();

	// Per-user: each subscriber gets their own digest from their own data.
	const byUser = new Map<string, typeof subscriptions>();
	for (const subscription of subscriptions) {
		const list = byUser.get(subscription.userId) ?? [];
		list.push(subscription);
		byUser.set(subscription.userId, list);
	}

	const totals = { attempted: 0, delivered: 0, failed: 0 };
	const prunedEndpoints: string[] = [];
	let weekStart = '';
	let weekEnd = '';
	let cached = true;
	const degraded: string[] = [];

	if (byUser.size === 0) {
		return json({
			weekStart,
			weekEnd,
			cached,
			degraded,
			attempted: 0,
			delivered: 0,
			failed: 0,
			pruned: 0
		});
	}

	for (const [userId, userSubscriptions] of byUser) {
		const bundle = await getOrAssembleWeeklyDigest({ userId, now, binding, bucket });
		weekStart = bundle.digest.weekStart;
		weekEnd = bundle.digest.weekEnd;
		cached = bundle.cached;
		degraded.push(...bundle.degraded);

		let prose = bundle.cachedProse ?? null;
		if (!bundle.cached) {
			try {
				const result = await composeWeeklyProse(bundle.digest);
				prose = result?.prose ?? null;
				await updateDigestCacheProse({
					userId,
					weekStart: bundle.weekStart,
					binding,
					prose,
					proseModel: result?.model ?? null
				});
			} catch {
				prose = null;
				await updateDigestCacheProse({
					userId,
					weekStart: bundle.weekStart,
					binding,
					prose: null,
					proseModel: null
				});
			}
		}

		if (!vapid.privateKey || !vapid.publicKey || !vapid.subject) {
			continue;
		}

		const summary = await deliverWeeklyDigestPush({
			digest: bundle.digest,
			prose,
			subscriptions: userSubscriptions.map((subscription) => ({
				endpoint: subscription.endpoint,
				p256dh: subscription.p256dh,
				auth: subscription.auth
			})),
			vapid,
			nowSeconds: Math.floor(now.getTime() / 1000)
		});
		totals.attempted += summary.attempted;
		totals.delivered += summary.delivered;
		totals.failed += summary.failed;
		prunedEndpoints.push(...summary.prunedEndpoints);
	}

	const ownerByEndpoint = new Map(subscriptions.map((s) => [s.endpoint, s.userId]));
	for (const endpoint of prunedEndpoints) {
		const ownerId = ownerByEndpoint.get(endpoint);
		if (ownerId) await repository.removeByEndpoint(ownerId, endpoint);
	}
	return json({
		weekStart,
		weekEnd,
		cached,
		degraded: [...new Set(degraded)],
		attempted: totals.attempted,
		delivered: totals.delivered,
		failed: totals.failed,
		pruned: prunedEndpoints.length
	});
}
