import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createBriefingRunner } from '$lib/server/briefing/runner';

export async function GET({ params, platform }: RequestEvent) {
	if (!platform) return json({ job: null }, { status: 500 });

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const job = await runner.getJob(params.id);
	if (!job) return json({ job: null }, { status: 404 });

	let output = null;
	if (job.status === 'succeeded' && job.output) {
		try {
			output = JSON.parse(job.output);
		} catch {}
	}

	return json({ job, output });
}
