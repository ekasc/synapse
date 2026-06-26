import { error } from '@sveltejs/kit';
import { getCourses, getGraphState, getSemesters } from '$lib/server/store';
import {
	listMaterials,
	listMaterialsFallback
} from '$lib/server/r2';

export async function load({ params, platform }) {
	const courses = getCourses();
	const course = courses.find((c) => c.id === params.id);
	if (!course) {
		error(404, 'Course not found');
	}

	const semesters = getSemesters();
	const semester = semesters.find((s) => s.id === course.semesterId) ?? null;

	const graph = getGraphState();
	const edges = graph.edges.filter((e) => e.source === course.id || e.target === course.id);

	const incoming = edges.filter((e) => e.target === course.id);
	const outgoing = edges.filter((e) => e.source === course.id);

	const bucket = platform?.env?.MATERIALS;
	const materials = bucket
		? await listMaterials(bucket, course.id)
		: listMaterialsFallback(course.id);

	materials.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

	return {
		course,
		semester,
		semesters,
		edges,
		incoming,
		outgoing,
		materials,
		courses: courses.filter(
			(c) =>
				c.id !== course.id &&
				(incoming.some((e) => e.source === c.id) || outgoing.some((e) => e.target === c.id))
		)
	};
}
