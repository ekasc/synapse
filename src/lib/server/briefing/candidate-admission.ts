import { admitBriefing, evaluateCourseIdentity } from './accuracy-gate';
import type { BriefingAdmissionResult } from './accuracy-gate';
import type { CandidateBriefing } from './research-run';
import type { BriefingRequest, BriefingUsage, BriefingV4 } from './schema';
import { ValidationError, validateStructuredBriefing } from './validation';

export type CandidateAdmission =
	| { status: 'accepted' | 'partial'; briefing: BriefingV4; admission: BriefingAdmissionResult }
	| { status: 'conflict'; admission: BriefingAdmissionResult }
	| { status: 'rejected'; code: string; safeMessage: string; detail?: string };

/** Converts untrusted agent output once, then delegates all admission decisions to existing rules. */
export function admitCandidateBriefing(
	candidate: CandidateBriefing,
	request: BriefingRequest,
	metadata: {
		researchedAt: string;
		modelUsed: string;
		searchModel: string;
		synthesisModel: string;
		usage: BriefingUsage;
	}
): CandidateAdmission {
	const identity = evaluateCourseIdentity(candidate.sources, request);
	if (identity.status === 'rejected') {
		if (identity.code === 'CONFLICTING_CANONICAL_TITLES')
			return {
				status: 'conflict',
				admission: {
					status: 'conflict',
					course: {
						institution: request.institution ?? '',
						courseCode: request.courseCode,
						canonicalTitle: '',
						canonicalUrl: '',
						sourceId: '',
						status: 'ambiguous',
						candidates: identity.candidates
					},
					conflicts: [
						{
							field: 'course_identity',
							left: 'official sources',
							right: 'conflicting canonical titles',
							detail: identity.code
						}
					]
				}
			};
		return {
			status: 'rejected',
			code: identity.code,
			safeMessage: 'Course identity could not be verified.'
		};
	}
	try {
		const briefing = validateStructuredBriefing(
			candidate as unknown as Record<string, unknown>,
			candidate.sources,
			request,
			metadata,
			identity.course
		);
		const offerings = briefing.offerings
			? [
					briefing.offerings.current,
					briefing.offerings.upcoming,
					...(briefing.offerings.historical ?? [])
				]
			: [];
		const admission = admitBriefing(
			briefing.sources,
			identity.course,
			offerings,
			briefing.claims,
			request
		);
		if (admission.status === 'accepted' || admission.status === 'partial')
			return { status: admission.status, briefing, admission };
		if (admission.status === 'conflict') return { status: 'conflict', admission };
		return {
			status: 'rejected',
			code: admission.status === 'not_found' ? 'COURSE_NOT_FOUND' : 'ADMISSION_REJECTED',
			safeMessage: 'Candidate briefing did not meet publication requirements.'
		};
	} catch (error) {
		return {
			status: 'rejected',
			code: error instanceof ValidationError ? 'VALIDATION_FAILED' : 'ADMISSION_FAILED',
			safeMessage: 'Candidate briefing did not pass validation.',
			detail: error instanceof ValidationError ? error.message : undefined
		};
	}
}
