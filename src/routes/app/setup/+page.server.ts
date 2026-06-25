import { getSemesters } from '$lib/server/store';

export function load() {
	const semesters = getSemesters();
	return { semesters };
}
