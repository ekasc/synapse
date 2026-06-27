import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createBriefingRunner, isReusableBriefingJob } from '$lib/server/briefing/runner';
import {
	extractBriefingJson,
	validateBriefing,
	ValidationError
} from '$lib/server/briefing/validation';
import {
	COURSE_BRIEFING_SYSTEM_PROMPT,
	COURSE_BRIEFING_WEB_TOOL,
	buildCourseBriefingUserPrompt
} from '$lib/server/briefing/prompt';
import { createDb } from '$lib/server/db/d1';
import { env } from '$env/dynamic/private';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type JobFrozen = { courseCode: string; professorName?: string | null; institution?: string | null };

async function saveAndCompleteJob(
	binding: D1Database,
	jobId: string,
	cacheKey: string,
	outputText: string,
	shouldCache: boolean
) {
	const parsed = JSON.parse(outputText);
	const briefing = validateBriefing(parsed);
	const serialized = JSON.stringify(briefing);
	const db = createDb(binding);
	const runner = createBriefingRunner(binding);

	await db.saveBrief(briefing);
	if (shouldCache) await runner.setCachedOutput(cacheKey, serialized);
	await runner.completeJob(jobId, serialized);
}

async function processJob(binding: D1Database, jobId: string, courseCode: string) {
	const runner = createBriefingRunner(binding);
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		await runner.failJob(jobId, 'NO_API_KEY', 'OpenRouter API key not configured');
		return;
	}

	try {
		const job = await runner.startJob(jobId);
		if (!job) return;

		const jobFrozen: JobFrozen = JSON.parse(job.frozenContext);

		const cached = await runner.getCachedOutput(job.cacheKey);
		if (cached) {
			const latest = await runner.getJob(jobId);
			if (latest?.status !== 'running') return;
			await saveAndCompleteJob(binding, jobId, job.cacheKey, cached, false);
			return;
		}

		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://synapse.app',
				'X-Title': 'Synapse Course Brief'
			},
			body: JSON.stringify({
				model: env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash',
				tools: [COURSE_BRIEFING_WEB_TOOL],
				messages: [
					{ role: 'system', content: COURSE_BRIEFING_SYSTEM_PROMPT },
					{
						role: 'user',
						content: buildCourseBriefingUserPrompt({
							courseCode,
							professorName: jobFrozen.professorName,
							institution: jobFrozen.institution
						})
					}
				],
				temperature: 0.1,
				max_tokens: 3000
			})
		});

		if (!response.ok) {
			console.error(`OpenRouter error: status ${response.status}`);
			await response.text().catch(() => undefined);
			await runner.failJob(jobId, 'LLM_ERROR', `OpenRouter returned ${response.status}`);
			return;
		}
		const data = (await response.json()) as {
			choices?: { message?: { content?: string; reasoning?: string } }[];
		};
		const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning;
		if (!text) {
			await runner.failJob(jobId, 'EMPTY_RESPONSE', 'LLM returned empty response');
			return;
		}
		const latest = await runner.getJob(jobId);
		if (latest?.status !== 'running') return;
		await saveAndCompleteJob(binding, jobId, job.cacheKey, extractBriefingJson(text), true);
	} catch (err) {
		console.error('Job processing failed:', err instanceof Error ? err.message : err);
		if (err instanceof ValidationError || err instanceof SyntaxError) {
			await runner.failJob(jobId, 'VALIDATION_FAILED', err.message);
			return;
		}
		await runner.failJob(jobId, 'PROCESSING_ERROR', String(err));
	}
}

export async function GET({ url, platform }: RequestEvent) {
	if (!platform) return json({ jobs: [] });
	const courseCode = url.searchParams.get('courseCode');
	if (!courseCode) return json({ jobs: [] });

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const jobs = await runner.getJobs(courseCode);
	return json({ jobs });
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) {
		return json({ error: 'Platform not available' }, { status: 500 });
	}

	const body = (await request.json()) as {
		courseCode: string;
		professorName?: string;
		institution?: string;
	};
	const courseCode = body.courseCode?.trim().toUpperCase();
	if (!courseCode) {
		return json({ error: 'Course code required' }, { status: 400 });
	}

	const professorName = body.professorName?.trim() || undefined;
	const institution = body.institution?.trim() || undefined;

	const runner = createBriefingRunner(platform.env.BRIEF_DB);

	const jobs = await runner.getJobs(courseCode);
	// If there's an active job, poll that instead of creating a new one
	const activeJob = jobs.find((job) => isReusableBriefingJob(job));
	if (activeJob) return json({ job: activeJob });

	const job = await runner.createJob({ courseCode, professorName, institution });

	// Fire job processing — in production, waitUntil keeps the Worker alive.
	// In dev (pnpm dev), unawaited promises still complete because Node.js stays alive.
	const promise = processJob(platform.env.BRIEF_DB, job.id, courseCode);
	if (typeof platform.ctx?.waitUntil === 'function') {
		platform.ctx.waitUntil(promise);
	}

	return json({ job });
}
