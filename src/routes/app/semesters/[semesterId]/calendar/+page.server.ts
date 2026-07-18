import { error } from '@sveltejs/kit';
import { getCourses, getSemesters } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import type { CalendarEventRow } from '$lib/server/db/d1';
import type { RequestEvent } from './$types';

export async function load({ params, platform }: RequestEvent) {
	const [courses, semesters] = await Promise.all([getCourses(), getSemesters()]);
	if (!semesters.some((item) => item.id === params.semesterId)) {
		error(404, 'Semester not found');
	}

	const semesterCourses = courses.filter((course) => course.semesterId === params.semesterId);
	const courseIds = new Set(semesterCourses.map((course) => course.id));
	let events: CalendarEventRow[] = [];
	if (platform) {
		try {
			events = (await createDb(platform.env.BRIEF_DB).getCalendarEvents()).filter(
				(event) => event.courseId !== null && courseIds.has(event.courseId)
			);
		} catch (cause) {
			console.error('Failed to load semester calendar events:', cause);
		}
	}

	return {
		events,
		courseColors: semesterCourses.map((course) => ({
			id: course.id,
			code: course.code,
			color: course.color ?? '#1a1814',
			name: course.name
		}))
	};
}
