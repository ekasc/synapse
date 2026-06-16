import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses, addCourse, updateCourse, deleteCourse, type Course } from '$lib/server/store';

function isCourse(value: unknown): value is Course {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { id?: unknown }).id === 'string'
		&& typeof (value as { semesterId?: unknown }).semesterId === 'string'
		&& typeof (value as { code?: unknown }).code === 'string'
		&& typeof (value as { name?: unknown }).name === 'string';
}

function isCoursePatch(value: unknown): value is Partial<Course> & { id: string } {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { id?: unknown }).id === 'string';
}

export function GET({ url }: RequestEvent) {
	const semesterId = url.searchParams.get('semesterId') ?? undefined;
	const courses = getCourses(semesterId);
	return json(courses);
}

export async function POST({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isCourse(body)) return json({ ok: false, error: 'Invalid course' }, { status: 400 });
	addCourse(body);
	return json({ ok: true });
}

export async function PATCH({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isCoursePatch(body)) return json({ ok: false, error: 'Invalid course update' }, { status: 400 });
	const { id, ...updates } = body;
	updateCourse(id, updates);
	return json({ ok: true });
}

export async function DELETE({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isCoursePatch(body)) return json({ ok: false, error: 'Invalid course delete' }, { status: 400 });
	deleteCourse(body.id);
	return json({ ok: true });
}
