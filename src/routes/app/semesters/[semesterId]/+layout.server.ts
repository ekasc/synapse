import { error } from '@sveltejs/kit';
import { getSemesters } from '$lib/server/store';

export async function load({ params, locals }) {
	const userId = locals.user?.id;
	if (!userId) return { semester: null };
	const semester = (await getSemesters(userId)).find((item) => item.id === params.semesterId);
	if (!semester) error(404, 'Semester not found');
	return { semester };
}
