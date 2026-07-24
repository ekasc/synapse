import { describe, expect, it } from 'vitest';
import { startOfWeeklyPlan, weeklyPlanKey } from './weekly-digest-data';

describe('weekly plan week identity', () => {
	it('uses Sunday as the first day of the week', () => {
		const sunday = new Date(2026, 6, 19, 8, 30);
		expect(weeklyPlanKey(sunday)).toBe('2026-07-19');
		expect(startOfWeeklyPlan(sunday).getHours()).toBe(0);
	});

	it('keeps every day through Saturday in the same week', () => {
		expect(weeklyPlanKey(new Date(2026, 6, 20, 12))).toBe('2026-07-19');
		expect(weeklyPlanKey(new Date(2026, 6, 25, 23, 59))).toBe('2026-07-19');
	});

	it('rolls over at the following Sunday', () => {
		expect(weeklyPlanKey(new Date(2026, 6, 26, 0, 0))).toBe('2026-07-26');
	});

	it('handles a year boundary', () => {
		expect(weeklyPlanKey(new Date(2027, 0, 1, 12))).toBe('2026-12-27');
		expect(weeklyPlanKey(new Date(2027, 0, 3, 12))).toBe('2027-01-03');
	});
});
