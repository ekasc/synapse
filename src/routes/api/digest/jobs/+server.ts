import { json } from '@sveltejs/kit';
import { getLatestAcademicDigestJob } from '$lib/server/store';

export async function GET() {
	return json({ ok: true, job: await getLatestAcademicDigestJob() });
}
