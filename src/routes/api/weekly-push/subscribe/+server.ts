import { json } from '@sveltejs/kit';
import { createWeeklyPushRepository } from '$lib/server/push/subscriptions';

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= 2048;
}

export async function POST(event) {
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	if (!binding) {
		return json({ error: 'database unavailable' }, { status: 503 });
	}
	let payload: unknown;
	try {
		payload = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}
	const record = (payload ?? {}) as {
		endpoint?: unknown;
		keys?: { p256dh?: unknown; auth?: unknown };
	};
	const endpoint = record.endpoint;
	const p256dh = record.keys?.p256dh;
	const auth = record.keys?.auth;
	if (!isNonEmptyString(endpoint) || !isNonEmptyString(p256dh) || !isNonEmptyString(auth)) {
		return json({ error: 'endpoint, keys.p256dh, and keys.auth are required' }, { status: 400 });
	}
	const subscription = await createWeeklyPushRepository(binding).upsert({
		endpoint,
		p256dh,
		auth
	});
	return json({ ok: true, id: subscription.id });
}
