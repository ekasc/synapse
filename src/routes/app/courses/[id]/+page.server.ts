import { redirect } from '@sveltejs/kit';
import { getCourses } from '$lib/server/store';

export async function load({ params, locals }) {
	const userId = locals.user?.id;
	if (!userId) return { course: null };
	const course = (await getCourses(userId)).find((item) => item.id === params.id);
	if (!course) redirect(308, '/app/semesters');
	redirect(
		308,
		`/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}`
	);
}
