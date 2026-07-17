import { describe, expect, it } from 'vitest';
import { normalizeDomain, parseFocusPreferences, parseStudySession } from './study-timer';

describe('study timer input validation', () => {
	it('normalizes domains and rejects conflicting lists', () => {
		expect(normalizeDomain('https://www.NotebookLM.Google.com/path')).toBe('notebooklm.google.com');
		expect(
			parseFocusPreferences({ allowedSites: ['example.com'], blockedSites: ['example.com'] })
		).toBeNull();
	});

	it('accepts a bounded completed session', () => {
		expect(
			parseStudySession({
				courseId: 'course-1',
				intention: 'Review',
				plannedSeconds: 1500,
				completedSeconds: 1500,
				distractionCount: 2,
				focusScore: 84,
				startedAt: '2026-07-16T20:00:00.000Z'
			})
		).toMatchObject({ courseId: 'course-1', plannedSeconds: 1500, focusScore: 84 });
	});

	it('rejects impossible session values', () => {
		expect(parseStudySession({ plannedSeconds: -1 })).toBeNull();
		expect(
			parseStudySession({
				plannedSeconds: 1500,
				completedSeconds: 2000,
				distractionCount: 0,
				focusScore: 100,
				startedAt: new Date().toISOString()
			})
		).toBeNull();
	});
});
