import { describe, expect, it } from 'vitest';
import { parseSyllabusCalendarDate } from './syllabus-sync';

describe('syllabus calendar date parsing', () => {
	it('parses ISO dates returned by syllabus extraction', () => {
		expect(parseSyllabusCalendarDate('2026-05-07')).toEqual({ year: 2026, month: 4, day: 7 });
	});

	it('parses syllabus wording with or without an explicit year', () => {
		expect(parseSyllabusCalendarDate('May 30')).toEqual({ month: 4, day: 30 });
		expect(parseSyllabusCalendarDate('December 12, 2026')).toEqual({
			year: 2026,
			month: 11,
			day: 12
		});
	});

	it('rejects impossible dates', () => {
		expect(parseSyllabusCalendarDate('2026-02-30')).toBeNull();
	});
});
