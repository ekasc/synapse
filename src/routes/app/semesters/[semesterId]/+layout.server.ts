import { error } from '@sveltejs/kit';
import { getSemesters } from '$lib/server/store';

export async function load({ params }) {
	const semester = (await getSemesters()).find((item) => item.id === params.semesterId);
	if (!semester) error(404, 'Semester not found');
	return { semester };
}
