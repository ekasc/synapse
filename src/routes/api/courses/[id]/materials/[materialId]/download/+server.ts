import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCourses, getMaterial, readMaterialBytes } from '$lib/server/store';

export const GET: RequestHandler = ({ params }) => {
	if (!getCourses().some((c) => c.id === params.id)) error(404, 'Course not found');

	const material = getMaterial(params.materialId);
	if (!material) error(404, 'Material not found');
	if (material.courseId !== params.id) error(404, 'Material not found');

	const bytes = readMaterialBytes(material);
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': material.mimeType,
			'Content-Disposition': `attachment; filename="${material.fileName}"`,
			'Content-Length': String(material.size),
			'Cache-Control': 'private, max-age=0, no-store'
		}
	});
};
