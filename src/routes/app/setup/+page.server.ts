import { getSemesters } from '$lib/server/store';

export async function load() {
	const semesters = await getSemesters();
	return { semesters };
}
