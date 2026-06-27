import { analyzeSetupCourses } from '$lib/server/digest-analytics';
import {
	buildAcademicDigest,
	getAcademicDigest,
	getCourses,
	getSemesters
} from '$lib/server/store';

export async function load() {
	const [courses, semesters] = await Promise.all([getCourses(), getSemesters()]);
	return {
		courses,
		digest:
			(await getAcademicDigest()) ??
			buildAcademicDigest({
				analysis: analyzeSetupCourses(courses, semesters)
			}),
		semesters
	};
}
