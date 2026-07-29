import { afterEach, describe, expect, it } from 'vitest';
import { daysBetween, formatShortDate, now, setClock, weekNumber } from './week';

let restoreClock: (() => void) | null = null;

afterEach(() => {
	restoreClock?.();
	restoreClock = null;
});

describe('weekNumber', () => {
	it('uses ISO week numbering across a year boundary', () => {
		expect(weekNumber(new Date(2021, 0, 1))).toBe(53);
		expect(weekNumber(new Date(2021, 0, 4))).toBe(1);
	});

	it('uses the injectable clock when no date is supplied', () => {
		const fixed = new Date(2025, 5, 15, 12);
		restoreClock = setClock(() => fixed);

		expect(now()).toBe(fixed);
		expect(weekNumber()).toBe(24);
	});

	it('restores the previous clock', () => {
		const outer = new Date(2025, 0, 6, 12);
		const restoreOuter = setClock(() => outer);
		const restoreInner = setClock(() => new Date(2025, 5, 15, 12));

		restoreInner();
		expect(now()).toBe(outer);

		restoreOuter();
	});
});

describe('formatShortDate', () => {
	it('formats month abbreviations with a zero-padded day', () => {
		expect(formatShortDate(new Date(2025, 0, 5))).toBe('Jan 05');
		expect(formatShortDate(new Date(2025, 11, 31))).toBe('Dec 31');
	});
});

describe('daysBetween', () => {
	it('returns rounded calendar-day differences in either direction', () => {
		const start = new Date(2025, 5, 15);
		const end = new Date(2025, 5, 18);

		expect(daysBetween(start, end)).toBe(3);
		expect(daysBetween(end, start)).toBe(-3);
	});
});
