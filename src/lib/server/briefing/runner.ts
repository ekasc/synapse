import { BRIEFING_SCHEMA_VERSION } from './schema';
import type { Briefing, IdentityCandidate } from './schema';

// ── Types ──

export type BriefingJob = {
	id: string;
	courseCode: string;
	model: string;
	status: BriefingStage;
	stageUpdatedAt?: string | null;
	frozenContext: string;
	contextHash: string;
	cacheKey: string;
	output: string | null;
	errorCode: string | null;
	errorMessage: string | null;
	createdAt: string;
	startedAt: string | null;
	expiresAt: string;
	completedAt: string | null;
	activeKey?: string | null;
	leaseToken?: string | null;
	clientIpHash?: string | null;
	identityCandidates?: IdentityCandidate[];
	cacheHit?: boolean;
};
export const BRIEFING_STAGES = [
	'queued',
	'resolving_identity',
	'awaiting_identity_choice',
	'conflict',
	'searching_catalog',
	'searching_schedule',
	'searching_outline',
	'searching_instructor',
	'searching_reputation',
	'ranking_evidence',
	'synthesizing',
	'validating',
	'publishing',
	'complete',
	'failed',
	'cancelled'
] as const;
export type BriefingStage = (typeof BRIEFING_STAGES)[number];
const ACTIVE_STAGES: readonly BriefingStage[] = BRIEFING_STAGES.filter(
	(s) => !['complete', 'failed', 'cancelled', 'conflict', 'awaiting_identity_choice'].includes(s)
);

export type CreateBriefingJobParams = {
	courseCode: string;
	courseName?: string;
	professorName?: string;
	institution?: string;
	additionalNotes?: string;
	model: string;
	forceRefresh?: boolean;
	identityChoice?: string;
	activeTerm?: string;
};

export type BriefingFrozenContext = {
	courseCode: string;
	courseName: string | null;
	professorName: string | null;
	institution: string | null;
	additionalNotes: string | null;
	model: string;
	forceRefresh: boolean;
	identityChoice: string | null;
	activeTerm: string | null;
	schemaVersion: number;
	researchedAt: string;
};

export const RUNNING_JOB_TIMEOUT_MS = 30 * 60 * 1000;
export const ACTIVE_JOB_CONFLICT_CLAUSE =
	'ON CONFLICT(active_key) WHERE active_key IS NOT NULL DO NOTHING';

export function isReusableBriefingJob(job: BriefingJob, now = new Date()): boolean {
	if (job.status === 'queued') {
		return new Date(job.expiresAt).getTime() > now.getTime();
	}

	if (ACTIVE_STAGES.includes(job.status)) {
		const startedAt = job.startedAt
			? new Date(job.startedAt).getTime()
			: new Date(job.createdAt).getTime();
		return now.getTime() - startedAt <= RUNNING_JOB_TIMEOUT_MS;
	}

	return false;
}

export function parseFrozenContext(frozen: string): BriefingFrozenContext | null {
	try {
		return JSON.parse(frozen) as BriefingFrozenContext;
	} catch {
		return null;
	}
}

export function frozenContextMatchesRequest(
	frozen: BriefingFrozenContext,
	request: CreateBriefingJobParams
): boolean {
	return (
		frozen.courseCode === request.courseCode &&
		(frozen.courseName ?? null) === (request.courseName ?? null) &&
		(frozen.professorName ?? null) === (request.professorName ?? null) &&
		(frozen.institution ?? null) === (request.institution ?? null) &&
		(frozen.additionalNotes ?? null) === (request.additionalNotes ?? null) &&
		(frozen.identityChoice ?? null) === (request.identityChoice ?? null) &&
		(frozen.activeTerm ?? null) === (request.activeTerm ?? null) &&
		frozen.model === request.model &&
		frozen.schemaVersion === BRIEFING_SCHEMA_VERSION
	);
}

