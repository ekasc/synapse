import { error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import {
	attachMaterialIndexes,
	createMaterialIndexRepository
} from '$lib/server/practice/material-index';

export async function load({ params, platform }: RequestEvent) {
	const course = (await getCourses()).find(
		(item) => item.id === params.courseId && item.semesterId === params.semesterId
	);
	if (!course) error(404, 'Course not found in this semester');

	const boundMaterials = platform?.env?.MATERIALS
		? await listMaterials(platform.env.MATERIALS, course.id)
		: [];
	const materials = boundMaterials.length > 0 ? boundMaterials : listMaterialsFallback(course.id);
	materials.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
	const indexedMaterials = await attachMaterialIndexes(
		materials,
		createMaterialIndexRepository(platform?.env?.BRIEF_DB)
	);

	return { course, materials: indexedMaterials };
}
