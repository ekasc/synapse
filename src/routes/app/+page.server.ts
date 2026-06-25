import { getSemesters, getCourses, getGraphState } from '$lib/server/store';

export function load() {
	const semesters = getSemesters().sort((a, b) => b.order - a.order);
	const courses = getCourses();
	const graph = getGraphState();
	return { semesters, courses, graph };
}
