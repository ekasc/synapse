import { getSemesters, getCourses } from '$lib/server/store';

export async function load() {
	const semesters = (await getSemesters()).sort((a, b) => b.order - a.order);
	const courses = await getCourses();
	return { semesters, courses, countsById: {} };
}
