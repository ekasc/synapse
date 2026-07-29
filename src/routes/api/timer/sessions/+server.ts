import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { addStudySession, getStudySessions } from '$lib/server/store';
import { parseStudySession } from '$lib/server/study-timer';

export async function GET({ url, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await getStudySessions(userId, Number(url.searchParams.get('limit') ?? 20)));
}

export async function POST({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	const session = parseStudySession(await request.json());
	if (!session) return json({ error: 'Invalid study session' }, { status: 400 });
	return json(await addStudySession(userId, session), { status: 201 });
}
