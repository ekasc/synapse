import { json, type RequestEvent } from '@sveltejs/kit';
import { getLatestAcademicDigestJob } from '$lib/server/store';

export async function GET({ locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	return json({ ok: true, job: await getLatestAcademicDigestJob(userId) });
}
