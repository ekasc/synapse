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

	if (typeof body.jobId !== 'string' || body.jobId.length === 0) {
		return json({ error: 'Invalid action or missing jobId' }, { status: 400 });
	}

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	if (body.action === 'cancel') {
		await runner.cancelJob(body.jobId);
		return json({ ok: true });
	}
	if (body.action === 'delete') {
		const deleted = await runner.deleteJob(body.jobId);
		return deleted ? json({ ok: true }) : json({ error: 'Job not found' }, { status: 404 });
	}

	return json({ error: 'Invalid action or missing jobId' }, { status: 400 });
}
