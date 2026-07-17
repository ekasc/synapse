import { redirect } from '@sveltejs/kit';
import { getCourses } from '$lib/server/store';

export async function load({ params }) {
	const course = (await getCourses()).find((item) => item.id === params.id);
	if (!course) redirect(308, '/app/semesters');
	redirect(
		308,
		`/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}`
	);
}
