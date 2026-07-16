import { normalizeCourseCode } from './accuracy-gate';

export type CourseOutlineField =
	| 'description'
	| 'credits'
	| 'prerequisites'
	| 'corequisites'
	| 'delivery'
	| 'assessments';

const EVIDENCE_NOISE =
	/\b(?:instructor\s+(?:last\s+name|name)|course\s+status|textbooks?|faculty|navigation|breadcrumbs?)\b/i;
const COURSE_CODE = /\b([A-Z]{2,8})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/g;

/** Reject page chrome and mixed evidence rather than trying to repair it for presentation. */
export function isCleanCourseField(
	field: CourseOutlineField,
	text: string,
	courseCode: string
): boolean {
	const value = text.trim();
	if (!value) return true;
	if (value.length > (field === 'description' ? 1200 : 600) || EVIDENCE_NOISE.test(value))
		return false;

	if (!['prerequisites', 'corequisites'].includes(field)) {
		const target = normalizeCourseCode(courseCode);
		const codes = [...value.matchAll(COURSE_CODE)].map((match) =>
			normalizeCourseCode(`${match[1]} ${match[2]}`)
		);
		if (codes.some((code) => code !== target)) return false;
	}

	if (
		field === 'delivery' &&
		!/\b(?:online|hybrid|in[ -]?person|remote|lecture|seminar|lab|campus|room|weeks?|hours?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
			value
		)
	)
		return false;
	if (
		field === 'assessments' &&
		!/\b(?:assessment|evaluation|exam|quiz|test|assignment|project|lab|presentation|participation|%|percent)\b/i.test(
			value
		)
	)
		return false;
	return true;
}

export function hasDuplicateCourseField(values: Array<string | undefined>): boolean {
	const seen = new Set<string>();
	for (const value of values) {
		const normalized = value?.replace(/\s+/g, ' ').trim().toLowerCase();
		if (!normalized) continue;
		if (seen.has(normalized)) return true;
		seen.add(normalized);
	}
	return false;
}
