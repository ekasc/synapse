import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { addStudySession, getStudySessions } from '$lib/server/store';
import { parseStudySession } from '$lib/server/study-timer';

export async function GET({ url }: RequestEvent) {
	return json(await getStudySessions(Number(url.searchParams.get('limit') ?? 20)));
}

export async function POST({ request }: RequestEvent) {
	const session = parseStudySession(await request.json());
	if (!session) return json({ error: 'Invalid study session' }, { status: 400 });
	return json(await addStudySession(session), { status: 201 });
}
