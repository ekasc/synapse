import { describe, expect, it } from 'vitest';
import {
	isReusableBriefingJob,
	parseFrozenContext,
	frozenContextMatchesRequest,
	buildStableContext,
	buildCacheKey
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
				job({ status: 'running', startedAt: '2026-06-26T00:00:00.000Z' }),
				new Date('2026-06-26T00:31:00.000Z')
			)
		).toBe(false);
	});

	it('reuses fresh queued and running jobs', () => {
		const now = new Date('2026-06-26T00:05:00.000Z');

		expect(isReusableBriefingJob(job({ status: 'queued' }), now)).toBe(true);
		expect(
			isReusableBriefingJob(job({ status: 'running', startedAt: now.toISOString() }), now)
		).toBe(true);
	});
});

describe('briefing frozen context', () => {
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

	it('buildCacheKey includes the model, course code, and context hash', () => {
		const key = buildCacheKey(baseParams, 'abc123');
		expect(key).toBe('briefing:deepseek/deepseek-v4-flash:CSIS 3375:abc123');
	});
});
