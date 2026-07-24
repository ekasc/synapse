import { json } from '@sveltejs/kit';
import { getOrAssembleWeeklyDigest, updateDigestCacheProse } from '$lib/server/weekly-digest-data';
import { composeWeeklyProse } from '$lib/server/weekly-prose';
import { createWeeklyPushRepository } from '$lib/server/push/subscriptions';
import { deliverWeeklyDigestPush } from '$lib/server/push/deliver';

// Invoked by the Worker's Sunday scheduled handler with the shared trigger
// secret. Populates this week's cache exactly once, then delivers that same
// plan to every Web Push subscription and prunes expired endpoints.
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

	const bundle = await getOrAssembleWeeklyDigest({
		now: new Date(),
		binding,
		bucket: event.platform?.env?.MATERIALS as R2Bucket | undefined
	});
	let prose = bundle.cachedProse ?? null;
	if (!bundle.cached) {
		try {
			const result = await composeWeeklyProse(bundle.digest);
			prose = result?.prose ?? null;
			await updateDigestCacheProse({
				weekStart: bundle.weekStart,
				binding,
				prose,
				proseModel: result?.model ?? null
			});
		} catch {
			prose = null;
			await updateDigestCacheProse({
				weekStart: bundle.weekStart,
				binding,
				prose: null,
				proseModel: null
			});
		}
	}

	const vapid = {
		subject: env?.VAPID_SUBJECT ?? '',
		privateKey: env?.VAPID_PRIVATE_KEY ?? '',
		publicKey: env?.VAPID_PUBLIC_KEY ?? ''
	};
	if (!vapid.privateKey || !vapid.publicKey || !vapid.subject) {
		return json({
			weekStart: bundle.digest.weekStart,
			weekEnd: bundle.digest.weekEnd,
			cached: bundle.cached,
			skipped: 'vapid keys are not configured'
		});
	}

	const repository = createWeeklyPushRepository(binding);
	const subscriptions = await repository.list();
	const summary = await deliverWeeklyDigestPush({
		digest: bundle.digest,
		prose,
		subscriptions: subscriptions.map((subscription) => ({
			endpoint: subscription.endpoint,
			p256dh: subscription.p256dh,
			auth: subscription.auth
		})),
		vapid,
		nowSeconds: Math.floor(Date.now() / 1000)
	});
	for (const endpoint of summary.prunedEndpoints) {
		await repository.removeByEndpoint(endpoint);
	}
	return json({
		weekStart: bundle.digest.weekStart,
		weekEnd: bundle.digest.weekEnd,
		cached: bundle.cached,
		degraded: bundle.degraded,
		attempted: summary.attempted,
		delivered: summary.delivered,
		failed: summary.failed,
		pruned: summary.prunedEndpoints.length
	});
}
