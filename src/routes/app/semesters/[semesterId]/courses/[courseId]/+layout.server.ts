import { error, redirect } from '@sveltejs/kit';
import { getCourses, getSemesters } from '$lib/server/store';

export async function load({ params, locals }) {
	const userId = locals.user?.id;
	if (!userId) redirect(303, '/auth/error?reason=unauthenticated');
	const [courses, semesters] = await Promise.all([getCourses(userId), getSemesters(userId)]);
	const course = courses.find(
		(item) => item.id === params.courseId && item.semesterId === params.semesterId
	);
	if (!course) error(404, 'Course not found in this semester');

	const semester = semesters.find((item) => item.id === params.semesterId);
	if (!semester) error(404, 'Semester not found');

	return { course, semester };
}
