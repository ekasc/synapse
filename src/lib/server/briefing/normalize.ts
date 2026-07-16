import type { BriefingRequest, EvidenceCategory } from './schema';

export class BriefingRequestError extends Error {
	constructor(
		public readonly code: 'INVALID_REQUEST' | 'AMBIGUOUS_COURSE',
		message: string
	) {
		super(message);
	}
}

function optional(value: unknown, limit: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const normalized = value.replace(/\s+/g, ' ').trim();
	return normalized ? normalized.slice(0, limit) : undefined;
}

export function normalizeBriefingRequest(input: unknown): BriefingRequest {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new BriefingRequestError('INVALID_REQUEST', 'Request body must be an object');
	}
	const body = input as Record<string, unknown>;
	const rawCode = optional(body.courseCode, 40);
	if (!rawCode) throw new BriefingRequestError('INVALID_REQUEST', 'Course code required');
	const courseCode = rawCode.toUpperCase().replace(/\s+/g, ' ');
	if (!/^[A-Z][A-Z0-9&.-]{1,11}\s?\d[A-Z0-9.-]{1,11}$/.test(courseCode)) {
		throw new BriefingRequestError('INVALID_REQUEST', 'Course code is invalid');
	}
	return {
		courseCode,
		courseName: optional(body.courseName, 200),
		professorName: optional(body.professorName, 200),
		institution: optional(body.institution, 200),
		additionalNotes: optional(body.additionalNotes, 1200),
		activeTerm: optional(body.activeTerm, 200)
	};
}

export function evidenceCategories(request: BriefingRequest): EvidenceCategory[] {
	const base: EvidenceCategory[] = ['catalog', 'prerequisites', 'outline', 'schedule'];
	return request.professorName
		? [...base, 'professor-course', 'professor-profile', 'rate-my-professors']
		: base;
}
