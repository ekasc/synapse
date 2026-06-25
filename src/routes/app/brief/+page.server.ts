import { getBriefs } from '$lib/server/store';

export function load() {
	const briefs = getBriefs().sort((a, b) => a.code.localeCompare(b.code));
	return { briefs };
}
