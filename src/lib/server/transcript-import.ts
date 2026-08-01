import {
	addCourse,
	addSemester,
	getAcademicDigest,
	getCourses,
	getSemesters,
	type AcademicTranscriptCourse,
	type Course,
	type Semester
} from './store';

type ParsedTerm = { term: string; year: number };

export type TranscriptImportPreview = {
	semesterCount: number;
	courseCount: number;
	terms: string[];
};

function parseTerm(value: string): ParsedTerm | null {
	const match = value.trim().match(/^(.+?)[,\s]+(\d{4})$/);
	if (!match) return null;
	return { term: match[1].trim(), year: Number(match[2]) };
}

function semesterKey(term: string, year: number): string {
	return `${term.trim().toLowerCase()}::${year}`;
}

function courseKey(semesterId: string, code: string): string {
	return `${semesterId}::${code.trim().toLowerCase()}`;
}

function importableCourses(courses: AcademicTranscriptCourse[]) {
	return courses.filter((course) => parseTerm(course.term) && course.code.trim());
}

export async function getTranscriptImportPreview(
	userId: string
): Promise<TranscriptImportPreview | null> {
	const [digest, semesters, courses] = await Promise.all([
		getAcademicDigest(userId),
		getSemesters(userId),
		getCourses(userId)
	]);
	if (digest?.source !== 'transcript-upload') return null;

	const semesterIds = new Map(
		semesters.map((semester) => [semesterKey(semester.term, semester.year), semester.id])
	);
	const existingCourses = new Set(
		courses.map((course) => courseKey(course.semesterId, course.code))
	);
	const missingTerms = new Set<string>();
	const missingCourses = new Set<string>();

	for (const course of importableCourses(digest.courses)) {
		const parsed = parseTerm(course.term)!;
		const key = semesterKey(parsed.term, parsed.year);
		const semesterId = semesterIds.get(key);
		if (!semesterId) {
			missingTerms.add(key);
			missingCourses.add(`${key}::${course.code.trim().toLowerCase()}`);
		} else if (!existingCourses.has(courseKey(semesterId, course.code))) {
			missingCourses.add(courseKey(semesterId, course.code));
		}
	}

	if (missingCourses.size === 0) return null;
	return {
		semesterCount: missingTerms.size,
		courseCount: missingCourses.size,
		terms: Array.from(
			new Set(importableCourses(digest.courses).map((course) => course.term.trim()))
		)
	};
}

export async function importTranscriptCourses(
	userId: string
): Promise<TranscriptImportPreview> {
	const [digest, existingSemesters, existingCourses] = await Promise.all([
		getAcademicDigest(userId),
		getSemesters(userId),
		getCourses(userId)
	]);
	if (digest?.source !== 'transcript-upload') {
		throw new Error('No transcript digest is available to import.');
	}

	const semesters = new Map(
		existingSemesters.map((semester) => [semesterKey(semester.term, semester.year), semester])
	);
	const courseKeys = new Set(
		existingCourses.map((course) => courseKey(course.semesterId, course.code))
	);
	let semesterCount = 0;
	let courseCount = 0;

	for (const transcriptCourse of importableCourses(digest.courses)) {
		const parsed = parseTerm(transcriptCourse.term)!;
		const termKey = semesterKey(parsed.term, parsed.year);
		let semester = semesters.get(termKey);
		if (!semester) {
			semester = {
				id: crypto.randomUUID(),
				userId,
				term: parsed.term,
				year: parsed.year,
				order: existingSemesters.length + semesterCount
			} satisfies Semester;
			await addSemester(userId, semester);
			semesters.set(termKey, semester);
			semesterCount += 1;
		}

		const key = courseKey(semester.id, transcriptCourse.code);
		if (courseKeys.has(key)) continue;
		const course = {
			id: crypto.randomUUID(),
			userId,
			semesterId: semester.id,
			code: transcriptCourse.code.trim(),
			name: transcriptCourse.name.trim() || transcriptCourse.code.trim(),
			credits: transcriptCourse.credits,
			signals: {
				status: transcriptCourse.status === 'finished' ? 'completed' : 'active',
				credits: transcriptCourse.credits,
				currentGrade: transcriptCourse.currentPercent,
				projectedGrade: transcriptCourse.projectedPercent
			}
		} satisfies Course;
		await addCourse(userId, course);
		courseKeys.add(key);
		courseCount += 1;
	}

	return {
		semesterCount,
		courseCount,
		terms: Array.from(
			new Set(importableCourses(digest.courses).map((course) => course.term.trim()))
		)
	};
}
