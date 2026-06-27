import { getSemesters, getCourses, getGraphState } from '$lib/server/store';

export async function load() {
	const [courses, graph] = await Promise.all([getCourses(), getGraphState()]);
	return {
		courses,
		graph
	};
}
