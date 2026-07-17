import { error } from '@sveltejs/kit';
import { getCourses, getSemesters } from '$lib/server/store';

export async function load({ params }) {
	const [semesters, courses] = await Promise.all([getSemesters(), getCourses()]);
	const semester = semesters.find((item) => item.id === params.semesterId);
	if (!semester) error(404, 'Semester not found');
	return {
		semester,
		semesters,
		courses: courses.filter((course) => course.semesterId === semester.id)
	};
}
