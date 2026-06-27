import { getSemesters, getCourses } from '$lib/server/store';

export async function load() {
	const [semesters, courses] = await Promise.all([
		getSemesters().then((s) => s.sort((a, b) => b.order - a.order)),
		getCourses()
	]);
	return { semesters, courses };
}
