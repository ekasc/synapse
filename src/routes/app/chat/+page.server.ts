import { getCourses } from '$lib/server/store';

export async function load() {
	return { courses: await getCourses() };
}
