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
	displayTitle: 'Assignment 3',
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
	});

	it('recalculates urgency when a cached plan is viewed later', () => {
		const stale = deadline({ daysUntil: 2, overdue: false });
		const model = buildWeeklyViewModel({ ...base, deadlines: [stale] }, new Date(2026, 6, 22, 12));
		expect(model.overdue).toEqual([stale]);
	});

	it('does not present unknown grade weight as zero', () => {
		const model = buildWeeklyViewModel({
			...base,
			deadlines: [deadline({ gradeWeight: null })]
		});
		expect(model.metrics[1]).toMatchObject({ value: '—', detail: 'Not provided' });
	});

	it('reads weights from the title when the event has no explicit weight', () => {
		const model = buildWeeklyViewModel({
			...base,
			deadlines: [
				deadline({
					gradeWeight: null,
					title: 'Project Defense (20%) and Final report & implementation (40%) due'
				})
			]
		});
		expect(model.metrics[1]).toMatchObject({ value: '60%', detail: 'Across listed work' });
	});

	it('deduplicates courses in focus', () => {
		const model = buildWeeklyViewModel({
			...base,
			deadlines: [deadline(), deadline({ id: 'd2', title: 'Quiz' })]
		});
		expect(model.metrics[2].value).toBe('1');
	});

	it('heals digests stored before displayTitle existed (generic titles)', () => {
		const stale = deadline({
			dueDate: '2026-07-21',
			title: 'Class',
			typeLabel: 'Midterm',
			// simulate an old stored digest: displayTitle missing
			displayTitle: undefined as unknown as string
		});
		const model = buildWeeklyViewModel({ ...base, deadlines: [stale] }, new Date(2026, 6, 19, 12));
		const healed = model.days.flatMap((day) => day.deadlines).find((d) => d.id === stale.id);
		expect(healed?.displayTitle).toBe('Midterm');
	});
});
