import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import { validateGenerateRequest, ValidationError } from '$lib/server/practice/schema';
import { indexedChunksToContext, selectIndexedChunks } from '$lib/server/practice/retrieval';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { generatePracticeMaterials } from '$lib/server/practice/generation';

export async function POST({ request, platform }: RequestEvent) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	let courseId: string;
	let topic: string | undefined;
	let materialIds: string[] | undefined;
	try {
		({ courseId, topic, materialIds } = validateGenerateRequest(body));
	} catch (err) {
		if (err instanceof ValidationError) {
			return json({ ok: false, error: err.message }, { status: 422 });
		}
		throw err;
	}

	const course = (await getCourses()).find((candidate) => candidate.id === courseId);
	if (!course) {
		return json({ ok: false, error: 'Course not found' }, { status: 404 });
	}

	const apiKey = platform?.env?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		console.error('OPENROUTER_API_KEY is not configured');
		return json({ ok: false, error: 'Generation service unavailable' }, { status: 500 });
	}

	const model = platform?.env?.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || undefined;

	const records = platform?.env?.MATERIALS
		? await listMaterials(platform.env.MATERIALS, courseId)
		: listMaterialsFallback(courseId);
	if (records.length === 0) {
		return json({ ok: false, error: 'No materials found for this course' }, { status: 422 });
	}

	const repository = createMaterialIndexRepository(platform?.env?.BRIEF_DB);
	const courseMaterialIds = new Set(records.map((record) => record.id));
	if (materialIds?.some((materialId) => !courseMaterialIds.has(materialId))) {
		return json(
			{ ok: false, error: 'A selected material does not belong to this course' },
			{ status: 422 }
		);
	}
	if (materialIds) {
		const indexes = await repository.list(courseId);
		const readyIds = new Set(
			indexes.filter((index) => index.status === 'ready').map((index) => index.materialId)
		);
		if (materialIds.some((materialId) => !readyIds.has(materialId))) {
			return json(
				{ ok: false, error: 'Every selected material must finish indexing first' },
				{ status: 422 }
			);
		}
	}
	const selectedMaterialIds = new Set(materialIds ?? records.map((record) => record.id));
	const chunks = (await repository.listReadyChunks(courseId)).filter(
		(chunk) => courseMaterialIds.has(chunk.materialId) && selectedMaterialIds.has(chunk.materialId)
	);
	if (chunks.length === 0) {
		return json(
			{ ok: false, error: 'No indexed materials are ready for Practice' },
			{ status: 422 }
		);
	}
	const selectedChunks = selectIndexedChunks(chunks, topic, topic ? 16_000 : undefined);
	if (selectedChunks.length === 0) {
		return json({ ok: false, error: 'No indexed passages matched this topic' }, { status: 422 });
	}
	const fileNames = new Map(records.map((record) => [record.id, record.fileName]));
	const context = indexedChunksToContext(selectedChunks, fileNames);

	let result;
	try {
		result = await generatePracticeMaterials(context, {
			apiKey,
			model,
			courseCode: course.code,
			...(topic ? { focusTopic: topic } : {})
		});
	} catch (err) {
		console.error('Generation error:', err);
		if (err instanceof ValidationError) {
			console.error('Generation validation error:', err.message);
			return json(
				{
					ok: false,
					error: 'Generated output failed validation',
					reason: err.message
				},
				{ status: 502 }
			);
		}
		return json({ ok: false, error: 'Failed to generate practice materials' }, { status: 502 });
	}

	return json({ ok: true, ...result });
}
