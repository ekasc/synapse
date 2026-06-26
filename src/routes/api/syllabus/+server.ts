import { json, type RequestEvent } from '@sveltejs/kit';
import { clearSyllabusImport, getSyllabusImport } from '$lib/server/store';

export function GET({ url }: RequestEvent) {
	return json(getSyllabusImport(url.searchParams.get('courseId') ?? undefined));
}

export function DELETE({ url }: RequestEvent) {
	return json(clearSyllabusImport(url.searchParams.get('courseId') ?? undefined));
}
