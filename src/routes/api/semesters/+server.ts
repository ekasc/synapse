import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	getSemesters,
	addSemester,
	updateSemester,
	deleteSemester,
	type Semester
} from '$lib/server/store';

function isSemester(value: unknown): value is Semester {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { id?: unknown }).id === 'string' &&
		typeof (value as { term?: unknown }).term === 'string' &&
		typeof (value as { year?: unknown }).year === 'number' &&
		typeof (value as { order?: unknown }).order === 'number'
	);
}

function hasId(value: unknown): value is { id: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { id?: unknown }).id === 'string'
	);
}

export async function GET(event: RequestEvent) {
	const userId = event.locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	const semesters = (await getSemesters(userId)).sort((a, b) => b.order - a.order);
	return json(semesters);
}

export async function POST({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json();
	if (!isSemester(body)) return json({ ok: false, error: 'Invalid semester' }, { status: 400 });
	await addSemester(userId, body);
	return json({ ok: true });
}

export async function DELETE({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json();
	if (!hasId(body)) return json({ ok: false, error: 'Invalid semester delete' }, { status: 400 });
	await deleteSemester(userId, body.id);
	return json({ ok: true });
}

export async function PUT({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json();
	if (!hasId(body)) return json({ ok: false, error: 'Missing semester id' }, { status: 400 });
	const { id, ...updates } = body as { id: string };
	await updateSemester(userId, id, updates);
	return json({ ok: true });
}
