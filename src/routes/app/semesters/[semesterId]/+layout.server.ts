import { error, redirect } from '@sveltejs/kit';
import { getSemesters } from '$lib/server/store';

export async function load({ params, locals }) {
	const userId = locals.user?.id;
	if (!userId) redirect(303, '/auth/error?reason=unauthenticated');
	const semester = (await getSemesters(userId)).find((item) => item.id === params.semesterId);
	if (!semester) error(404, 'Semester not found');
	return { semester };
}
