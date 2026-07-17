import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';
import {
	getMaterialBytes,
	getMaterialBytesFallback,
	getMaterialRecord,
	getMaterialRecordFallback
} from '$lib/server/r2';
import {
	createMaterialIndexRepository,
	PDF_BATCH_SIZE,
	PDF_PAGE_LIMIT
} from '$lib/server/practice/material-index';
import { chunksForExtractedPages, extractPageBatch } from '$lib/server/practice/retrieval';

function safeExtractionError(cause: unknown): string {
	const message = cause instanceof Error ? cause.message.toLocaleLowerCase() : '';
	if (message.includes('password')) return 'This PDF is password protected.';
	if (message.includes('invalid pdf') || message.includes('missing pdf'))
		return 'This PDF could not be read.';
	return 'Text extraction failed. Retry indexing or upload a different file.';
}

export async function POST({ params, platform }: RequestEvent) {
	if (!(await getCourses()).some((course) => course.id === params.id)) {
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
	let index = await repository.ensure(material);
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
		index = await repository.setStatus(material.id, material.courseId, 'indexing');
		const mimeType =
			material.mimeType === 'application/pdf' || material.fileName.toLowerCase().endsWith('.pdf')
				? 'application/pdf'
				: material.mimeType;
		const batch = await extractPageBatch(bytes, mimeType, index.nextPage, PDF_BATCH_SIZE);
		if (batch.pageCount > PDF_PAGE_LIMIT) {
			index = await repository.setStatus(material.id, material.courseId, 'too_large', {
				pageCount: batch.pageCount,
				errorMessage: `PDFs are limited to ${PDF_PAGE_LIMIT.toLocaleString()} pages.`
			});
			return json({ ok: false, error: index.errorMessage, index }, { status: 422 });
		}

		const chunks = chunksForExtractedPages(batch.pages, {
			id: material.id,
			courseId: material.courseId
		});
		const characterCount =
			index.characterCount + chunks.reduce((total, chunk) => total + chunk.text.length, 0);
		const complete = batch.endPage >= batch.pageCount;
		const status = complete ? (characterCount === 0 ? 'needs_ocr' : 'ready') : 'indexing';
		index = await repository.saveBatch({
			materialId: material.id,
			courseId: material.courseId,
			pageCount: batch.pageCount,
			nextPage: complete ? batch.pageCount + 1 : batch.endPage + 1,
			characterCount,
			status,
			chunks
		});
		return json({ ok: true, index });
	} catch (cause) {
		console.error('Material indexing failed:', cause);
		const message = safeExtractionError(cause);
		index = await repository.setStatus(material.id, material.courseId, 'failed', {
			errorMessage: message
		});
		return json({ ok: false, error: message, index }, { status: 422 });
	}
}
