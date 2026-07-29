import { redirect } from '@sveltejs/kit';
import { getSemesters, getCourses } from '$lib/server/store';

export async function load(event: { locals: App.Locals }) {
	const userId = event.locals.user?.id;
	if (!userId) redirect(303, '/auth/error?reason=unauthenticated');
	const semesters = (await getSemesters(userId)).sort((a, b) => b.order - a.order);
	const courses = (await getCourses(userId)).sort((a, b) => a.code.localeCompare(b.code));
	const countsById = courses.reduce<Record<string, number>>((counts, course) => {
		counts[course.semesterId] = (counts[course.semesterId] ?? 0) + 1;
		return counts;
	}, {});
	return { semesters, courses, countsById, user: event.locals.user ?? null };
}
