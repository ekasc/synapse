import { json, type RequestEvent } from '@sveltejs/kit';
import { importTranscriptCourses } from '$lib/server/transcript-import';

export async function POST({ locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

	try {
		const imported = await importTranscriptCourses(userId);
		return json({ ok: true, imported });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Transcript import failed';
		return json({ ok: false, error: message }, { status: 400 });
	}
}
