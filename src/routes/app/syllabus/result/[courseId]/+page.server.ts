import { error, redirect } from '@sveltejs/kit';
import { getCourses } from '$lib/server/store';

export async function load({ params }) {
	const course = (await getCourses()).find(
		(item) =>
			item.id === params.courseId || item.code.toLowerCase() === params.courseId.toLowerCase()
	);
	if (!course) error(404, 'Course not found');
	redirect(
		307,
		`/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}/syllabus/result`
	);
}
