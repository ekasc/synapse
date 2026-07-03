import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	createBriefingRunner,
	frozenContextMatchesRequest,
	isReusableBriefingJob,
	parseFrozenContext,
	type CreateBriefingJobParams
} from '$lib/server/briefing/runner';
import { ValidationError, parseCachedBriefing } from '$lib/server/briefing/validation';
import { researchBriefing } from '$lib/server/briefing/request';
import type { Briefing } from '$lib/server/briefing/schema';
import {
	COURSE_BRIEFING_SYSTEM_PROMPT,
	buildCourseBriefingUserPrompt
} from '$lib/server/briefing/prompt';
import { createDb } from '$lib/server/db/d1';
import { env } from '$env/dynamic/private';

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

type BriefingPostBody = {
	courseCode: string;
	courseName?: string;
	professorName?: string;
	institution?: string;
	additionalNotes?: string;
	model?: string;
};

function normalizeOptional(value: unknown, maxLength = 500): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function resolveModel(model: string | undefined): string {
	const envModel = env.OPENROUTER_MODEL?.trim();
	return model?.trim() || envModel || DEFAULT_MODEL;
}

async function saveAndCompleteJob(
	binding: D1Database,
	jobId: string,
	cacheKey: string,
	briefing: Briefing,
	shouldCache: boolean
) {
	const db = createDb(binding);
	const runner = createBriefingRunner(binding);
	const serialized = JSON.stringify(briefing);
	await db.saveBrief(briefing);
	if (shouldCache) await runner.setCachedOutput(cacheKey, serialized, briefing.modelUsed);
	await runner.completeJob(jobId, serialized);
}

async function processJob(binding: D1Database, jobId: string) {
	const runner = createBriefingRunner(binding);
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		await runner.failJob(jobId, 'NO_API_KEY', 'OpenRouter API key not configured');
		return;
	}

	try {
		const job = await runner.startJob(jobId);
		if (!job) return;

		const frozen = parseFrozenContext(job.frozenContext);
		if (!frozen) {
			await runner.failJob(jobId, 'INVALID_CONTEXT', 'Job context is not valid JSON');
			return;
		}

		const cached = await runner.getCachedOutput(job.cacheKey);
		if (cached) {
			const latest = await runner.getJob(jobId);
			if (latest?.status !== 'running') return;
			const briefing = parseCachedBriefing(cached);
			await saveAndCompleteJob(binding, jobId, job.cacheKey, briefing, false);
			return;
		}

		const messages = [
			{ role: 'system' as const, content: COURSE_BRIEFING_SYSTEM_PROMPT },
			{
				role: 'user' as const,
				content: buildCourseBriefingUserPrompt({
					courseCode: frozen.courseCode,
					courseName: frozen.courseName ?? undefined,
					professorName: frozen.professorName ?? undefined,
					institution: frozen.institution ?? undefined,
					additionalNotes: frozen.additionalNotes ?? undefined
				})
			}
		];

		const result = await researchBriefing({
			apiKey,
			model: frozen.model,
			messages
		});

		const latest = await runner.getJob(jobId);
		if (latest?.status !== 'running') return;
		await saveAndCompleteJob(binding, jobId, job.cacheKey, result.briefing, true);
	} catch (err) {
		console.error('Job processing failed:', err instanceof Error ? err.message : err);
		if (err instanceof ValidationError) {
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

	const body = (await request.json()) as BriefingPostBody;
	const courseCode = body.courseCode?.trim().toUpperCase();
	if (!courseCode) {
		return json({ error: 'Course code required' }, { status: 400 });
	}

	const params: CreateBriefingJobParams = {
		courseCode,
		courseName: normalizeOptional(body.courseName),
		professorName: normalizeOptional(body.professorName),
		institution: normalizeOptional(body.institution),
		additionalNotes: normalizeOptional(body.additionalNotes, 1200),
		model: resolveModel(body.model)
	};

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const jobs = await runner.getJobs(courseCode);
	const activeJob = jobs.find((job) => {
		if (!isReusableBriefingJob(job)) return false;
		const frozen = parseFrozenContext(job.frozenContext);
		return frozen ? frozenContextMatchesRequest(frozen, params) : false;
	});
	if (activeJob) return json({ job: activeJob });

	const job = await runner.createJob(params);

	const promise = processJob(platform.env.BRIEF_DB, job.id);
	if (typeof platform.ctx?.waitUntil === 'function') {
		platform.ctx.waitUntil(promise);
	}

	return json({ job });
}
