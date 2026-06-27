import { getCourses, getSemesters } from '$lib/server/store';

export function load({ params }) {
	return {
		courseId: params.courseId,
		courses: getCourses(),
		semesters: getSemesters()
	};
}
