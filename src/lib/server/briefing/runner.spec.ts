import { describe, expect, it } from 'vitest';
import { isReusableBriefingJob } from './runner';
import type { BriefingJob } from './runner';

function job(overrides: Partial<BriefingJob>): BriefingJob {
	return {
		id: 'job-1',
		courseCode: 'CSIS 3375',
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
