import { redirect } from '@sveltejs/kit';
import { getSemesters } from '$lib/server/store';
import { resolveCurrentTerm } from '$lib/dashboard/priority';

export async function load() {
	const semesters = await getSemesters();
	if (semesters.length > 0) {
		const current =
			resolveCurrentTerm(new Date(), semesters) ??
			semesters.slice().sort((a, b) => b.year - a.year || b.order - a.order)[0];
		redirect(308, `/app/semesters/${encodeURIComponent(current.id)}`);
	}
	return { semesters: [] };
}
