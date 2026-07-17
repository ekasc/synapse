import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';
import {
	listMaterials,
	uploadMaterial,
	updateMaterialRecord,
	deleteMaterialRecord,
	getMaterialRecord,
	listMaterialsFallback,
	uploadMaterialFallback,
	updateMaterialRecordFallback,
	deleteMaterialRecordFallback,
	getMaterialRecordFallback
} from '$lib/server/r2';
import {
	attachMaterialIndexes,
	createMaterialIndexRepository
} from '$lib/server/practice/material-index';

function getBackend(event: { platform?: Readonly<App.Platform> | undefined }) {
	const bucket = event.platform?.env?.MATERIALS;
	if (bucket) {
		return {
			list: (courseId?: string) => listMaterials(bucket, courseId),
			upload: (courseId: string, file: File) => uploadMaterial(bucket, courseId, file),
			update: (id: string, updates: { fileName?: string }) =>
				updateMaterialRecord(bucket, id, updates),
			delete: (id: string) => deleteMaterialRecord(bucket, id),
			getRecord: (id: string) => getMaterialRecord(bucket, id)
		};
	}
	return {
		list: (courseId?: string) => listMaterialsFallback(courseId),
		upload: (courseId: string, file: File) => uploadMaterialFallback(courseId, file),
		update: (id: string, updates: { fileName?: string }) =>
			updateMaterialRecordFallback(id, updates),
		delete: (id: string) => deleteMaterialRecordFallback(id),
		getRecord: (id: string) => getMaterialRecordFallback(id)
	};
}

const MAX_MATERIAL_BYTES = 50 * 1024 * 1024; // 50 MB

export async function GET({ params, platform }: RequestEvent) {
	if (!(await getCourses()).some((c) => c.id === params.id)) error(404, 'Course not found');
	const items = await getBackend({ platform }).list(params.id);
	const indexedItems = await attachMaterialIndexes(
		items,
		createMaterialIndexRepository(platform?.env?.BRIEF_DB)
	);
	return json(indexedItems);
}

export async function POST({ params, request, platform }: RequestEvent) {
	if (!(await getCourses()).some((c) => c.id === params.id)) error(404, 'Course not found');

	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (Number.isFinite(contentLength) && contentLength > MAX_MATERIAL_BYTES) {
		return json(
			{ ok: false, error: `File too large. Limit is ${MAX_MATERIAL_BYTES / (1024 * 1024)} MB.` },
			{ status: 413 }
		);
	}

	const formData = await request.formData().catch(() => null);
	if (!formData) {
		return json({ ok: false, error: 'Expected multipart form data' }, { status: 400 });
	}

	const file = formData.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return json({ ok: false, error: 'No file provided' }, { status: 400 });
	}
	if (file.size > MAX_MATERIAL_BYTES) {
		return json(
			{ ok: false, error: `File too large. Limit is ${MAX_MATERIAL_BYTES / (1024 * 1024)} MB.` },
			{ status: 413 }
		);
	}

	const material = await getBackend({ platform }).upload(params.id, file);
	const index = await createMaterialIndexRepository(platform?.env?.BRIEF_DB).ensure(material);
	return json({ ok: true, material: { ...material, index } });
}

export async function PATCH({ params, request, platform }: RequestEvent) {
	if (!(await getCourses()).some((c) => c.id === params.id)) error(404, 'Course not found');

	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}

	const { id, fileName } = body as Record<string, unknown>;
	if (typeof id !== 'string') {
		return json({ ok: false, error: 'Material id required' }, { status: 400 });
	}
	if (typeof fileName !== 'string' || fileName.trim().length === 0) {
		return json({ ok: false, error: 'fileName required' }, { status: 400 });
	}

	const backend = getBackend({ platform });
	const target = await backend.getRecord(id);
	if (!target) return json({ ok: false, error: 'Material not found' }, { status: 404 });
	if (target.courseId !== params.id) {
		return json({ ok: false, error: 'Material does not belong to this course' }, { status: 400 });
	}

	const updated = await backend.update(id, { fileName: fileName.trim() });
	return json({ ok: true, material: updated });
}

export async function DELETE({ params, request, platform }: RequestEvent) {
	if (!(await getCourses()).some((c) => c.id === params.id)) error(404, 'Course not found');

	const body: unknown = await request.json().catch(() => null);
	const id =
		body &&
		typeof body === 'object' &&
		'id' in body &&
		typeof (body as { id: unknown }).id === 'string'
			? (body as { id: string }).id
			: null;

	if (!id) return json({ ok: false, error: 'Material id required' }, { status: 400 });

	const backend = getBackend({ platform });
	const target = await backend.getRecord(id);
	if (!target) return json({ ok: false, error: 'Material not found' }, { status: 404 });
	if (target.courseId !== params.id) {
		return json({ ok: false, error: 'Material does not belong to this course' }, { status: 400 });
	}

	await createMaterialIndexRepository(platform?.env?.BRIEF_DB).delete(id);
	await backend.delete(id);
	return json({ ok: true });
}
