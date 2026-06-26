import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createDb } from '$lib/server/db/d1';

export async function PUT({ params, request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });

	const body = (await request.json()) as {
		title?: string;
		type?: string;
		date?: number;
		month?: number;
		year?: number;
		time?: string;
		courseCode?: string;
	};

	const db = createDb(platform.env.BRIEF_DB);
	await db.updateCalendarEvent(params.id, body);
	return json({ ok: true });
}

export async function DELETE({ params, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });

	const db = createDb(platform.env.BRIEF_DB);
	await db.deleteCalendarEvent(params.id);
	return json({ ok: true });
}
