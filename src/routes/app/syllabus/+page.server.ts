import { redirect } from '@sveltejs/kit';
import { getCourses, getSemesters } from '$lib/server/store';
import { resolveCurrentTerm } from '$lib/dashboard/priority';

export async function load({ url, locals }) {
	const userId = locals.user?.id;
	if (!userId) return;
	const [courses, semesters] = await Promise.all([getCourses(userId), getSemesters(userId)]);
	const requested = url.searchParams.get('courseId');
	const semester = resolveCurrentTerm(new Date(), semesters);
	const course =
		courses.find((item) => item.id === requested) ??
		courses.find((item) => item.semesterId === semester?.id) ??
		courses[0];
	if (!course) redirect(307, '/app/semesters');
	redirect(
		307,
		`/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}/syllabus`
	);
}
