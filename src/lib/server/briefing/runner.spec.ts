import { describe, expect, it } from 'vitest';
import {
	isReusableBriefingJob,
	parseFrozenContext,
	frozenContextMatchesRequest,
	buildStableContext,
	buildSearchContext,
	buildCacheKey,
	ACTIVE_JOB_CONFLICT_CLAUSE,
	createBriefingRunner
} from './runner';
import type { BriefingJob, CreateBriefingJobParams } from './runner';
import { BRIEFING_SCHEMA_VERSION } from './schema';

function job(overrides: Partial<BriefingJob>): BriefingJob {
	return {
		id: 'job-1',
		courseCode: 'CSIS 3375',
		model: 'deepseek/deepseek-v4-flash',
		status: 'queued',
		frozenContext: '{}',
		contextHash: 'hash',
		cacheKey: 'cache',
		output: null,
		errorCode: null,
		errorMessage: null,
		createdAt: '2026-06-26T00:00:00.000Z',
		startedAt: null,
		expiresAt: '2026-06-26T00:30:00.000Z',
		completedAt: null,
		activeKey: null,
		leaseToken: null,
		clientIpHash: null,
		...overrides
	};
}

const baseParams: CreateBriefingJobParams = {
	courseCode: 'CSIS 3375',
	courseName: 'Software Engineering',
	professorName: 'A. Instructor',
	institution: 'Douglas College',
	model: 'deepseek/deepseek-v4-flash'
};

describe('briefing job reuse', () => {
	it('does not reuse a running job older than the running timeout', () => {
		expect(
			isReusableBriefingJob(
				job({ status: 'synthesizing', startedAt: '2026-06-26T00:00:00.000Z' }),
				new Date('2026-06-26T00:31:00.000Z')
			)
		).toBe(false);
	});

	it('does not reuse terminal or legacy identity-choice jobs', () => {
		const now = new Date('2026-06-26T00:05:00.000Z');
		expect(isReusableBriefingJob(job({ status: 'conflict' }), now)).toBe(false);
		expect(isReusableBriefingJob(job({ status: 'awaiting_identity_choice' }), now)).toBe(false);
	});

	it('reuses fresh queued and running jobs', () => {
		const now = new Date('2026-06-26T00:05:00.000Z');

		expect(isReusableBriefingJob(job({ status: 'queued' }), now)).toBe(true);
		expect(
			isReusableBriefingJob(job({ status: 'synthesizing', startedAt: now.toISOString() }), now)
		).toBe(true);
	});
});

describe('terminal conflict persistence', () => {
	function recordingBinding(queries: string[], bindings: unknown[][] = []): D1Database {
		return {
			prepare(query: string) {
				queries.push(query);
				return {
					bind(...values: unknown[]) {
						bindings.push(values);
						return {
							run: async () => ({ meta: { changes: 1 } }),
							first: async () => null,
							all: async () => ({ results: [] })
						};
					}
				};
			}
		} as unknown as D1Database;
	}

	it('records a conflict without publishing or touching an existing briefing', async () => {
		const queries: string[] = [];
		const runner = createBriefingRunner(recordingBinding(queries));
		await runner.conflictJob('job-1', 'lease-1', 'IDENTITY_CONFLICT', 'Identity conflict');
		expect(queries.join('\n')).toContain("status = 'conflict'");
		expect(queries.join('\n')).not.toContain('INSERT INTO briefings');
		expect(queries.join('\n')).not.toContain('ON CONFLICT(code) DO UPDATE');
	});

	it('handles a missing lease as a nullable terminal transition', async () => {
		const queries: string[] = [];
		const bindings: unknown[][] = [];
		const runner = createBriefingRunner(recordingBinding(queries, bindings));
		await expect(
			runner.conflictJob('job-1', undefined, 'IDENTITY_CONFLICT', 'Identity conflict')
		).resolves.toBe(true);
		expect(queries.join('\n')).toContain('? IS NULL OR lease_token = ?');
		expect(bindings[0]?.slice(-2)).toEqual([null, null]);
	});

	it('converts stale identity-choice jobs to terminal conflicts during normal reads', async () => {
		const queries: string[] = [];
		const runner = createBriefingRunner(recordingBinding(queries));
		await runner.getJob('legacy-job');
		expect(queries.join('\n')).toContain("WHERE status = 'awaiting_identity_choice'");
		expect(queries.join('\n')).toContain("SET status = 'conflict'");
	});
});

