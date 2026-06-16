import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getSemesters, addSemester, deleteSemester, type Semester } from '$lib/server/store';

function isSemester(value: unknown): value is Semester {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { id?: unknown }).id === 'string'
		&& typeof (value as { term?: unknown }).term === 'string'
		&& typeof (value as { year?: unknown }).year === 'number'
		&& typeof (value as { order?: unknown }).order === 'number';
}

function hasId(value: unknown): value is { id: string } {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { id?: unknown }).id === 'string';
}

export function GET() {
	const semesters = getSemesters().sort((a, b) => b.order - a.order);
	return json(semesters);
}

export async function POST({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isSemester(body)) return json({ ok: false, error: 'Invalid semester' }, { status: 400 });
	addSemester(body);
	return json({ ok: true });
}

export async function DELETE({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!hasId(body)) return json({ ok: false, error: 'Invalid semester delete' }, { status: 400 });
	deleteSemester(body.id);
	return json({ ok: true });
}
