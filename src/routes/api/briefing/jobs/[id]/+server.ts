import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createBriefingRunner } from '$lib/server/briefing/runner';
import { _processJob, _publicJob } from '../+server';

export async function GET({ params, platform }: RequestEvent) {
	if (!platform) return json({ job: null }, { status: 500 });

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const job = await runner.getJob(params.id);
	if (!job) return json({ job: null }, { status: 404 });

	let output = null;
	if (job.status === 'complete' && job.output) {
		try {
			output = JSON.parse(job.output);
		} catch {
			output = null;
		}
	}

	// Polling a queued job acts as a conservative processing nudge; the atomic
	// status transition ensures only one worker can claim it.
	if (job.status === 'queued' && typeof platform.ctx?.waitUntil === 'function') {
		platform.ctx.waitUntil(_processJob(platform.env.BRIEF_DB, job.id));
	}
	const latest = (await runner.getJob(job.id)) ?? job;
	return json({
		job: _publicJob(latest),
		output
	});
}

export async function DELETE({ params, platform }: RequestEvent) {
	if (!platform) return json({ error: 'PROVIDER_UNAVAILABLE' }, { status: 500 });
	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const job = await runner.getJob(params.id);
	if (!job) return json({ error: 'NOT_FOUND' }, { status: 404 });
	await runner.cancelJob(params.id);
	return json({ job: await runner.getJob(params.id) });
}
