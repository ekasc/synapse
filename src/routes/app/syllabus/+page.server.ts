import { getCourses, getSemesters } from '$lib/server/store';

export async function load() {
	const [courses, semesters] = await Promise.all([getCourses(), getSemesters()]);
	return {
		courses,
		semesters
	};
}
