import { error } from '@sveltejs/kit';
import { getCourses, getGraphState, getSemesters } from '$lib/server/store';

export async function load({ params }) {
	const courses = await getCourses();
	const course = courses.find(
		(c) => c.id === params.courseId && c.semesterId === params.semesterId
	);
	if (!course) {
		error(404, 'Course not found in this semester');
	}

	const [semesters, graph] = await Promise.all([getSemesters(), getGraphState()]);
	const semester = semesters.find((s) => s.id === course.semesterId) ?? null;

	const edges = graph.edges.filter((e) => e.source === course.id || e.target === course.id);

	const incoming = edges.filter((e) => e.target === course.id);
	const outgoing = edges.filter((e) => e.source === course.id);

	return {
		course,
		semester,
		semesters,
		edges,
		incoming,
		outgoing,
		courses: courses.filter((c) => c.id !== course.id)
	};
}
