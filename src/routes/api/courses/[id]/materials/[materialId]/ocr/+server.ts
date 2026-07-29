import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';
import { getMaterialRecord, getMaterialRecordFallback } from '$lib/server/r2';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { chunksForExtractedPages } from '$lib/server/practice/retrieval';
import { createSemanticPipeline, indexChunksSemantically } from '$lib/server/practice/embeddings';
import { MAX_OCR_IMAGE_BASE64_CHARS, transcribePageImage } from '$lib/server/practice/ocr';

// Receives one browser-rendered PDF page image, transcribes it with a vision
// model, and persists the text through the same chunk pipeline as extraction.
// The browser renders pages because Workers have no canvas; the client loops
// page by page and sends done:true on the final page.
const MAX_OCR_PAGES = 100;

export async function POST({ params, request, platform, locals }: RequestEvent) {
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

	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}
	const { pageNumber, image, done } = body as {
		pageNumber?: unknown;
		image?: unknown;
		done?: unknown;
	};
	if (typeof pageNumber !== 'number' || !Number.isInteger(pageNumber) || pageNumber < 1) {
		return json({ ok: false, error: 'pageNumber must be a positive integer' }, { status: 400 });
	}
	if (typeof image !== 'string' || image.length === 0) {
		return json({ ok: false, error: 'image must be a base64 string' }, { status: 400 });
	}
	if (image.length > MAX_OCR_IMAGE_BASE64_CHARS) {
		return json({ ok: false, error: 'Page image is too large' }, { status: 413 });
	}
	const isFinal = done === true;

	const apiKey = platform?.env?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
	const model = platform?.env?.OCR_MODEL || process.env.OCR_MODEL || '';
	if (!apiKey || !model) {
		return json({ ok: false, error: 'OCR is not configured' }, { status: 503 });
	}

	const repository = createMaterialIndexRepository(platform?.env?.BRIEF_DB);
	const record = await repository.ensure(userId, material);
	if (record.status === 'ready') {
		return json({ ok: true, index: record, transcribed: false });
	}
	if (record.status !== 'needs_ocr' && record.status !== 'indexing') {
		return json(
			{ ok: false, error: 'This material cannot be OCR indexed', index: record },
			{ status: 422 }
		);
	}
	if (pageNumber !== record.nextPage) {
		return json(
			{ ok: false, error: 'OCR pages must be submitted in order', index: record },
			{ status: 409 }
		);
	}
	if (pageNumber > (record.pageCount ?? MAX_OCR_PAGES)) {
		return json({ ok: false, error: 'OCR page limit exceeded', index: record }, { status: 422 });
	}

	let text: string;
	try {
		text = await transcribePageImage(image, 'image/jpeg', { apiKey, model });
	} catch (cause) {
		console.error('OCR transcription failed:', cause);
		return json({ ok: false, error: 'Transcription failed. Retry this page.' }, { status: 502 });
	}

	if (!text) {
		const pageCount = record.pageCount ?? pageNumber;
		const status = isFinal ? (record.characterCount > 0 ? 'ready' : 'needs_ocr') : 'indexing';
		const index = await repository.saveBatch(userId, {
			materialId: material.id,
			courseId: material.courseId,
			pageCount,
			nextPage: pageNumber + 1,
			characterCount: record.characterCount,
			status,
			chunks: []
		});
		return json({ ok: true, index, transcribed: false });
	}

	const chunks = chunksForExtractedPages([{ pageNumber, text }], {
		id: material.id,
		courseId: material.courseId
	});
	const characterCount =
		record.characterCount + chunks.reduce((total, chunk) => total + chunk.text.length, 0);
	const pageCount = record.pageCount ?? pageNumber;
	const status = isFinal ? 'ready' : 'indexing';
	const index = await repository.saveBatch(userId, {
		materialId: material.id,
		courseId: material.courseId,
		pageCount,
		nextPage: isFinal ? pageCount + 1 : pageNumber + 1,
		characterCount,
		status,
		chunks
	});
	await indexChunksSemantically(createSemanticPipeline(platform?.env ?? {}), chunks);
	return json({ ok: true, index, transcribed: true });
}
