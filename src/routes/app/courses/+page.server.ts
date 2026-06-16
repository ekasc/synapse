import { getSemesters, getCourses, getGraphState } from '$lib/server/store';

export function load() {
	const semesters = getSemesters().sort((a, b) => a.order - b.order);
	const courses = getCourses();
	const graph = getGraphState();
	return { semesters, courses, graph };
}
