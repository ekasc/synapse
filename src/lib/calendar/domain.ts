export type CalendarDate = { year: number; month: number; date: number };
export type CalendarStatus = string | null | undefined;
export type DatedEvent = CalendarDate & { status?: CalendarStatus };

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
	return a.year - b.year || a.month - b.month || a.date - b.date;
}

export function isEventOverdue(event: DatedEvent, today: CalendarDate): boolean {
	return event.status !== 'completed' && compareCalendarDates(event, today) < 0;
}

export function upcomingEvents<T extends DatedEvent>(events: T[], today: CalendarDate): T[] {
	return events
		.filter((event) => event.status !== 'completed' && compareCalendarDates(event, today) >= 0)
		.sort(compareCalendarDates);
}

export function weekDates(anchor: CalendarDate): CalendarDate[] {
	const anchorDate = new Date(anchor.year, anchor.month, anchor.date);
	const start = new Date(anchorDate);
	start.setDate(anchorDate.getDate() - anchorDate.getDay());
	return Array.from({ length: 7 }, (_, offset) => {
		const day = new Date(start);
		day.setDate(start.getDate() + offset);
		return { year: day.getFullYear(), month: day.getMonth(), date: day.getDate() };
	});
}

export function shiftCalendarDate(anchor: CalendarDate, days: number): CalendarDate {
	const date = new Date(anchor.year, anchor.month, anchor.date);
	date.setDate(date.getDate() + days);
	return { year: date.getFullYear(), month: date.getMonth(), date: date.getDate() };
}

export type WeightedEvent = { courseCode: string; gradeWeight: number | null };

export function gradeWeightByCourse(
	events: WeightedEvent[]
): { courseCode: string; weight: number }[] {
	const totals = new Map<string, number>();
	for (const event of events) {
		if (event.gradeWeight == null || event.gradeWeight <= 0) continue;
		totals.set(event.courseCode, (totals.get(event.courseCode) ?? 0) + event.gradeWeight);
	}
	return [...totals]
		.map(([courseCode, weight]) => ({ courseCode, weight }))
		.sort((a, b) => b.weight - a.weight);
}
