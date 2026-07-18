import { getCourses, getFocusPreferences, getStudySessions } from '$lib/server/store';

export async function load() {
	const [courses, preferences, sessions] = await Promise.all([
		getCourses(),
		getFocusPreferences(),
		getStudySessions(10)
	]);
	return { courses, preferences, sessions };
}
