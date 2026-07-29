import { json, type RequestEvent } from '@sveltejs/kit';
import { clearAcademicDigest } from '$lib/server/store';

export async function DELETE({ locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	return json({ ok: true, digest: await clearAcademicDigest(userId) });
}
