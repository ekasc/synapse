import { json } from '@sveltejs/kit';
import { createWeeklyPushRepository } from '$lib/server/push/subscriptions';

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
	const endpoint = (payload as { endpoint?: unknown })?.endpoint;
	if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) {
		return json({ error: 'endpoint is required' }, { status: 400 });
	}
	await createWeeklyPushRepository(binding).removeByEndpoint(endpoint);
	return json({ ok: true });
}
