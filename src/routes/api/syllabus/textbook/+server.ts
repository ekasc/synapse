import { json, type RequestEvent } from '@sveltejs/kit';
import { updateSyllabusTextbook } from '$lib/server/store';

function getFileName(value: unknown) {
	if (typeof value !== 'object' || value === null) return 'textbook.pdf';
	const fileName = (value as { fileName?: unknown }).fileName;
	return typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'textbook.pdf';
}

function getCourseId(value: unknown) {
	if (typeof value !== 'object' || value === null) return undefined;
	const courseId = (value as { courseId?: unknown }).courseId;
	return typeof courseId === 'string' && courseId.trim() ? courseId.trim() : undefined;
}

export async function POST({ request }: RequestEvent) {
	const body: unknown = await request.json().catch(() => ({}));
	return json(updateSyllabusTextbook(getFileName(body), getCourseId(body)));
}
