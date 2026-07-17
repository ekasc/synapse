import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createPracticeSessionRepository, type SessionResult } from '$lib/server/practice/sessions';

function response<T>(result: SessionResult<T>, status = 200) {
	if (result.outcome === 'ok') return json({ session: result.value }, { status });
	if (result.outcome === 'validation') return json({ error: result.message }, { status: 400 });
	return json({ error: 'Session not found' }, { status: 404 });
}

async function bodyOf(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

export async function GET({ platform, url }: RequestEvent) {
	if (!platform) return json({ error: 'Service unavailable' }, { status: 500 });
	try {
		const courseId = url.searchParams.get('courseId') ?? undefined;
		const result = await createPracticeSessionRepository(platform.env.BRIEF_DB).list(courseId);
		if (result.outcome !== 'ok') return response(result);
		return json({ sessions: result.value });
	} catch {
		return json({ error: 'Unable to load sessions' }, { status: 500 });
	}
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Service unavailable' }, { status: 500 });
	try {
		return response(
			await createPracticeSessionRepository(platform.env.BRIEF_DB).create(await bodyOf(request)),
			201
		);
	} catch {
		return json({ error: 'Unable to create session' }, { status: 500 });
	}
}
