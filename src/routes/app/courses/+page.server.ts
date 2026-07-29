import { getSemesters, getCourses, getGraphState } from '$lib/server/store';

export async function load(event: { locals: App.Locals }) {
	const userId = event.locals.user?.id;
	if (!userId) return { courses: [], semesters: [], graph: { positions: {}, edges: [] } };
	const [semesters, courses, graph] = await Promise.all([
		getSemesters(userId).then((s) => s.sort((a, b) => b.order - a.order)),
		getCourses(userId),
		getGraphState(userId)
	]);
	return {
		semesters,
		courses,
		graph
	};
}
