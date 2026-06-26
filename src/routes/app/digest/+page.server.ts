import { analyzeSetupCourses } from '$lib/server/digest-analytics';
import { buildAcademicDigest, getAcademicDigest, getCourses, getSemesters } from '$lib/server/store';

export function load() {
	const courses = getCourses();
	const semesters = getSemesters();
	return {
		courses,
		digest:
			getAcademicDigest() ??
			buildAcademicDigest({
				analysis: analyzeSetupCourses(courses, semesters)
			}),
		semesters
	};
}
