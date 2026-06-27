import { json, type RequestEvent } from '@sveltejs/kit';
import { clearSyllabusImport, getSyllabusImport } from '$lib/server/store';

export async function GET({ url }: RequestEvent) {
	return json(await getSyllabusImport(url.searchParams.get('courseId') ?? undefined));
}

export async function DELETE({ url }: RequestEvent) {
	return json(await clearSyllabusImport(url.searchParams.get('courseId') ?? undefined));
}