/** SHA-256 hex hash using Web Crypto API (available in Workers) */
async function sha256Hex(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildStableContext(params: CreateBriefingJobParams): string {
	return JSON.stringify({
		courseCode: params.courseCode,
		courseName: params.courseName ?? null,
		professorName: params.professorName ?? null,
		institution: params.institution ?? null,
		additionalNotes: params.additionalNotes ?? null,
		identityChoice: params.identityChoice ?? null,
		activeTerm: params.activeTerm ?? null,
		model: params.model,
		schemaVersion: BRIEFING_SCHEMA_VERSION
	});
}

/** Search-stable context excludes synthesis provider — changing V4 Pro routing must not invalidate paid Flash evidence. */
export function buildSearchContext(params: CreateBriefingJobParams): string {
	return JSON.stringify({
		evidencePipelineVersion: 3,
		courseCode: params.courseCode,
		courseName: params.courseName ?? null,
		professorName: params.professorName ?? null,
		institution: params.institution ?? null,
		additionalNotes: params.additionalNotes ?? null,
		identityChoice: params.identityChoice ?? null,
		activeTerm: params.activeTerm ?? null,
		schemaVersion: BRIEFING_SCHEMA_VERSION
	});
}

export function buildCacheKey(params: CreateBriefingJobParams, contextHash: string): string {
	return buildFinalCacheKey(contextHash);
}

export function buildEvidenceCacheKey(contextHash: string): string {
	return `briefing:evidence:v1:${contextHash}`;
}

export function buildFinalCacheKey(contextHash: string): string {
	return `briefing:final:v${BRIEFING_SCHEMA_VERSION}:deterministic-v2:${contextHash}`;
}

export function createBriefingRunner(binding: D1Database) {
	async function expireStaleJobs(): Promise<void> {
		const now = new Date();
		const nowIso = now.toISOString();
		const runningCutoff = new Date(now.getTime() - RUNNING_JOB_TIMEOUT_MS).toISOString();

		await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'failed', error_code = 'EXPIRED', error_message = 'Briefing job expired before completion', completed_at = ?, active_key = NULL, lease_token = NULL
			 WHERE status = 'queued' AND expires_at < ?`
			)
			.bind(nowIso, nowIso)
			.run();

		await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'conflict', error_code = 'IDENTITY_CONFLICT', error_message = 'Course identity evidence conflicted and could not be resolved automatically.', completed_at = ?, stage_updated_at = ?, active_key = NULL, lease_token = NULL
			 WHERE status = 'awaiting_identity_choice'`
			)
			.bind(nowIso, nowIso)
			.run();

		await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'failed', error_code = 'EXPIRED', error_message = 'Briefing job timed out', completed_at = ?, active_key = NULL, lease_token = NULL
			 WHERE status NOT IN ('queued','awaiting_identity_choice','conflict','complete','failed','cancelled') AND coalesce(stage_updated_at, started_at, created_at) < ?`
			)
			.bind(nowIso, runningCutoff)
			.run();
	}

	/** Claim the next queued job atomically. */
	async function claimNextJob(): Promise<BriefingJob | null> {
		const now = new Date().toISOString();
		const leaseToken = crypto.randomUUID();

		await expireStaleJobs();

		// Claim one queued job
		const result = await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'resolving_identity', started_at = ?, stage_updated_at = ?, lease_token = ?
			 WHERE id = (
			   SELECT id FROM briefing_jobs
			   WHERE status = 'queued' AND expires_at > ?
			   LIMIT 1
			 )
			 RETURNING *`
			)
			.bind(now, now, leaseToken, now)
			.first<Record<string, unknown>>();

		if (!result) return null;
		return rowToJob(result);
	}

	/** Start a specific queued job. */
	async function startJob(id: string): Promise<BriefingJob | null> {
		const now = new Date().toISOString();
		const leaseToken = crypto.randomUUID();

		await expireStaleJobs();

		const result = await binding
			.prepare(
				`UPDATE briefing_jobs
				 SET status = 'resolving_identity', started_at = ?, stage_updated_at = ?, lease_token = ?
				 WHERE id = ? AND status = 'queued' AND expires_at > ?
				 RETURNING *`
			)
			.bind(now, now, leaseToken, id, now)
			.first<Record<string, unknown>>();

		return result ? rowToJob(result) : null;
	}

	/** Create a new briefing job */
	async function createJob(
		params: CreateBriefingJobParams,
		clientIpHash: string | null = null
	): Promise<BriefingJob> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const frozenContext = JSON.stringify({
			courseCode: params.courseCode,
			courseName: params.courseName ?? null,
			professorName: params.professorName ?? null,
			institution: params.institution ?? null,
			additionalNotes: params.additionalNotes ?? null,
			identityChoice: params.identityChoice ?? null,
			activeTerm: params.activeTerm ?? null,
			model: params.model,
			forceRefresh: params.forceRefresh ?? false,
			schemaVersion: BRIEFING_SCHEMA_VERSION,
			researchedAt: now
		});
		const stableContext = buildStableContext(params);
		const contextHash = await sha256Hex(stableContext);
		const cacheKey = buildCacheKey(params, contextHash);
		const activeKey = contextHash;
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

		await expireStaleJobs();
		await binding
			.prepare(
				`INSERT INTO briefing_jobs (id, course_code, status, frozen_context, context_hash, cache_key, active_key, client_ip_hash, created_at, expires_at) VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?) ${ACTIVE_JOB_CONFLICT_CLAUSE}`
			)
			.bind(
				id,
				params.courseCode,
				frozenContext,
				contextHash,
				cacheKey,
				activeKey,
				clientIpHash,
				now,
				expiresAt
			)
			.run();
		const stored = await binding
			.prepare(`SELECT * FROM briefing_jobs WHERE active_key = ?`)
			.bind(activeKey)
			.first<Record<string, unknown>>();
		if (!stored) throw new Error('JOB_CREATE_FAILED');
		if (String(stored.id) !== id) return rowToJob(stored);

		return {
			id,
			courseCode: params.courseCode,
			model: params.model,
			status: 'queued' as const,
			frozenContext,
			contextHash,
			cacheKey,
			output: null,
			errorCode: null,
			errorMessage: null,
			createdAt: now,
			startedAt: null,
			expiresAt,
			completedAt: null,
			activeKey,
			leaseToken: null,
			clientIpHash
		};
	}

	/** Mark a job as succeeded */
	async function completeJob(
		id: string,
		output: string,
		leaseToken?: string,
		cacheHit = false
	): Promise<boolean> {
		const now = new Date().toISOString();
		const result = await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'complete', output = ?, completed_at = ?, stage_updated_at = ?, cache_hit = ?, active_key = NULL, lease_token = NULL WHERE id = ? AND status = 'publishing' AND (? IS NULL OR lease_token = ?)`
			)
			.bind(output, now, now, cacheHit ? 1 : 0, id, leaseToken ?? null, leaseToken ?? null)
			.run();
		return Boolean(result.meta.changes);
	}

	/** Mark a job as failed */
	async function failJob(
		id: string,
		errorCode: string,
		errorMessage: string,
		leaseToken?: string
	): Promise<boolean> {
		const now = new Date().toISOString();
		const result = await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?, stage_updated_at = ?, active_key = NULL, lease_token = NULL WHERE id = ? AND status NOT IN ('complete','failed','cancelled') AND (? IS NULL OR lease_token = ?)`
			)
			.bind(
				errorCode,
				errorMessage.slice(0, 500),
				now,
				now,
				id,
				leaseToken ?? null,
				leaseToken ?? null
			)
			.run();
		return Boolean(result.meta.changes);
	}

	/** Get recent jobs for a course code */
	async function getJobs(courseCode: string): Promise<BriefingJob[]> {
		await expireStaleJobs();
		const rows = await binding
			.prepare(`SELECT * FROM briefing_jobs WHERE course_code = ? ORDER BY created_at DESC`)
			.bind(courseCode)
			.all<Record<string, unknown>>();
		return (rows.results ?? []).map(rowToJob);
	}

	/** Get a single job by id */
	async function getJob(id: string): Promise<BriefingJob | null> {
		await expireStaleJobs();
		const row = await binding
			.prepare(`SELECT * FROM briefing_jobs WHERE id = ?`)
			.bind(id)
			.first<Record<string, unknown>>();
		return row ? rowToJob(row) : null;
	}

	/** Get all jobs, newest first */
	async function getAllJobs(): Promise<BriefingJob[]> {
		await expireStaleJobs();
		const rows = await binding
			.prepare(`SELECT * FROM briefing_jobs ORDER BY created_at DESC LIMIT 100`)
			.all<Record<string, unknown>>();
		return (rows.results ?? []).map(rowToJob);
	}

	async function countRecentJobs(since: string, clientIpHash?: string): Promise<number> {
		const statement = clientIpHash
			? binding
					.prepare(
						`SELECT count(*) AS count FROM briefing_jobs WHERE created_at >= ? AND client_ip_hash = ?`
					)
					.bind(since, clientIpHash)
			: binding
					.prepare(`SELECT count(*) AS count FROM briefing_jobs WHERE created_at >= ?`)
					.bind(since);
		const row = await statement.first<{ count: number }>();
		return Number(row?.count ?? 0);
	}

	async function countActiveJobs(): Promise<number> {
		const row = await binding
			.prepare(
				`SELECT count(*) AS count FROM briefing_jobs WHERE status NOT IN ('awaiting_identity_choice','conflict','complete','failed','cancelled')`
			)
			.first<{ count: number }>();
		return Number(row?.count ?? 0);
	}

	/** Cancel a queued/running job */
	async function cancelJob(id: string): Promise<void> {
		await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'cancelled', completed_at = ?, stage_updated_at = ?, active_key = NULL, lease_token = NULL WHERE id = ? AND status NOT IN ('complete','failed','cancelled')`
			)
			.bind(new Date().toISOString(), new Date().toISOString(), id)
			.run();
	}

	/** Read from prompt cache */
	async function getCachedOutput(cacheKey: string): Promise<string | null> {
		const now = new Date().toISOString();
		const row = await binding
			.prepare(`SELECT output FROM prompt_cache WHERE cache_key = ? AND expires_at > ?`)
			.bind(cacheKey, now)
			.first<{ output: string }>();
		return row?.output ?? null;
	}

	/** Write to prompt cache (7-day TTL) */
	async function setCachedOutput(
		cacheKey: string,
		output: string,
		modelUsed: string
	): Promise<void> {
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		await binding
			.prepare(
				`INSERT OR REPLACE INTO prompt_cache (cache_key, output, model_used, created_at, expires_at)
			 VALUES (?, ?, ?, ?, ?)`
			)
			.bind(cacheKey, output, modelUsed, now, expiresAt)
			.run();
	}

	/** Cache and publish together. D1 batch is transactional: canceled/expired jobs cannot publish. */
	async function publishJob(
		id: string,
		leaseToken: string,
		cacheKey: string,
		output: string,
		modelUsed: string,
		cacheHit = false
	): Promise<boolean> {
		const report = JSON.parse(output) as Briefing;
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const results = await binding.batch([
			binding
				.prepare(
					`INSERT OR REPLACE INTO prompt_cache (cache_key, output, model_used, created_at, expires_at)
					 SELECT ?, ?, ?, ?, ? WHERE EXISTS (
					   SELECT 1 FROM briefing_jobs WHERE id = ? AND status = 'publishing' AND lease_token = ?
					 )`
				)
				.bind(cacheKey, output, modelUsed, now, expiresAt, id, leaseToken),
			binding
				.prepare(
					`INSERT INTO briefings
					 (code, name, institution, professor, rmp_rating, rmp_count, workload, weekly_hours, prereq_readiness, grade_structure, recommendation, sources, researched_at, model_used, schema_version, briefing_json)
					 SELECT ?, ?, ?, ?, ?, NULL, ?, NULL, ?, '[]', ?, ?, ?, ?, 4, ?
					 WHERE EXISTS (SELECT 1 FROM briefing_jobs WHERE id = ? AND status = 'publishing' AND lease_token = ?)
					 ON CONFLICT(code) DO UPDATE SET
					 name=excluded.name, institution=excluded.institution, professor=excluded.professor,
					 rmp_rating=excluded.rmp_rating, rmp_count=excluded.rmp_count, workload=excluded.workload,
					 weekly_hours=excluded.weekly_hours, prereq_readiness=excluded.prereq_readiness,
					 grade_structure=excluded.grade_structure, recommendation=excluded.recommendation,
					 sources=excluded.sources, researched_at=excluded.researched_at, model_used=excluded.model_used,
					 schema_version=4, briefing_json=excluded.briefing_json`
				)
				.bind(
					report.identity.code,
					report.identity.name,
					report.identity.institution,
					report.instructor.requestedName ?? report.instructor.name ?? 'Not requested',
					report.rateMyProfessors.text || 'Not searched',
					report.workload.text || 'Not verified',
					report.prerequisites.text || 'Not verified',
					report.summary.text || 'No verified summary available',
					JSON.stringify(report.sources),
					report.researchedAt,
					modelUsed,
					output,
					id,
					leaseToken
				),
			binding
				.prepare(
					`UPDATE briefing_jobs SET status = 'complete', output = ?, completed_at = ?, stage_updated_at = ?, cache_hit = ?, active_key = NULL, lease_token = NULL WHERE id = ? AND status = 'publishing' AND lease_token = ?`
				)
				.bind(output, now, now, cacheHit ? 1 : 0, id, leaseToken)
		]);
		return Boolean(results[2]?.meta.changes);
	}

	async function updateStage(
		id: string,
		leaseToken: string,
		stage: BriefingStage,
		at = new Date().toISOString()
	): Promise<boolean> {
		if (!BRIEFING_STAGES.includes(stage)) return false;
		const result = await binding
			.prepare(
				`UPDATE briefing_jobs SET status = ?, stage_updated_at = ? WHERE id = ? AND lease_token = ? AND status NOT IN ('complete','failed','cancelled') AND (stage_updated_at IS NULL OR stage_updated_at <= ?)`
			)
			.bind(stage, at, id, leaseToken, at)
			.run();
		return Boolean(result.meta.changes);
	}
	async function persistAttempt(
		jobId: string,
		attempt: {
			stage: string;
			attempt: number;
			responseId: string | null;
			requestedModel: string;
			actualModel: string | null;
			provider: string | null;
			query: string | null;
			responseJson: string | null;
			usage: unknown;
			elapsedMs: number;
			status: number;
			retry: boolean;
		}
	) {
		await binding
			.prepare(
				`INSERT OR IGNORE INTO briefing_request_attempts (job_id, stage, attempt_number, response_id, requested_model, actual_model, provider, query, response_json, usage_json, cost_microdollars, elapsed_ms, http_status, was_retry, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, json_extract(?, '$.costMicrodollars'), ?, ?, ?, ?)`
			)
			.bind(
				jobId,
				attempt.stage,
				attempt.attempt,
				attempt.responseId,
				attempt.requestedModel,
				attempt.actualModel,
				attempt.provider,
				attempt.query,
				attempt.responseJson,
				JSON.stringify(attempt.usage),
				JSON.stringify(attempt.usage),
				attempt.elapsedMs,
				attempt.status,
				attempt.retry ? 1 : 0,
				new Date().toISOString()
			)
			.run();
	}
	async function persistEvidence(
		jobId: string,
		source: {
			id: string;
			category: string;
			canonicalUrl: string;
			domain: string;
			publisher: string;
			publishedAt: string | null;
			updatedAt: string | null;
			retrievedAt: string;
			currentness: string;
			retrievalStatus: string;
			contentFingerprint: string;
			claimsSupported: string[];
		}
	) {
		await binding
			.prepare(
				`INSERT OR REPLACE INTO briefing_evidence (job_id, source_id, category, canonical_url, domain, publisher, published_at, updated_at, retrieved_at, currentness, retrieval_status, content_fingerprint, claims_supported_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				jobId,
				source.id,
				source.category,
				source.canonicalUrl,
				source.domain,
				source.publisher,
				source.publishedAt,
				source.updatedAt,
				source.retrievedAt,
				source.currentness,
				source.retrievalStatus,
				source.contentFingerprint,
				JSON.stringify(source.claimsSupported)
			)
			.run();
	}
	async function getCategoryEvidence(cacheKey: string, category: string) {
		const row = await binding
			.prepare(
				`SELECT evidence_json FROM briefing_evidence_cache WHERE cache_key = ? AND category = ? AND expires_at > ?`
			)
			.bind(cacheKey, category, new Date().toISOString())
			.first<{ evidence_json: string }>();
		return row?.evidence_json ?? null;
	}
	async function setCategoryEvidence(
		cacheKey: string,
		category: string,
		evidence: string,
		ttlMs: number
	) {
		const now = new Date();
		await binding
			.prepare(
				`INSERT OR REPLACE INTO briefing_evidence_cache (cache_key, category, evidence_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
			)
			.bind(
				cacheKey,
				category,
				evidence,
				now.toISOString(),
				new Date(now.getTime() + ttlMs).toISOString()
			)
			.run();
	}

	async function setIdentityCandidates(id: string, leaseToken: string, candidates: unknown) {
		await binding
			.prepare(
				`UPDATE briefing_jobs SET identity_candidates = ? WHERE id = ? AND lease_token = ? AND status NOT IN ('complete','failed','cancelled')`
			)
			.bind(JSON.stringify(candidates), id, leaseToken)
			.run();
	}

	async function conflictJob(
		id: string,
		leaseToken: string | undefined,
		code: string,
		message: string
	): Promise<boolean> {
		const now = new Date().toISOString();
		const result = await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'conflict', error_code = ?, error_message = ?, completed_at = ?, stage_updated_at = ?, active_key = NULL, lease_token = NULL WHERE id = ? AND status NOT IN ('complete','failed','cancelled','conflict') AND (? IS NULL OR lease_token = ?)`
			)
			.bind(code, message, now, now, id, leaseToken ?? null, leaseToken ?? null)
			.run();
		return Boolean(result.meta.changes);
	}

	return {
		claimNextJob,
		startJob,
		createJob,
		completeJob,
		failJob,
		getJobs,
		getJob,
		getAllJobs,
		countRecentJobs,
		countActiveJobs,
		cancelJob,
		getCachedOutput,
		setCachedOutput,
		publishJob,
		updateStage,
		persistAttempt,
		persistEvidence,
		getCategoryEvidence,
		setCategoryEvidence,
		setIdentityCandidates,
		conflictJob
	};
}

