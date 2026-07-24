import { describe, expect, it } from 'vitest';
import {
	normalizeSyllabusEventTitle,
	parseSyllabusCalendarDate,
	prepareSyllabusEvents,
	syllabusEventFingerprint
} from './syllabus-sync';

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

describe('syllabus event preparation', () => {
	const toCalendarType = (type: string) => type;

	it('normalizes harmless title differences', () => {
		expect(normalizeSyllabusEventTitle('  Final—Exam!! ')).toBe('final exam');
		expect(
			syllabusEventFingerprint({
				courseId: 'course-1',
				title: 'Final Exam',
				type: 'final',
				year: 2026,
				month: 11,
				date: 12
			})
		).toBe(
			syllabusEventFingerprint({
				courseId: 'course-1',
				title: ' final   exam! ',
				type: 'FINAL',
				year: 2026,
				month: 11,
				date: 12
			})
		);
	});

	it('skips past and duplicate extracted rows but accepts today', () => {
		const result = prepareSyllabusEvents({
			courseId: 'course-1',
			semesterYear: 2026,
			now: new Date(2026, 6, 20, 14),
			toCalendarType,
			rows: [
				{ label: 'Old quiz', date: 'July 19', type: 'quiz' },
				{ label: 'Assignment 1', date: 'July 20', type: 'assignment' },
				{ label: ' assignment 1! ', date: '2026-07-20', type: 'assignment' },
				{ label: 'Bad date', date: 'TBD', type: 'assignment' }
			]
		});
		expect(result).toMatchObject({ skippedOld: 1, skippedDuplicate: 1, invalid: 1 });
		expect(result.events).toHaveLength(1);
		expect(result.events[0].title).toBe('Assignment 1');
	});

	it('keeps recurring events with the same title on different dates', () => {
		const result = prepareSyllabusEvents({
			courseId: 'course-1',
			semesterYear: 2026,
			now: new Date(2026, 6, 1),
			toCalendarType,
			rows: [
				{ label: 'Quiz', date: 'July 20', type: 'quiz' },
				{ label: 'Quiz', date: 'July 27', type: 'quiz' }
			]
		});
		expect(result.events).toHaveLength(2);
	});
});
