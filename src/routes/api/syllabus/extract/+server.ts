import { json, type RequestEvent } from '@sveltejs/kit';
import { mockExtractSyllabus } from '$lib/server/store';

function getFileName(value: unknown) {
	if (typeof value !== 'object' || value === null) return 'CSIS 4495 Syllabus.pdf';
	const fileName = (value as { fileName?: unknown }).fileName;
	return typeof fileName === 'string' && fileName.trim()
		? fileName.trim()
		: 'CSIS 4495 Syllabus.pdf';
}

export async function POST({ request }: RequestEvent) {
	const body: unknown = await request.json().catch(() => ({}));
	return json(mockExtractSyllabus(getFileName(body)));
}
