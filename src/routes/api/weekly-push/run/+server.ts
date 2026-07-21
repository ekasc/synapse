import { json } from '@sveltejs/kit';
import { assembleWeeklyDigest } from '$lib/server/weekly-digest-data';
import { composeWeeklyProse } from '$lib/server/weekly-prose';
import { createWeeklyPushRepository } from '$lib/server/push/subscriptions';
import { deliverWeeklyDigestPush } from '$lib/server/push/deliver';

// Invoked by the Worker's scheduled handler (cron) with the shared trigger
// secret. Runs the same deterministic digest the page shows and pushes it to
// every Web Push subscription, pruning expired endpoints.
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
	if (!vapid.privateKey || !vapid.publicKey || !vapid.subject) {
		return json({ skipped: 'vapid keys are not configured' }, { status: 200 });
	}
	const bundle = await assembleWeeklyDigest({
		now: new Date(),
		binding,
		bucket: event.platform?.env?.MATERIALS as R2Bucket | undefined
	});
	let prose: string | null;
	try {
		prose = (await composeWeeklyProse(bundle.digest))?.prose ?? null;
	} catch {
		prose = null;
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
		degraded: bundle.degraded,
		attempted: summary.attempted,
		delivered: summary.delivered,
		failed: summary.failed,
		pruned: summary.prunedEndpoints.length
	});
}
