import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createPracticeSessionRepository, type SessionResult } from '$lib/server/practice/sessions';

function response<T>(result: SessionResult<T>) {
	if (result.outcome === 'ok') return json({ session: result.value });
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

function unavailable() {
	return json({ error: 'Service unavailable' }, { status: 500 });
}

export async function GET({ params, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		return response(await createPracticeSessionRepository(platform.env.BRIEF_DB).get(params.id));
	} catch {
		return json({ error: 'Unable to load session' }, { status: 500 });
	}
}

export async function PATCH({ params, request, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		return response(
			await createPracticeSessionRepository(platform.env.BRIEF_DB).updateProgress(
				params.id,
				await bodyOf(request)
			)
		);
	} catch {
		return json({ error: 'Unable to update session' }, { status: 500 });
	}
}

export async function DELETE({ params, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		return response(await createPracticeSessionRepository(platform.env.BRIEF_DB).delete(params.id));
	} catch {
		return json({ error: 'Unable to delete session' }, { status: 500 });
	}
}
