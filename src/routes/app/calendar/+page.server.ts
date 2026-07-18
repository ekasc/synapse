import { getCourses } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import type { CalendarEventRow } from '$lib/server/db/d1';
import type { RequestEvent } from './$types';

type CourseColor = { id: string; code: string; color: string; name: string };

export async function load(event: RequestEvent) {
	const courses = await getCourses();

	let manualEvents: CalendarEventRow[] = [];
	if (event.platform) {
		try {
			const db = createDb(event.platform.env.BRIEF_DB);
			manualEvents = await db.getCalendarEvents();
		} catch (err) {
			console.error('Failed to load manual events:', err);
		}
	}

	const courseColors: CourseColor[] = courses.map((c) => ({
		id: c.id,
		code: c.code,
		color: c.color ?? '#1a1814',
		name: c.name
	}));

	return { events: manualEvents, courseColors };
}
