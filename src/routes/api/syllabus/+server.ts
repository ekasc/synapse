import { json, type RequestEvent } from '@sveltejs/kit';
import { clearSyllabusImport, getSyllabusImport } from '$lib/server/store';

export async function GET({ url, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await getSyllabusImport(userId, url.searchParams.get('courseId') ?? undefined));
}

export async function DELETE({ url, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await clearSyllabusImport(userId, url.searchParams.get('courseId') ?? undefined));
}
