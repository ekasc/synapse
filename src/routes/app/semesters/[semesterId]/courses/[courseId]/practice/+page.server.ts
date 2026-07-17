import { error } from '@sveltejs/kit';
import { getCourses } from '$lib/server/store';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import {
	attachMaterialIndexes,
	createMaterialIndexRepository
} from '$lib/server/practice/material-index';
import type { RequestEvent } from './$types';

export async function load({ params, platform }: RequestEvent) {
	const courses = await getCourses();
	const course = courses.find(
		(item) => item.id === params.courseId && item.semesterId === params.semesterId
	);
	if (!course) error(404, 'Course not found in this semester');

	const materials = platform?.env?.MATERIALS
		? await listMaterials(platform.env.MATERIALS, course.id)
		: await listMaterialsFallback(course.id);
	const indexedMaterials = await attachMaterialIndexes(
		materials,
		createMaterialIndexRepository(platform?.env?.BRIEF_DB)
	);
	const readyMaterials = indexedMaterials
		.filter((material) => material.index.status === 'ready')
		.map((material) => ({ id: material.id, fileName: material.fileName }));
	const readyMaterialCount = readyMaterials.length;
	const indexingMaterialCount = indexedMaterials.filter((material) =>
		['pending', 'indexing'].includes(material.index.status)
	).length;

	return {
		courses: [
			{
				id: course.id,
				code: course.code,
				name: course.name,
				materialCount: materials.length,
				readyMaterialCount,
				indexingMaterialCount,
				readyMaterials
			}
		]
	};
}
