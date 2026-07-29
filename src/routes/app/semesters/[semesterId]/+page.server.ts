import { error } from '@sveltejs/kit';
import { getCourses, getSemesters } from '$lib/server/store';

export async function load({ params, locals }) {
	const userId = locals.user?.id;
	if (!userId) return { semester: null, semesters: [], courses: [] };
	const [semesters, courses] = await Promise.all([getSemesters(userId), getCourses(userId)]);
	const semester = semesters.find((item) => item.id === params.semesterId);
	if (!semester) error(404, 'Semester not found');
	return {
		semester,
		semesters,
		courses: courses.filter((course) => course.semesterId === semester.id)
	};
}
