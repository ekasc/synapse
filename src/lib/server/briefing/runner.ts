import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import * as schema from '../db/d1-schema';

// ── Types ──

export type BriefingJob = {
	id: string;
	courseCode: string;
	status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
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

/** SHA-256 hex hash using Web Crypto API (available in Workers) */
async function sha256Hex(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createBriefingRunner(binding: D1Database) {
	const db = drizzle(binding, { schema });

	/** Claim the next queued job atomically. */
	async function claimNextJob(): Promise<BriefingJob | null> {
		const now = new Date().toISOString();

		// Cleanup expired queued jobs
		await binding.prepare(
			`DELETE FROM briefing_jobs WHERE expires_at < ? AND status = 'queued'`
		).bind(now).run();

		// Claim one queued job
		const result = await binding.prepare(
			`UPDATE briefing_jobs
			 SET status = 'running', started_at = ?
			 WHERE id = (
			   SELECT id FROM briefing_jobs
			   WHERE status = 'queued' AND expires_at > ?
			   LIMIT 1
			 )
			 RETURNING *`
		).bind(now, now).first<Record<string, unknown>>();

		if (!result) return null;
		return rowToJob(result);
	}

	/** Create a new briefing job */
	async function createJob(params: { courseCode: string; professorName?: string; institution?: string }): Promise<BriefingJob> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const frozenContext = JSON.stringify({ courseCode: params.courseCode, professorName: params.professorName ?? null, institution: params.institution ?? null, researchedAt: now });
		const stableContext = JSON.stringify({ courseCode: params.courseCode, professorName: params.professorName ?? null, institution: params.institution ?? null });
		const contextHash = await sha256Hex(stableContext);
		const cacheKey = `briefing:${params.courseCode}:${contextHash}`;
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
			id, courseCode: params.courseCode, status: 'queued' as const,
			frozenContext, contextHash, cacheKey,
			output: null, errorCode: null, errorMessage: null,
			createdAt: now, startedAt: null, expiresAt, completedAt: null
		};
	}

	/** Mark a job as succeeded */
	async function completeJob(id: string, output: string): Promise<void> {
		const now = new Date().toISOString();
		await binding.prepare(
			`UPDATE briefing_jobs SET status = 'succeeded', output = ?, completed_at = ? WHERE id = ?`
		).bind(output, now, id).run();
	}

	/** Mark a job as failed */
	async function failJob(id: string, errorCode: string, errorMessage: string): Promise<void> {
		const now = new Date().toISOString();
		await binding.prepare(
			`UPDATE briefing_jobs SET status = 'failed', error_code = ?, error_message = ?, completed_at = ? WHERE id = ?`
		).bind(errorCode, errorMessage, now, id).run();
	}

	/** Get recent jobs for a course code */
	async function getJobs(courseCode: string): Promise<BriefingJob[]> {
		const rows = await binding.prepare(
			`SELECT * FROM briefing_jobs WHERE course_code = ? ORDER BY created_at DESC`
		).bind(courseCode).all<Record<string, unknown>>();
		return (rows.results ?? []).map(rowToJob);
	}

	/** Get a single job by id */
	async function getJob(id: string): Promise<BriefingJob | null> {
		const row = await binding.prepare(
			`SELECT * FROM briefing_jobs WHERE id = ?`
		).bind(id).first<Record<string, unknown>>();
		return row ? rowToJob(row) : null;
	}

	/** Read from prompt cache */
	async function getCachedOutput(cacheKey: string): Promise<string | null> {
		const now = new Date().toISOString();
		const row = await binding.prepare(
			`SELECT output FROM prompt_cache WHERE cache_key = ? AND expires_at > ?`
		).bind(cacheKey, now).first<{ output: string }>();
		return row?.output ?? null;
	}

	/** Write to prompt cache (7-day TTL) */
	async function setCachedOutput(cacheKey: string, output: string): Promise<void> {
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		await binding.prepare(
			`INSERT OR REPLACE INTO prompt_cache (cache_key, output, created_at, expires_at)
			 VALUES (?, ?, ?, ?)`
		).bind(cacheKey, output, now, expiresAt).run();
	}

	return {
		claimNextJob, createJob, completeJob, failJob, getJobs, getJob,
		getCachedOutput, setCachedOutput
	};
}

function rowToJob(row: Record<string, unknown>): BriefingJob {
	return {
		id: String(row.id),
		courseCode: String(row.course_code),
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
