import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCourses } from '$lib/server/store';
import {
	getMaterialRecord,
	getMaterialStream,
	getMaterialRecordFallback,
	getMaterialStreamFallback
} from '$lib/server/r2';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!getCourses().some((c) => c.id === params.id)) error(404, 'Course not found');

	const bucket = platform?.env?.MATERIALS;

	let material;
	if (bucket) {
		material = await getMaterialRecord(bucket, params.materialId);
	} else {
		material = getMaterialRecordFallback(params.materialId);
	}

	if (!material) error(404, 'Material not found');
	if (material.courseId !== params.id) error(404, 'Material not found');

	if (bucket) {
		const stream = await getMaterialStream(bucket, material);
		if (!stream) error(404, 'Material content not found');
		return new Response(stream, {
			headers: {
				'Content-Type': material.mimeType,
				'Content-Disposition': `attachment; filename="${material.fileName}"`,
				'Content-Length': String(material.size),
				'Cache-Control': 'private, max-age=3600'
			}
		});
	}

	// Fallback: read from local filesystem
	const bytes = getMaterialStreamFallback(material);
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': material.mimeType,
			'Content-Disposition': `attachment; filename="${material.fileName}"`,
			'Content-Length': String(material.size),
			'Cache-Control': 'private, max-age=0, no-store'
		}
	});
};
