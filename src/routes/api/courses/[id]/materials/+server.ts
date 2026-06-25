import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	addMaterial,
	deleteMaterial,
	getCourses,
	getMaterial,
	getMaterials
} from '$lib/server/store';

export const GET: RequestHandler = ({ params }) => {
	if (!getCourses().some((c) => c.id === params.id)) error(404, 'Course not found');
	return json(getMaterials(params.id));
};

export const POST: RequestHandler = async ({ params, request }) => {
	if (!getCourses().some((c) => c.id === params.id)) error(404, 'Course not found');

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ ok: false, error: 'Expected multipart form data' }, { status: 400 });
	}

	const file = formData.get('file');
	if (!(file instanceof File) || file.size === 0) {
		return json({ ok: false, error: 'No file provided' }, { status: 400 });
	}

	const material = await addMaterial(params.id, file);
	return json({ ok: true, material });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!getCourses().some((c) => c.id === params.id)) error(404, 'Course not found');

	const body: unknown = await request.json().catch(() => null);
	const id =
		body &&
		typeof body === 'object' &&
		'id' in body &&
		typeof (body as { id: unknown }).id === 'string'
			? (body as { id: string }).id
			: null;

	if (!id) return json({ ok: false, error: 'Material id required' }, { status: 400 });

	const target = getMaterial(id);
	if (!target) return json({ ok: false, error: 'Material not found' }, { status: 404 });
	if (target.courseId !== params.id) {
		return json({ ok: false, error: 'Material does not belong to this course' }, { status: 400 });
	}
	deleteMaterial(id);
	return json({ ok: true });
};
