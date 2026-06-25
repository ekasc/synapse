import { getSemesters, getCourses } from '$lib/server/store';

export function load() {
	const semesters = getSemesters().sort((a, b) => b.order - a.order);
	const courses = getCourses();

	const countsById: Record<string, number> = {};
	for (const c of courses) {
		countsById[c.semesterId] = (countsById[c.semesterId] ?? 0) + 1;
	}

	return { semesters, courses, countsById };
}
