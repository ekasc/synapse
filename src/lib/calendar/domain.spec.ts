import { describe, expect, it } from 'vitest';
import {
	gradeWeightByCourse,
	isEventOverdue,
	shiftCalendarDate,
	upcomingEvents,
	weekDates
} from './domain';

const today = { year: 2026, month: 6, date: 18 };

describe('calendar domain', () => {
	it('does not classify completed or current-day events as overdue', () => {
		expect(isEventOverdue({ year: 2026, month: 6, date: 17, status: 'completed' }, today)).toBe(
			false
		);
		expect(isEventOverdue({ ...today, status: 'pending' }, today)).toBe(false);
		expect(isEventOverdue({ year: 2026, month: 5, date: 30, status: 'pending' }, today)).toBe(true);
	});

	it('returns incomplete upcoming events in date order', () => {
		const events = [
			{ id: 'later', year: 2026, month: 7, date: 1, status: 'pending' },
			{ id: 'done', year: 2026, month: 6, date: 19, status: 'completed' },
			{ id: 'today', ...today, status: 'pending' }
		];
		expect(upcomingEvents(events, today).map(({ id }) => id)).toEqual(['today', 'later']);
	});

	it('creates complete weeks across month and year boundaries', () => {
		expect(weekDates({ year: 2026, month: 0, date: 1 })).toEqual([
			{ year: 2025, month: 11, date: 28 },
			{ year: 2025, month: 11, date: 29 },
			{ year: 2025, month: 11, date: 30 },
			{ year: 2025, month: 11, date: 31 },
			{ year: 2026, month: 0, date: 1 },
			{ year: 2026, month: 0, date: 2 },
			{ year: 2026, month: 0, date: 3 }
		]);
	});

	it('moves by a week across month boundaries', () => {
		expect(shiftCalendarDate({ year: 2026, month: 0, date: 28 }, 7)).toEqual({
			year: 2026,
			month: 1,
			date: 4
		});
	});

	it('keeps grade weights separate by course', () => {
		expect(
			gradeWeightByCourse([
				{ courseCode: 'A', gradeWeight: 20 },
				{ courseCode: 'B', gradeWeight: 30 },
				{ courseCode: 'A', gradeWeight: 10 }
			])
		).toEqual([
			{ courseCode: 'A', weight: 30 },
			{ courseCode: 'B', weight: 30 }
		]);
	});
});
