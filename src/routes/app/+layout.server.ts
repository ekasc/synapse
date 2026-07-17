import { getSemesters, getCourses } from '$lib/server/store';

export async function load() {
	const semesters = (await getSemesters()).sort((a, b) => b.order - a.order);
	const courses = (await getCourses()).sort((a, b) => a.code.localeCompare(b.code));
	const countsById = courses.reduce<Record<string, number>>((counts, course) => {
		counts[course.semesterId] = (counts[course.semesterId] ?? 0) + 1;
		return counts;
	}, {});
	return { semesters, courses, countsById };
}