function rowToJob(row: Record<string, unknown>): BriefingJob {
	const frozen = parseFrozenContext(String(row.frozen_context));
	return {
		id: String(row.id),
		courseCode: String(row.course_code),
		model: frozen?.model ?? 'unknown',
		status: row.status as BriefingJob['status'],
		frozenContext: String(row.frozen_context),
		contextHash: String(row.context_hash),
		cacheKey: String(row.cache_key),
		output: row.output ? String(row.output) : null,
		errorCode: row.error_code ? String(row.error_code) : null,
		errorMessage: row.error_message ? String(row.error_message) : null,
		createdAt: String(row.created_at),
		startedAt: row.started_at ? String(row.started_at) : null,
		expiresAt: String(row.expires_at),
		completedAt: row.completed_at ? String(row.completed_at) : null,
		activeKey: row.active_key ? String(row.active_key) : null,
		leaseToken: row.lease_token ? String(row.lease_token) : null,
		clientIpHash: row.client_ip_hash ? String(row.client_ip_hash) : null,
		stageUpdatedAt: row.stage_updated_at ? String(row.stage_updated_at) : null,
		identityCandidates: row.identity_candidates
			? (JSON.parse(String(row.identity_candidates)) as IdentityCandidate[])
			: [],
		cacheHit: Number(row.cache_hit ?? 0) === 1
	};
}

export type { Briefing };
