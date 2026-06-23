import { json, type RequestEvent } from '@sveltejs/kit';
import { updateSyllabusTextbook } from '$lib/server/store';

function getFileName(value: unknown) {
	if (typeof value !== 'object' || value === null) return 'textbook.pdf';
	const fileName = (value as { fileName?: unknown }).fileName;
	return typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'textbook.pdf';
}

export async function POST({ request }: RequestEvent) {
	const body: unknown = await request.json().catch(() => ({}));
	return json(updateSyllabusTextbook(getFileName(body)));
}
