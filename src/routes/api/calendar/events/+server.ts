import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createDb } from '$lib/server/db/d1';

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });

	const body = (await request.json()) as {
		courseCode?: string;
		title?: string;
		type?: string;
		date?: number;
		month?: number;
		year?: number;
		time?: string;
		gradeWeight?: number;
	};

	if (
		!body.title ||
		!body.courseCode ||
		body.date == null ||
		body.month == null ||
		body.year == null
	) {
		return json({ error: 'title, courseCode, date, month, year required' }, { status: 400 });
	}

	const db = createDb(platform.env.BRIEF_DB);
	await db.createCalendarEvent({
		id: crypto.randomUUID(),
		courseCode: body.courseCode,
		title: body.title,
		type: body.type ?? 'assignment',
		date: body.date,
		month: body.month,
		year: body.year,
		time: body.time ?? null,
		gradeWeight: body.gradeWeight ?? null,
		status: null,
		notes: null
	});

	return json({ ok: true });
}
