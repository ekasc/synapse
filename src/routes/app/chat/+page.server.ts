import { getCourses } from '$lib/server/store';

export async function load(event) {
	const userId = event.locals.user?.id;
	if (!userId) return { courses: [] };
	return { courses: await getCourses(userId) };
}
