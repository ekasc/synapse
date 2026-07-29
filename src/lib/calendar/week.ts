export type Clock = () => Date;

export const defaultClock: Clock = () => new Date();

let activeClock: Clock = defaultClock;

export function setClock(clock: Clock): () => void {
	const previous = activeClock;
	activeClock = clock;
	return () => {
		activeClock = previous;
	};
}

export function now(): Date {
	return activeClock();
}

/**
 * ISO 8601 week number (1–53).
 * Weeks start Monday; week 1 contains the first Thursday of the year.
 * Defaults to the current date via the injectable clock.
 */
export function weekNumber(date?: Date): number {
	const d = new Date(date ?? now());
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
	const w1 = new Date(d.getFullYear(), 0, 4);
	return (
		1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
	);
}

/** Format a Date as "MMM DD" (e.g. "Jan 05"). */
export function formatShortDate(date: Date): string {
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
}

/** Positive if b is after a, rounded to whole days. */
export function daysBetween(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / 86400000);
}
