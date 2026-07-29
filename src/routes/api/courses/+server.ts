import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getCourses, addCourse, updateCourse, deleteCourse, type Course } from '$lib/server/store';

function isCourse(value: unknown): value is Course {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { id?: unknown }).id === 'string' &&
		typeof (value as { semesterId?: unknown }).semesterId === 'string' &&
		typeof (value as { code?: unknown }).code === 'string' &&
		typeof (value as { name?: unknown }).name === 'string'
	);
}

function isCoursePatch(value: unknown): value is Partial<Course> & { id: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { id?: unknown }).id === 'string'
	);
}

export async function GET({ url, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	const semesterId = url.searchParams.get('semesterId') ?? undefined;
	const courses = await getCourses(userId, semesterId);
	return json(courses);
}

export async function POST({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json();
	if (!isCourse(body)) return json({ ok: false, error: 'Invalid course' }, { status: 400 });
	await addCourse(userId, body);
	return json({ ok: true });
}

export async function PATCH({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json();
	if (!isCoursePatch(body))
		return json({ ok: false, error: 'Invalid course update' }, { status: 400 });
	const { id, ...updates } = body;
	await updateCourse(userId, id, updates);
	return json({ ok: true });
}

export async function DELETE({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body: unknown = await request.json();
	if (!isCoursePatch(body))
		return json({ ok: false, error: 'Invalid course delete' }, { status: 400 });
	await deleteCourse(userId, body.id);
	return json({ ok: true });
}
