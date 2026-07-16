import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	buildSearchContext,
	createBriefingRunner,
	frozenContextMatchesRequest,
	isReusableBriefingJob,
	parseFrozenContext,
	type CreateBriefingJobParams
} from '$lib/server/briefing/runner';
import {
	ValidationError,
	parseCachedBriefing,
	validateCachedBriefingIdentity
} from '$lib/server/briefing/validation';
import { PipelineError, runEvidenceFirstPipeline } from '$lib/server/briefing/pipeline';
import { runResearchRun } from '$lib/server/briefing/research-run';
import { createOpenRouterResearchModelClient } from '$lib/server/briefing/research-model-client';
import {
	createOpenRouterSearchAdapter,
	createOpenRouterSearchTransport
} from '$lib/server/briefing/search-provider';
import { admitCandidateBriefing } from '$lib/server/briefing/candidate-admission';
import { env } from '$env/dynamic/private';
import { normalizeBriefingRequest, BriefingRequestError } from '$lib/server/briefing/normalize';
import { rejectClientModelFields, resolveResearchModelPolicy } from '$lib/server/briefing/policy';

type BriefingPostBody = {
	courseCode: string;
	courseName?: string;
	professorName?: string;
	institution?: string;
	additionalNotes?: string;
	refresh?: boolean;
};

function modelPolicy() {
	return resolveResearchModelPolicy(env);
}

function researchStrategy(): 'evidence-first' | 'agentic' {
	return 'evidence-first';
}

function publicJob(job: Awaited<ReturnType<ReturnType<typeof createBriefingRunner>['getJob']>>) {
	if (!job) return null;
	const status =
		job.status === 'complete'
			? 'succeeded'
			: job.status === 'cancelled'
				? 'canceled'
				: job.status === 'conflict' || job.status === 'awaiting_identity_choice'
					? 'conflict'
					: job.status === 'queued' || job.status === 'failed'
						? job.status
						: 'running';
	return {
		...job,
		status,
		stage: job.status,
		conflictSources: job.status === 'conflict' ? job.identityCandidates : undefined,
		cacheHit: job.cacheHit
	};
}

