import { getCourses, getSemesters } from '$lib/server/store';

export async function load({ params }) {
	const [courses, semesters] = await Promise.all([getCourses(), getSemesters()]);
	return {
		courseId: params.courseId,
		courses,
		semesters
	};
}
