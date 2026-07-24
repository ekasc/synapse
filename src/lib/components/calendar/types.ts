import type { CalendarEventRow } from '$lib/server/db/d1';

export type CalendarEvent = CalendarEventRow & { course?: string; type: string };

export type ViewMode = 'month' | 'week' | 'day';

export interface CourseColor {
	id: string;
	code: string;
	color: string;
	name: string;
}

export interface CrunchPeriod {
	start: string;
	end: string;
	events: CalendarEvent[];
	weight: number;
	courses: string[];
	days: number;
}

export interface GradeStakesGroup {
	courseCode: string;
	weight: number;
}
