import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/d1-schema';
import { BRIEFING_SCHEMA_VERSION } from './schema';
import type { Briefing } from './schema';

// ── Types ──

export type BriefingJob = {
	id: string;
	courseCode: string;
	model: string;
	status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'expired';
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
};

export type CreateBriefingJobParams = {
	courseCode: string;
	courseName?: string;
	professorName?: string;
	institution?: string;
	additionalNotes?: string;
	model: string;
};

export type BriefingFrozenContext = {
	courseCode: string;
	courseName: string | null;
	professorName: string | null;
	institution: string | null;
	additionalNotes: string | null;
	model: string;
	schemaVersion: number;
	researchedAt: string;
};

export const RUNNING_JOB_TIMEOUT_MS = 30 * 60 * 1000;

export function isReusableBriefingJob(job: BriefingJob, now = new Date()): boolean {
	if (job.status === 'queued') {
		return new Date(job.expiresAt).getTime() > now.getTime();
	}

	if (job.status === 'running') {
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
		model: params.model,
		schemaVersion: BRIEFING_SCHEMA_VERSION
	});
}

export function buildCacheKey(params: CreateBriefingJobParams, contextHash: string): string {
	return `briefing:${params.model}:${params.courseCode}:${contextHash}`;
}

export function createBriefingRunner(binding: D1Database) {
	const db = drizzle(binding, { schema });

	async function expireStaleJobs(): Promise<void> {
		const now = new Date();
		const nowIso = now.toISOString();
		const runningCutoff = new Date(now.getTime() - RUNNING_JOB_TIMEOUT_MS).toISOString();

		await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'expired', error_code = 'EXPIRED', error_message = 'Briefing job expired before completion', completed_at = ?
			 WHERE status = 'queued' AND expires_at < ?`
			)
			.bind(nowIso, nowIso)
			.run();

		await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'expired', error_code = 'EXPIRED', error_message = 'Briefing job timed out', completed_at = ?
			 WHERE status = 'running' AND coalesce(started_at, created_at) < ?`
			)
			.bind(nowIso, runningCutoff)
			.run();
	}

	/** Claim the next queued job atomically. */
	async function claimNextJob(): Promise<BriefingJob | null> {
		const now = new Date().toISOString();

		await expireStaleJobs();

		// Claim one queued job
		const result = await binding
			.prepare(
				`UPDATE briefing_jobs
			 SET status = 'running', started_at = ?
			 WHERE id = (
			   SELECT id FROM briefing_jobs
			   WHERE status = 'queued' AND expires_at > ?
			   LIMIT 1
			 )
			 RETURNING *`
			)
			.bind(now, now)
			.first<Record<string, unknown>>();

		if (!result) return null;
		return rowToJob(result);
	}

	/** Start a specific queued job. */
	async function startJob(id: string): Promise<BriefingJob | null> {
		const now = new Date().toISOString();

		await expireStaleJobs();

		const result = await binding
			.prepare(
				`UPDATE briefing_jobs
				 SET status = 'running', started_at = ?
				 WHERE id = ? AND status = 'queued' AND expires_at > ?
				 RETURNING *`
			)
			.bind(now, id, now)
			.first<Record<string, unknown>>();

		return result ? rowToJob(result) : null;
	}

	/** Create a new briefing job */
	async function createJob(params: CreateBriefingJobParams): Promise<BriefingJob> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const frozenContext = JSON.stringify({
			courseCode: params.courseCode,
			courseName: params.courseName ?? null,
			professorName: params.professorName ?? null,
			institution: params.institution ?? null,
			additionalNotes: params.additionalNotes ?? null,
			model: params.model,
			schemaVersion: BRIEFING_SCHEMA_VERSION,
			researchedAt: now
		});
		const stableContext = buildStableContext(params);
		const contextHash = await sha256Hex(stableContext);
		const cacheKey = buildCacheKey(params, contextHash);
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

		await db.insert(schema.briefingJobs).values({
			id,
			courseCode: params.courseCode,
			status: 'queued',
			frozenContext,
			contextHash,
			cacheKey,
			output: null,
			errorCode: null,
			errorMessage: null,
			createdAt: now,
			startedAt: null,
			expiresAt,
			completedAt: null
		});

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
			completedAt: null
		};
	}

	/** Mark a job as succeeded */
	async function completeJob(id: string, output: string): Promise<void> {
		const now = new Date().toISOString();
		await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'succeeded', output = ?, completed_at = ? WHERE id = ?`
			)
			.bind(output, now, id)
			.run();
	}

	/** Mark a job as failed */
	async function failJob(id: string, errorCode: string, errorMessage: string): Promise<void> {
		const now = new Date().toISOString();
		await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?`
			)
			.bind(errorCode, errorMessage, now, id)
			.run();
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

	/** Cancel a queued/running job */
	async function cancelJob(id: string): Promise<void> {
		await binding
			.prepare(
				`UPDATE briefing_jobs SET status = 'canceled', completed_at = ? WHERE id = ? AND status IN ('queued', 'running')`
			)
			.bind(new Date().toISOString(), id)
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

	return {
		claimNextJob,
		startJob,
		createJob,
		completeJob,
		failJob,
		getJobs,
		getJob,
		getAllJobs,
		cancelJob,
		getCachedOutput,
		setCachedOutput
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
		completedAt: row.completed_at ? String(row.completed_at) : null
	};
}

export type { Briefing };
