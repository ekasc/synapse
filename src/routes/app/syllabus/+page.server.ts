import { getCourses, getSemesters } from '$lib/server/store';

export function load() {
	return {
		courses: getCourses(),
		semesters: getSemesters()
	};
}
