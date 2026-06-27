import { getSemesters } from '$lib/server/store';

export async function load() {
	const semesters = (await getSemesters()).sort((a, b) => b.order - a.order);
	return { semesters };
}
