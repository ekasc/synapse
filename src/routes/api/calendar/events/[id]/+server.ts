import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses } from '$lib/server/store';

const EVENT_TYPES = new Set(['assignment', 'midterm', 'final', 'quiz', 'lecture', 'study_session']);
const EVENT_STATUSES = new Set(['pending', 'completed', 'at_risk']);

function validDate(year: number, month: number, date: number) {
	if (!Number.isInteger(year) || year < 1970 || year > 2100) return false;
	if (!Number.isInteger(month) || month < 0 || month > 11) return false;
	if (!Number.isInteger(date) || date < 1 || date > 31) return false;
	const parsed = new Date(year, month, date);
	return parsed.getFullYear() === year && parsed.getMonth() === month && parsed.getDate() === date;
}

export async function PUT({ params, request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });
	const body: unknown = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Invalid event update' }, { status: 400 });
	}
	const value = body as Record<string, unknown>;
	const sets: string[] = [];
	const bindings: (string | number | null)[] = [];

	if (value.title !== undefined) {
		if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 160)
			return json({ error: 'Invalid title' }, { status: 400 });
		sets.push('title = ?');
		bindings.push(value.title.trim());
	}
	if (value.type !== undefined) {
		if (typeof value.type !== 'string' || !EVENT_TYPES.has(value.type))
			return json({ error: 'Invalid event type' }, { status: 400 });
		sets.push('type = ?');
		bindings.push(value.type);
	}
	if (value.status !== undefined) {
		if (typeof value.status !== 'string' || !EVENT_STATUSES.has(value.status))
			return json({ error: 'Invalid event status' }, { status: 400 });
		sets.push('status = ?');
		bindings.push(value.status);
	}
	if (value.courseId !== undefined || value.courseCode !== undefined) {
		if (typeof value.courseId !== 'string' || typeof value.courseCode !== 'string')
			return json({ error: 'A course selection is required' }, { status: 400 });
		const courseId = value.courseId;
		const courseCode = value.courseCode.trim();
		const course = (await getCourses()).find(
			(candidate) => candidate.id === courseId && candidate.code === courseCode
		);
		if (!course) return json({ error: 'Select a course from Synapse' }, { status: 422 });
		sets.push('course_id = ?', 'course_code = ?');
		bindings.push(course.id, course.code);
	}
	if (value.date !== undefined || value.month !== undefined || value.year !== undefined) {
		if (
			typeof value.date !== 'number' ||
			typeof value.month !== 'number' ||
			typeof value.year !== 'number' ||
			!validDate(value.year, value.month, value.date)
		)
			return json({ error: 'A complete valid date is required' }, { status: 400 });
		sets.push('date = ?', 'month = ?', 'year = ?');
		bindings.push(value.date, value.month, value.year);
	}
	if (value.time !== undefined) {
		if (
			value.time !== null &&
			(typeof value.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
		)
			return json({ error: 'Time must use 24-hour HH:MM format' }, { status: 400 });
		sets.push('time = ?');
		bindings.push(value.time);
	}
	if (value.gradeWeight !== undefined) {
		if (
			value.gradeWeight !== null &&
			(typeof value.gradeWeight !== 'number' ||
				!Number.isInteger(value.gradeWeight) ||
				value.gradeWeight < 0 ||
				value.gradeWeight > 100)
		)
			return json({ error: 'Grade weight must be a whole number from 0 to 100' }, { status: 400 });
		sets.push('grade_weight = ?');
		bindings.push(value.gradeWeight);
	}
	if (sets.length === 0) return json({ error: 'No supported changes provided' }, { status: 400 });

	sets.push('updated_at = ?');
	bindings.push(new Date().toISOString(), params.id);
	const result = await platform.env.BRIEF_DB.prepare(
		`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ?`
	)
		.bind(...bindings)
		.run();
	if (!result.meta.changes) return json({ error: 'Event not found' }, { status: 404 });
	return json({ ok: true });
}

export async function DELETE({ params, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Platform unavailable' }, { status: 500 });
	const result = await platform.env.BRIEF_DB.prepare('DELETE FROM calendar_events WHERE id = ?')
		.bind(params.id)
		.run();
	if (!result.meta.changes) return json({ error: 'Event not found' }, { status: 404 });
	return json({ ok: true });
}
