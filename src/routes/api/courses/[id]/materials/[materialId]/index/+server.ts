import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';
import {
	getMaterialBytes,
	getMaterialBytesFallback,
	getMaterialRecord,
	getMaterialRecordFallback
} from '$lib/server/r2';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { runMaterialIndexBatch, safeExtractionError } from '$lib/server/practice/indexing';
import { createSemanticPipeline } from '$lib/server/practice/embeddings';

export async function POST({ params, platform, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	if (!(await getCourses(userId)).some((course) => course.id === params.id)) {
		error(404, 'Course not found');
	}

	const bucket = platform?.env?.MATERIALS;
	const material = bucket
		? await getMaterialRecord(bucket, params.materialId)
		: getMaterialRecordFallback(params.materialId);
	if (!material) return json({ ok: false, error: 'Material not found' }, { status: 404 });
	if (material.courseId !== params.id) {
		return json({ ok: false, error: 'Material does not belong to this course' }, { status: 400 });
	}

	const repository = createMaterialIndexRepository(platform?.env?.BRIEF_DB);
	let index = await repository.ensure(userId, material);
	if (index.status === 'ready' || index.status === 'needs_ocr') {
		return json({ ok: true, index });
	}
	if (index.status === 'unsupported' || index.status === 'too_large') {
		return json({ ok: false, error: 'This material cannot be indexed', index }, { status: 422 });
	}

	const bytes = bucket
		? await getMaterialBytes(bucket, material)
		: getMaterialBytesFallback(material);
	if (!bytes) return json({ ok: false, error: 'Material file is missing' }, { status: 404 });

	try {
		index = await runMaterialIndexBatch({
			repository,
			userId,
			material,
			bytes,
			pipeline: createSemanticPipeline(platform?.env ?? {})
		});
		if (index.status === 'too_large') {
			return json({ ok: false, error: index.errorMessage, index }, { status: 422 });
		}
		return json({ ok: true, index });
	} catch (cause) {
		console.error('Material indexing failed:', cause);
		const message = safeExtractionError(cause);
		index = await repository.setStatus(userId, material.id, material.courseId, 'failed', {
			errorMessage: message
		});
		return json({ ok: false, error: message, index }, { status: 422 });
	}
}
