import { getSemesters } from '$lib/server/store';

export async function load(event: { locals: App.Locals }) {
	const userId = event.locals.user?.id;
	if (!userId) return { semesters: [] };
	const semesters = await getSemesters(userId);
	return { semesters };
}
