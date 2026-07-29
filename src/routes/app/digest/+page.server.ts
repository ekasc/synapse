import { analyzeSetupCourses } from '$lib/server/digest-analytics';
import {
	buildAcademicDigest,
	getAcademicDigest,
	getCourses,
	getSemesters
} from '$lib/server/store';

export async function load(event) {
	const userId = event.locals.user?.id;
	if (!userId) return { courses: [], digest: null, semesters: [] };
	const [courses, semesters] = await Promise.all([getCourses(userId), getSemesters(userId)]);
	return {
		courses,
		digest:
			(await getAcademicDigest(userId)) ??
			buildAcademicDigest({
				analysis: analyzeSetupCourses(courses, semesters)
			}),
		semesters
	};
}
