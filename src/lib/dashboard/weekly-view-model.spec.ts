import { describe, expect, it } from 'vitest';
import { buildWeeklyViewModel } from './weekly-view-model';
import type { WeeklyDigest } from './weekly';

const base: WeeklyDigest = {
	generatedAt: '2026-07-19T15:00:00.000Z',
	weekStart: '2026-07-19',
	weekEnd: '2026-07-25',
	priorities: [],
	deadlines: [],
	crunchWindows: [],
	studyGaps: [],
	continuationItems: [],
	warnings: []
};

const deadline = (overrides: Partial<WeeklyDigest['deadlines'][number]> = {}) => ({
	id: 'd1',
	courseCode: 'CSIS 4280',
	courseId: 'course-1',
	title: 'Assignment 3',
	type: 'assignment',
	typeLabel: 'Assignment',
	dueDate: '2026-07-21',
	time: null,
	gradeWeight: 25,
	status: 'pending',
	daysUntil: 2,
	overdue: false,
	link: { href: '/app/calendar', label: 'Open calendar' },
	...overrides
});

describe('buildWeeklyViewModel', () => {
	it('builds exactly seven timeline days and buckets upcoming deadlines', () => {
		const model = buildWeeklyViewModel(
			{ ...base, deadlines: [deadline()] },
			new Date(2026, 6, 19, 12)
		);
		expect(model.days).toHaveLength(7);
		expect(model.days[0].key).toBe('2026-07-19');
		expect(model.days[2].deadlines[0].title).toBe('Assignment 3');
		expect(model.days[0].isToday).toBe(true);
	});

	it('keeps overdue deadlines outside the seven-day buckets and selects them first', () => {
		const overdue = deadline({
			id: 'late',
			dueDate: '2026-07-18',
			daysUntil: -1,
			overdue: true
		});
		const model = buildWeeklyViewModel(
			{ ...base, deadlines: [overdue, deadline()] },
			new Date(2026, 6, 19, 12)
		);
		expect(model.overdue).toEqual([overdue]);
		expect(model.days.flatMap((day) => day.deadlines)).not.toContain(overdue);
		expect(model.nextUp?.kind).toBe('deadline');
		if (model.nextUp?.kind === 'deadline') expect(model.nextUp.deadline.id).toBe('late');
	});

	it('recalculates urgency when a cached plan is viewed later', () => {
		const stale = deadline({ daysUntil: 2, overdue: false });
		const model = buildWeeklyViewModel({ ...base, deadlines: [stale] }, new Date(2026, 6, 22, 12));
		expect(model.overdue).toEqual([stale]);
		expect(model.nextUp).toMatchObject({ kind: 'deadline', status: 'Overdue by 1 day' });
	});

	it('does not present unknown grade weight as zero', () => {
		const model = buildWeeklyViewModel({
			...base,
			deadlines: [deadline({ gradeWeight: null })]
		});
		expect(model.metrics[1]).toMatchObject({ value: '—', detail: 'Not provided' });
	});

	it('deduplicates courses in focus', () => {
		const model = buildWeeklyViewModel({
			...base,
			deadlines: [deadline(), deadline({ id: 'd2', title: 'Quiz' })]
		});
		expect(model.metrics[2].value).toBe('1');
	});

	it('falls back to the first priority when there are no deadlines', () => {
		const priority: WeeklyDigest['priorities'][number] = {
			id: 'p1',
			kind: 'practice',
			rank: 1,
			score: 25,
			factors: ['session is paused'],
			reason: 'Resume practice.',
			courseCode: 'CSIS 3560',
			title: 'Practice session',
			dueDate: null,
			link: { href: '/app/practice', label: 'Open practice' }
		};
		const model = buildWeeklyViewModel({ ...base, priorities: [priority] });
		expect(model.nextUp).toMatchObject({ kind: 'priority', priority });
	});
});
