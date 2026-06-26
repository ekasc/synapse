import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createBriefingRunner } from '$lib/server/briefing/runner';

export async function GET({ platform }: RequestEvent) {
	if (!platform) return json({ jobs: [] });

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const jobs = await runner.getAllJobs();
	return json({ jobs });
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });

	let body: { action?: string; jobId?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (body.action === 'cancel' && typeof body.jobId === 'string' && body.jobId.length > 0) {
		const runner = createBriefingRunner(platform.env.BRIEF_DB);
		await runner.cancelJob(body.jobId);
		return json({ ok: true });
	}

	return json({ error: 'Invalid action or missing jobId' }, { status: 400 });
}
