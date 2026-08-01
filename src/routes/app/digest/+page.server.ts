import { analyzeSetupCourses } from '$lib/server/digest-analytics';
import {
	buildAcademicDigest,
	getAcademicDigest,
	getCourses,
	getSemesters,
	getSyllabusImports
} from '$lib/server/store';
import { getTranscriptImportPreview } from '$lib/server/transcript-import';

export async function load(event) {
	const userId = event.locals.user?.id;
	if (!userId)
		return {
			courses: [],
			digest: null,
			semesters: [],
			syllabusGrading: [],
			transcriptImportPreview: null
		};
	const [courses, semesters, syllabusImports, transcriptImportPreview] = await Promise.all([
		getCourses(userId),
		getSemesters(userId),
		getSyllabusImports(userId),
		getTranscriptImportPreview(userId)
	]);
	return {
		courses,
		digest:
			(await getAcademicDigest(userId)) ??
			buildAcademicDigest({
				analysis: analyzeSetupCourses(courses, semesters)
			}),
		semesters,
		syllabusGrading: syllabusImports.map((syllabus) => ({
			courseId: syllabus.courseId,
			grading: syllabus.extractedData.grading
		})),
		transcriptImportPreview
	};
}