describe('briefing frozen context', () => {
	it('targets the partial active-key index when creating jobs', () => {
		expect(ACTIVE_JOB_CONFLICT_CLAUSE).toBe(
			'ON CONFLICT(active_key) WHERE active_key IS NOT NULL DO NOTHING'
		);
	});
	const frozenJson = JSON.stringify({
		courseCode: 'CSIS 3375',
		courseName: 'Software Engineering',
		professorName: 'A. Instructor',
		institution: 'Douglas College',
		additionalNotes: null,
		model: 'deepseek/deepseek-v4-flash',
		schemaVersion: BRIEFING_SCHEMA_VERSION,
		researchedAt: '2026-06-26T00:00:00.000Z'
	});

	it('parses a valid frozen context', () => {
		const frozen = parseFrozenContext(frozenJson);
		expect(frozen).not.toBeNull();
		expect(frozen?.courseCode).toBe('CSIS 3375');
	});

	it('returns null for invalid JSON', () => {
		expect(parseFrozenContext('not json')).toBeNull();
	});

	it('matches when all request fields equal the frozen context', () => {
		const frozen = parseFrozenContext(frozenJson)!;
		expect(frozenContextMatchesRequest(frozen, baseParams)).toBe(true);
	});

	it('rejects when the course code differs', () => {
		const frozen = parseFrozenContext(frozenJson)!;
		expect(frozenContextMatchesRequest(frozen, { ...baseParams, courseCode: 'CSIS 9999' })).toBe(
			false
		);
	});

	it('rejects when the professor differs', () => {
		const frozen = parseFrozenContext(frozenJson)!;
		expect(
			frozenContextMatchesRequest(frozen, {
				...baseParams,
				professorName: 'Someone Else'
			})
		).toBe(false);
	});

	it('rejects when the model differs', () => {
		const frozen = parseFrozenContext(frozenJson)!;
		expect(frozenContextMatchesRequest(frozen, { ...baseParams, model: 'openai/gpt-5.2' })).toBe(
			false
		);
	});

	it('rejects when the schema version differs', () => {
		const frozen = parseFrozenContext(frozenJson)!;
		const stale = { ...frozen, schemaVersion: BRIEFING_SCHEMA_VERSION - 1 };
		expect(frozenContextMatchesRequest(stale, baseParams)).toBe(false);
	});
});

describe('briefing cache key', () => {
	it('buildStableContext is stable for the same inputs regardless of property order', () => {
		const a = buildStableContext(baseParams);
		const b = buildStableContext({ ...baseParams });
		expect(a).toBe(b);
	});

	it('buildStableContext changes when the model changes', () => {
		const a = buildStableContext(baseParams);
		const b = buildStableContext({ ...baseParams, model: 'openai/gpt-5.2' });
		expect(a).not.toBe(b);
	});

	it('versions search evidence independently from user input', () => {
		expect(JSON.parse(buildSearchContext(baseParams))).toMatchObject({
			evidencePipelineVersion: 3
		});
	});

	it('buildCacheKey is the final schema cache key', () => {
		const key = buildCacheKey(baseParams, 'abc123');
		expect(key).toBe(`briefing:final:v${BRIEFING_SCHEMA_VERSION}:deterministic-v2:abc123`);
	});
	it('excludes forceRefresh from stable cache identity', () =>
		expect(buildStableContext({ ...baseParams, forceRefresh: true })).toBe(
			buildStableContext({ ...baseParams, forceRefresh: false })
		));
});
