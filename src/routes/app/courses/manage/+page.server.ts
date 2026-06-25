import { getSemesters, getCourses } from '$lib/server/store';

export function load() {
	const semesters = getSemesters().sort((a, b) => b.order - a.order);
	const courses = getCourses();
	return { semesters, courses };
}
