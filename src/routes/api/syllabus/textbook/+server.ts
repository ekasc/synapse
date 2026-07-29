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

export async function POST({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json().catch(() => ({}));
	return json(updateSyllabusTextbook(userId, getFileName(body), getCourseId(body)));
}
