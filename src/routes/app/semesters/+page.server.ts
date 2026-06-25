import { getSemesters } from '$lib/server/store';

export function load() {
	const semesters = getSemesters().sort((a, b) => b.order - a.order);
	return { semesters };
}
