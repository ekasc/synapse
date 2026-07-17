import { getSemesters, getCourses, getGraphState } from '$lib/server/store';

export async function load() {
	const [semesters, courses, graph] = await Promise.all([
		getSemesters().then((s) => s.sort((a, b) => b.order - a.order)),
		getCourses(),
		getGraphState()
	]);
	return {
		semesters,
		courses,
		graph
	};
}
