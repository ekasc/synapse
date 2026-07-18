import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createDb } from '$lib/server/db/d1';
import { getCourses } from '$lib/server/store';

const EVENT_TYPES = new Set(['assignment', 'midterm', 'final', 'quiz', 'lecture', 'study_session']);

function validDate(year: number, month: number, date: number) {
	if (!Number.isInteger(year) || year < 1970 || year > 2100) return false;
	if (!Number.isInteger(month) || month < 0 || month > 11) return false;
	if (!Number.isInteger(date) || date < 1 || date > 31) return false;
	const parsed = new Date(year, month, date);
	return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === date;
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });

	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Invalid event' }, { status: 400 });
	}
	const value = body as Record<string, unknown>;
	const courseId = typeof value.courseId === 'string' ? value.courseId.trim() : '';
	const courseCode = typeof value.courseCode === 'string' ? value.courseCode.trim() : '';
	const title = typeof value.title === 'string' ? value.title.trim() : '';
	const type = typeof value.type === 'string' ? value.type : 'assignment';
	const date = value.date;
	const month = value.month;
	const year = value.year;
	const time = typeof value.time === 'string' && value.time.trim() ? value.time.trim() : null;
	const gradeWeight = value.gradeWeight == null ? null : value.gradeWeight;

	if (!title || title.length > 160 || !courseCode || courseCode.length > 40) {
		return json({ error: 'Course and title are required' }, { status: 400 });
	}
	if (
		type === '' ||
		!EVENT_TYPES.has(type) ||
		typeof date !== 'number' ||
		typeof month !== 'number' ||
		typeof year !== 'number' ||
		!validDate(year, month, date)
	) {
		return json({ error: 'Invalid event type or date' }, { status: 400 });
	}
	if (
		gradeWeight !== null &&
		(typeof gradeWeight !== 'number' ||
			!Number.isInteger(gradeWeight) ||
			gradeWeight < 0 ||
			gradeWeight > 100)
	) {
		return json({ error: 'Grade weight must be a whole number from 0 to 100' }, { status: 400 });
	}
	if (time && (time.length > 20 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
		return json({ error: 'Time must use 24-hour HH:MM format' }, { status: 400 });
	}
	const courses = await getCourses();
	const course = courseId
		? courses.find((candidate) => candidate.id === courseId && candidate.code === courseCode)
		: courses.find((candidate) => candidate.code === courseCode);
	if (!course) return json({ error: 'Select a course from Synapse' }, { status: 422 });

	const db = createDb(platform.env.BRIEF_DB);
	await db.createCalendarEvent({
		id: crypto.randomUUID(),
		courseId: course.id,
		courseCode: course.code,
		title,
		type,
		date,
		month,
		year,
		time,
		gradeWeight,
		status: 'pending',
		notes: null
	});

	return json({ ok: true });
}
