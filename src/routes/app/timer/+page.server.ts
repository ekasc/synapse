import { getCourses, getFocusPreferences, getStudySessions } from '$lib/server/store';

export async function load(event) {
	const userId = event.locals.user?.id;
	if (!userId) return { courses: [], preferences: null, sessions: [] };
	const [courses, preferences, sessions] = await Promise.all([
		getCourses(userId),
		getFocusPreferences(userId),
		getStudySessions(userId, 10)
	]);
	return { courses, preferences, sessions };
}