export async function _processJob(binding: D1Database, jobId: string) {
	const runner = createBriefingRunner(binding);
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		await runner.failJob(jobId, 'NO_API_KEY', 'OpenRouter API key not configured');
		return;
	}

	let leaseToken: string | undefined;
	try {
		const job = await runner.startJob(jobId);
		if (!job) return;
		leaseToken = job.leaseToken ?? undefined;
		if (!leaseToken) throw new Error('LEASE_NOT_ACQUIRED');

		const frozen = parseFrozenContext(job.frozenContext);
		if (!frozen) {
			await runner.failJob(jobId, 'INVALID_CONTEXT', 'Job context is not valid JSON');
			return;
		}

		const searchParams: CreateBriefingJobParams = {
			courseCode: frozen.courseCode,
			courseName: frozen.courseName ?? undefined,
			professorName: frozen.professorName ?? undefined,
			institution: frozen.institution ?? undefined,
			additionalNotes: frozen.additionalNotes ?? undefined,
			identityChoice: frozen.identityChoice ?? undefined,
			activeTerm: frozen.activeTerm ?? undefined,
			model: JSON.stringify(modelPolicy())
		};
		const searchContext = buildSearchContext(searchParams);
		const searchHash = await crypto.subtle
			.digest('SHA-256', new TextEncoder().encode(searchContext))
			.then((buf) =>
				Array.from(new Uint8Array(buf))
					.map((b) => b.toString(16).padStart(2, '0'))
					.join('')
			);

		// Evidence-first briefings are built deterministically from cached evidence;
		// skipping final output cache avoids identity-drift across extraction improvements.
		if (researchStrategy() === 'agentic') {
			const cached = frozen.forceRefresh ? null : await runner.getCachedOutput(job.cacheKey);
			if (cached) {
				const latest = await runner.getJob(jobId);
				if (!latest || ['cancelled', 'failed', 'complete'].includes(latest.status)) return;
				const briefing = parseCachedBriefing(cached);
				validateCachedBriefingIdentity(briefing, {
					courseCode: frozen.courseCode,
					courseName: frozen.courseName ?? undefined,
					institution: frozen.institution ?? undefined,
					activeTerm: frozen.activeTerm ?? undefined
				});
				await runner.updateStage(jobId, leaseToken, 'publishing');
				await runner.publishJob(
					jobId,
					leaseToken,
					job.cacheKey,
					JSON.stringify(briefing),
					briefing.modelUsed,
					true
				);
				return;
			}
		}
		if (researchStrategy() === 'agentic') {
			const result = await runResearchRun(
				{
					jobId,
					userId: job.clientIpHash ?? 'anonymous',
					briefingRequest: {
						courseCode: frozen.courseCode,
						courseName: frozen.courseName ?? undefined,
						professorName: frozen.professorName ?? undefined,
						institution: frozen.institution ?? undefined,
						additionalNotes: frozen.additionalNotes ?? undefined,
						identityChoice: frozen.identityChoice ?? undefined,
						activeTerm: frozen.activeTerm ?? undefined
					},
					isCancelled: async () => (await runner.getJob(jobId))?.status === 'cancelled'
				},
				{
					model: createOpenRouterResearchModelClient({ apiKey, policy: modelPolicy() }),
					search: async ({ query, category, signal }) => {
						const result = await createOpenRouterSearchAdapter(
							createOpenRouterSearchTransport(apiKey)
						)({
							request: frozen,
							category: category ?? 'catalog',
							query,
							policy: modelPolicy(),
							signal
						});
						for (const source of result.sources) await runner.persistEvidence(jobId, source);
						return result.sources;
					}
				}
			);
			if (result.status !== 'completed') {
				if (result.status === 'cancelled') return;
				await runner.failJob(
					jobId,
					result.status === 'failed' ? result.errorCode : `AGENTIC_${result.status.toUpperCase()}`,
					result.status === 'failed'
						? result.safeMessage
						: 'Agentic research could not produce an admissible candidate.',
					leaseToken
				);
				return;
			}
			const admission = admitCandidateBriefing(
				result.candidate,
				{
					courseCode: frozen.courseCode,
					courseName: frozen.courseName ?? undefined,
					professorName: frozen.professorName ?? undefined,
					institution: frozen.institution ?? undefined,
					activeTerm: frozen.activeTerm ?? undefined
				},
				{
					researchedAt: new Date().toISOString(),
					modelUsed: result.candidate.modelUsed,
					searchModel: result.candidate.searchModel,
					synthesisModel: result.candidate.synthesisModel,
					usage: result.candidate.usage
				}
			);
			if (admission.status === 'conflict') {
				await runner.setIdentityCandidates(
					jobId,
					leaseToken,
					admission.admission.course.candidates.map((candidate) => ({
						code: frozen.courseCode,
						name: candidate.title,
						institution: frozen.institution ?? '',
						officialDomain: new URL(candidate.url).hostname,
						sourceLabel: 'Official catalog',
						url: candidate.url,
						sourceId: candidate.sourceId
					}))
				);
				await runner.conflictJob(
					jobId,
					leaseToken,
					'IDENTITY_CONFLICT',
					'Course identity evidence conflicted and could not be resolved automatically.'
				);
				return;
			}
			if (admission.status === 'rejected') {
				await runner.persistAttempt(jobId, {
					stage: 'agentic-admission',
					attempt: 1,
					responseId: null,
					requestedModel: modelPolicy().synthesis,
					actualModel: null,
					provider: null,
					query: null,
					responseJson: admission.detail
						? JSON.stringify({ validationError: admission.detail })
						: null,
					usage: {},
					elapsedMs: 0,
					status: 422,
					retry: false
				});
				await runner.failJob(jobId, admission.code, admission.safeMessage, leaseToken);
				return;
			}
			const latest = await runner.getJob(jobId);
			if (!latest || ['cancelled', 'failed', 'complete'].includes(latest.status)) return;
			await runner.updateStage(jobId, leaseToken, 'publishing');
			await runner.publishJob(
				jobId,
				leaseToken,
				job.cacheKey,
				JSON.stringify(admission.briefing),
				admission.briefing.modelUsed
			);
			return;
		}
		const result = await runEvidenceFirstPipeline(
			{
				courseCode: frozen.courseCode,
				courseName: frozen.courseName ?? undefined,
				professorName: frozen.professorName ?? undefined,
				institution: frozen.institution ?? undefined,
				additionalNotes: frozen.additionalNotes ?? undefined,
				identityChoice: frozen.identityChoice ?? undefined,
				activeTerm: frozen.activeTerm ?? undefined
			},
			{
				apiKey,
				modelPolicy: modelPolicy(),
				costCeilingMicrodollars: Math.round(
					Math.min(0.1, Math.max(0, Number(env.COURSE_RESEARCH_MAX_ESTIMATED_COST_USD ?? 0.1))) *
						1_000_000
				),
				hooks: {
					onStage: (stage) =>
						runner.updateStage(
							jobId,
							leaseToken!,
							stage as Parameters<typeof runner.updateStage>[2]
						),
					onAttempt: (attempt) => runner.persistAttempt(jobId, attempt),
					onEvidence: async (_category, sources) => {
						for (const source of sources) await runner.persistEvidence(jobId, source);
					},
					onIdentityCandidates: (candidates) =>
						runner.setIdentityCandidates(jobId, leaseToken!, candidates)
				},
				isCancelled: async () => (await runner.getJob(jobId))?.status === 'cancelled',
				forceRefresh: frozen.forceRefresh,
				categoryCache: {
					get: async (category) => {
						const value = await runner.getCategoryEvidence(searchHash, category);
						if (value) return JSON.parse(value);
						// Compatibility: check old cache keys (which included synthesis provider)
						const legacyValue = await runner.getCategoryEvidence(job.contextHash, category);
						if (legacyValue) {
							const parsed = JSON.parse(legacyValue);
							// Re-key valid evidence under corrected search hash
							const sourceRecords = Array.isArray(parsed) ? parsed : [];
							if (sourceRecords.length > 0) {
								const ttlMs = 24 * 60 * 60 * 1000;
								await runner.setCategoryEvidence(searchHash, category, legacyValue, ttlMs);
							}
							return parsed;
						}
						return null;
					},
					set: (category, sources, ttlMs) =>
						runner.setCategoryEvidence(searchHash, category, JSON.stringify(sources), ttlMs)
				}
			}
		);

		const SUPPORTED_FIELD_LABELS = [
			{ key: 'description', label: 'description' },
			{ key: 'credits', label: 'credits' },
			{ key: 'prerequisites', label: 'prereqs' },
			{ key: 'corequisites', label: 'corequisites' },
			{ key: 'delivery', label: 'delivery' },
			{ key: 'assessments', label: 'assessments' }
		] as const;
		const supportedFieldValues: Record<string, string> = {
			description: result.briefing.description.text,
			credits: result.briefing.credits.text,
			prerequisites: result.briefing.prerequisites.text,
			corequisites: result.briefing.corequisites.text,
			delivery: result.briefing.delivery.text,
			assessments: result.briefing.assessments.text
		};
		const supportedFields = SUPPORTED_FIELD_LABELS.filter(
			({ key }) => supportedFieldValues[key]?.trim()
		).length;
		if (result.briefing.modelUsed === 'synthesis-unavailable' || supportedFields === 0) {
			const missing =
				result.briefing.modelUsed === 'synthesis-unavailable'
					? 'all core fields'
					: SUPPORTED_FIELD_LABELS.filter(
							({ key }) => !supportedFieldValues[key]?.trim()
						)
							.map((f) => f.label)
							.join(', ');
			const suggestion = result.briefing.modelUsed === 'synthesis-unavailable'
				? 'Try again, or refine the search with a professor name or institution.'
				: `Missing: ${missing}. Try adding a professor name or institution to narrow the search.`;
			await runner.failJob(
				jobId,
				'INSUFFICIENT_EVIDENCE',
				`Research did not produce supported course details. ${suggestion} Your existing briefing was kept unchanged.`,
				leaseToken
			);
			return;
		}
		const latest = await runner.getJob(jobId);
		if (!latest || ['cancelled', 'failed', 'complete'].includes(latest.status)) return;
		await runner.updateStage(jobId, leaseToken, 'publishing');
		await runner.publishJob(
			jobId,
			leaseToken,
			job.cacheKey,
			JSON.stringify(result.briefing),
			result.briefing.modelUsed
		);
	} catch (err) {
		console.error('Job processing failed:', err instanceof Error ? err.message : err);
		if (err instanceof ValidationError) {
			await runner.failJob(
				jobId,
				'VALIDATION_FAILED',
				'The generated briefing did not pass validation.',
				leaseToken
			);
			return;
		}
		if (err instanceof PipelineError) {
			if (err.code === 'AMBIGUOUS_COURSE' && leaseToken) {
				await runner.conflictJob(
					jobId,
					leaseToken,
					'IDENTITY_CONFLICT',
					'Course identity evidence conflicted and could not be resolved automatically.'
				);
				return;
			}
			const code =
				err.code === 'AMBIGUOUS_COURSE'
					? 'AMBIGUOUS_COURSE'
					: err.code === 'NOT_FOUND'
						? 'COURSE_NOT_FOUND'
						: err.code === 'COST_BUDGET_EXCEEDED'
							? 'BUDGET_EXCEEDED'
							: err.code === 'INVALID_MODEL_OUTPUT'
								? 'VALIDATION_FAILED'
								: 'PROVIDER_UNAVAILABLE';
			await runner.failJob(jobId, code, 'Course research could not be completed.', leaseToken);
			return;
		}
		await runner.failJob(
			jobId,
			'PROVIDER_UNAVAILABLE',
			'Course research is temporarily unavailable.',
			leaseToken
		);
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

	let body: BriefingPostBody;
	try {
		body = (await request.json()) as BriefingPostBody;
		rejectClientModelFields(body as Record<string, unknown>);
	} catch (error) {
		const code =
			error instanceof Error && error.message === 'MODEL_SELECTION_NOT_ALLOWED'
				? 'MODEL_SELECTION_NOT_ALLOWED'
				: 'INVALID_REQUEST';
		return json({ error: code }, { status: 400 });
	}
	let normalized;
	try {
		normalized = normalizeBriefingRequest(body);
	} catch (error) {
		return json(
			{ error: error instanceof BriefingRequestError ? error.code : 'INVALID_REQUEST' },
			{ status: 400 }
		);
	}

	const params: CreateBriefingJobParams = {
		...normalized,
		model: JSON.stringify(modelPolicy()),
		forceRefresh: body.refresh === true
	};
	const activeSemester = await platform.env.BRIEF_DB.prepare(
		`SELECT term, year FROM semesters ORDER BY "order" ASC LIMIT 1`
	).first<{ term: string; year: number }>();
	params.activeTerm = activeSemester ? `${activeSemester.term} ${activeSemester.year}` : undefined;

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const forwardedIp =
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		'unknown';
	const ipBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(forwardedIp));
	const clientIpHash = Array.from(new Uint8Array(ipBytes), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const dailyLimit = Math.max(1, Number(env.COURSE_RESEARCH_MAX_JOBS_PER_DAY ?? 20));
	const ipLimit = Math.max(
		1,
		Math.min(dailyLimit, Number(env.COURSE_RESEARCH_MAX_JOBS_PER_IP_PER_DAY ?? 20))
	);
	const activeLimit = Math.max(1, Number(env.COURSE_RESEARCH_MAX_ACTIVE_JOBS ?? 3));
	const [globalCount, ipCount, activeCount] = await Promise.all([
		runner.countRecentJobs(since),
		runner.countRecentJobs(since, clientIpHash),
		runner.countActiveJobs()
	]);
	if (globalCount >= dailyLimit || ipCount >= ipLimit || activeCount >= activeLimit) {
		return json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'retry-after': '3600' } });
	}
	const jobs = await runner.getJobs(normalized.courseCode);
	if (body.refresh === true) {
		const minimumAgeHours = Math.max(0, Number(env.COURSE_RESEARCH_MIN_REFRESH_AGE_HOURS ?? 6));
		const newestSuccess = jobs.find((job) => job.status === 'complete' && job.completedAt);
		if (
			newestSuccess?.completedAt &&
			Date.now() - new Date(newestSuccess.completedAt).getTime() < minimumAgeHours * 60 * 60 * 1000
		) {
			return json(
				{ error: 'RATE_LIMITED', detail: 'Sources were refreshed recently.' },
				{ status: 429, headers: { 'retry-after': String(minimumAgeHours * 3600) } }
			);
		}
	}
	const activeJob = jobs.find((job) => {
		if (!isReusableBriefingJob(job)) return false;
		const frozen = parseFrozenContext(job.frozenContext);
		return frozen ? frozenContextMatchesRequest(frozen, params) : false;
	});
	if (activeJob) return json({ job: publicJob(activeJob) });

	const job = await runner.createJob(params, clientIpHash);

	const promise = _processJob(platform.env.BRIEF_DB, job.id);
	if (typeof platform.ctx?.waitUntil === 'function') {
		platform.ctx.waitUntil(promise);
	}

	return json({ job: publicJob(job) });
}

export { publicJob as _publicJob };
