import { getCourses } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import type { CalendarEventRow } from '$lib/server/db/d1';
import { completePastCalendarEvents } from '$lib/server/calendar/complete-past-events';
import type { RequestEvent } from './$types';

type CourseColor = { id: string; code: string; color: string; name: string };

async function loadManualEvents(event: RequestEvent, userId: string): Promise<CalendarEventRow[]> {
	if (!event.platform) return [];
	try {
		const binding = event.platform.env.BRIEF_DB;
		await completePastCalendarEvents(binding);
		return await createDb(binding).getCalendarEvents(userId);
	} catch (err) {
		console.error('Failed to load manual events:', err);
		return [];
	}
}

export async function load(event: RequestEvent) {
	const userId = event.locals.user?.id;
	if (!userId) return { events: [], courseColors: [] };
	const [courses, manualEvents] = await Promise.all([
		getCourses(userId),
		loadManualEvents(event, userId)
	]);

	const courseColors: CourseColor[] = courses.map((c) => ({
		id: c.id,
		code: c.code,
		color: c.color ?? '#1a1814',
		name: c.name
	}));

	return { events: manualEvents, courseColors };
}
