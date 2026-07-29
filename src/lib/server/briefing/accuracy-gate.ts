/**
 * Accuracy gate — public facade for briefing admission.
 *
 * Re-exports from extracted sibling modules to preserve the existing import surface.
 * Core orchestration logic (admitBriefing, validateOfferingInstructor, decideRetry) lives here.
 */

import type { BriefingRequest, EvidenceSource, Claim, CourseOffering } from './schema';

// ── Re-exports from extracted modules ──
export type { InstitutionalDomain } from './institution';
export { resolveInstitution, matchInstitutionDomain } from './institution';

export { normalizeCourseCode, normalizeCanonicalTitle } from './course-code';

export type { AdmissibleSourceType, AdmissibleSource } from './source-classification';
export { classifySource, isSourceAdmissibleFor, extractTermScope, FACULTY_PAGE_CANNOT_VERIFY, RMP_CANNOT_VERIFY } from './source-classification';

export type { CourseIdentityFailureCode, EvidenceValue, ResolvedCourse, CourseIdentityEvaluation } from './course-identity';
export { extractCanonicalCourseTitle, selectIdentitySource, resolveCourseIdentity, evaluateCourseIdentity } from './course-identity';

// ── Local types (kept here because they're used by admitBriefing) ──

export type OfferingRecord = {
	term: string;
	relationship: 'current' | 'upcoming' | 'historical';
	instructor: EvidenceValue<string> | null;
	crn: EvidenceValue<string> | null;
	section: EvidenceValue<string> | null;
	schedule: EvidenceValue<string> | null;
	campus: EvidenceValue<string> | null;
	modality: EvidenceValue<string> | null;
	sourceIds: string[];
};

export type MissingEvidence = {
	field: string;
	reason: string;
};

export type EvidenceConflict = {
	field: string;
	left: string;
	right: string;
	detail: string;
};

export type ValidationFailure = {
	field: string;
	rule: string;
	detail: string;
};

export type BriefingAdmissionResult =
	| { status: 'accepted'; course: ResolvedCourse; offerings: OfferingRecord[]; sourceIds: string[] }
	| {
			status: 'partial';
			course: ResolvedCourse;
			offerings: OfferingRecord[];
			sourceIds: string[];
			missingEvidence: MissingEvidence[];
	  }
	| { status: 'conflict'; course: ResolvedCourse; conflicts: EvidenceConflict[] }
	| { status: 'not_found'; reason: string }
	| { status: 'rejected'; reasons: ValidationFailure[] };

import type {
	ResolvedCourse,
	EvidenceValue
} from './course-identity';
import {
	classifySource,
	isSourceAdmissibleFor,
	FACULTY_PAGE_CANNOT_VERIFY,
	RMP_CANNOT_VERIFY
} from './source-classification';

// ── Offering validation ──

export function validateOfferingInstructor(
	offering: CourseOffering | undefined,
	allSources: EvidenceSource[]
): EvidenceValue<string> | null {
	if (!offering?.instructor?.name) return null;

	if (offering.instructor.verification === 'user_confirmed') {
		return {
			value: offering.instructor.name,
			provenance: 'user_confirmed',
			sourceIds: [],
			term: offering.term.label
		};
	}

	if (offering.instructor.verification === 'official') {
		const sourceIds = offering.instructor.sourceIds ?? [];
		const classified = sourceIds
			.map((sid) => allSources.find((s) => s.id === sid))
			.filter(Boolean) as EvidenceSource[];

		const hasAdmissible = classified.some((cs) => {
			const ads = classifySource(cs);
			return isSourceAdmissibleFor(ads, 'instructor_assignment');
		});

		if (!hasAdmissible) {
			return {
				value: offering.instructor.name,
				provenance: 'unverified',
				sourceIds,
				term: offering.term.label
			};
		}

		const hasTermMatch = classified.some((cs) => {
			const ads = classifySource(cs);
			return (
				isSourceAdmissibleFor(ads, 'instructor_assignment') &&
				(!ads.termScope || ads.termScope.includes(offering.term.label))
			);
		});

		const finalProvenance = hasTermMatch ? 'official' : 'unverified';

		return {
			value: offering.instructor.name,
			provenance: finalProvenance,
			sourceIds,
			term: offering.term.label
		};
	}

	if (offering.instructor.verification === 'student_reported') {
		return {
			value: offering.instructor.name,
			provenance: 'unverified',
			sourceIds: [],
			term: offering.term.label
		};
	}

	return {
		value: offering.instructor.name,
		provenance: 'unverified',
		sourceIds: [],
		term: offering.term.label
	};
}

// ── Admission gate ──

export function admitBriefing(
	sources: EvidenceSource[],
	resolvedCourse: ResolvedCourse,
	offerings: (CourseOffering | undefined)[],
	claims: Claim[],
	_request: BriefingRequest
): BriefingAdmissionResult {
	const failures: ValidationFailure[] = [];
	const classifiedSources = sources.map(classifySource);

	// ── Identity gate ──
	if (resolvedCourse.status === 'not_found') {
		return {
			status: 'not_found',
			reason: `Course identity not found for ${resolvedCourse.courseCode} at ${resolvedCourse.institution}`
		};
	}

	if (resolvedCourse.status === 'ambiguous') {
		return {
			status: 'conflict',
			course: resolvedCourse,
			conflicts: [
				{
					field: 'course_identity',
					left: 'Multiple official identity sources conflict',
					right: resolvedCourse.candidates.map((c) => c.title).join(', '),
					detail: `${resolvedCourse.candidates.length} conflicting official sources for ${resolvedCourse.courseCode}`
				}
			]
		};
	}

	// ── Source admissibility gate ──
	const admittedSources: string[] = [];
	for (const cs of classifiedSources) {
		if (cs.type !== 'student_review' && cs.type !== 'other') {
			admittedSources.push(cs.id);
		}
	}

	if (!admittedSources.length) {
		failures.push({
			field: 'sources',
			rule: 'minimum_official_source',
			detail: 'No admissible source found for briefing admission'
		});
	}

	// ── Offering gate ──
	const validatedOfferings: OfferingRecord[] = [];
	const missingEvidence: MissingEvidence[] = [];

	for (const offering of offerings) {
		if (!offering) continue;

		const duplicate = validatedOfferings.find(
			(vo) => vo.term === offering.term.label && vo.relationship === offering.relationship
		);
		if (duplicate) {
			failures.push({
				field: 'offerings',
				rule: 'duplicate_offering',
				detail: `Duplicate ${offering.relationship} offering for term ${offering.term.label}`
			});
			continue;
		}

		const validatedInstructor = validateOfferingInstructor(offering, sources);

		if (validatedInstructor?.provenance === 'official') {
			const instructorSources = (offering.instructor?.sourceIds ?? [])
				.map((sid) => sources.find((s) => s.id === sid))
				.filter(Boolean) as EvidenceSource[];

			const hasOnlyFaculty =
				instructorSources.length > 0 &&
				instructorSources.every((s) => classifySource(s).type === 'official_faculty');

			if (hasOnlyFaculty) {
				validatedInstructor.provenance = 'unverified';
				missingEvidence.push({
					field: `offering.${offering.term.label}.instructor`,
					reason: FACULTY_PAGE_CANNOT_VERIFY
				});
			}

			const hasRMP = instructorSources.some((s) => classifySource(s).type === 'student_review');
			if (hasRMP && instructorSources.length === 1) {
				validatedInstructor.provenance = 'unverified';
				missingEvidence.push({
					field: `offering.${offering.term.label}.instructor`,
					reason: RMP_CANNOT_VERIFY
				});
			}
		}

		if (!offering.instructor) {
			missingEvidence.push({
				field: `offering.${offering.term.label}.instructor`,
				reason: 'No instructor information available for this term'
			});
		} else if (
			validatedInstructor &&
			validatedInstructor.provenance !== 'official' &&
			validatedInstructor.provenance !== 'user_confirmed'
		) {
			missingEvidence.push({
				field: `offering.${offering.term.label}.instructor`,
				reason: `Instructor not officially verified for ${offering.term.label}`
			});
		}

		validatedOfferings.push({
			term: offering.term.label,
			relationship: offering.relationship,
			instructor: validatedInstructor,
			crn: offering.crn
				? {
						value: String(offering.crn),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			section: offering.section
				? {
						value: String(offering.section),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			schedule: offering.schedule
				? {
						value: String(offering.schedule),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			campus: offering.campus
				? {
						value: String(offering.campus),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			modality: offering.modality
				? {
						value: String(offering.modality),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			sourceIds: offering.sourceIds
		});
	}

	// ── Claim gate ──
	for (const claim of claims) {
		const sourceIds = claim.sourceIds ?? [];
		const nonExistentSources = sourceIds.filter((sid) => !sources.some((s) => s.id === sid));
		if (nonExistentSources.length > 0) {
			failures.push({
				field: `claim.${claim.id}`,
				rule: 'nonexistent_source',
				detail: `Claim cites nonexistent source(s): ${nonExistentSources.join(', ')}`
			});
		}

		if (claim.status === 'verified_current' || claim.status === 'verified_historical') {
			const hasOfficialSource = sourceIds.some((sid) => {
				const cs = classifiedSources.find((c) => c.id === sid);
				return cs && cs.type !== 'student_review' && cs.type !== 'other';
			});
			if (!hasOfficialSource && sourceIds.length > 0) {
				failures.push({
					field: `claim.${claim.id}`,
					rule: 'non_official_claim',
					detail: `Claim marked as ${claim.status} but cites only non-official sources`
				});
			}
		}
	}

	// ── Determine outcome ──
	if (failures.length > 0) {
		return { status: 'rejected', reasons: failures };
	}

	if (missingEvidence.length > 0) {
		return {
			status: 'partial',
			course: resolvedCourse,
			offerings: validatedOfferings,
			sourceIds: admittedSources,
			missingEvidence
		};
	}

	return {
		status: 'accepted',
		course: resolvedCourse,
		offerings: validatedOfferings,
		sourceIds: admittedSources
	};
}

// ── Retry policy ──

export type RetryDecision = {
	shouldRetry: boolean;
	reason: string;
	changedStrategy: string | null;
	maxAttempts: number;
};

export function decideRetry(
	error: { code?: string; name?: string; status?: number },
	attempt: number,
	previousStrategies: string[]
): RetryDecision {
	const MAX_ATTEMPTS = 2;

	if (attempt >= MAX_ATTEMPTS) {
		return {
			shouldRetry: false,
			reason: 'Exceeded maximum attempts',
			changedStrategy: null,
			maxAttempts: MAX_ATTEMPTS
		};
	}

	const isRetryable =
		error.name === 'TimeoutError' ||
		error.code === 'ETIMEDOUT' ||
		(error.status != null && (error.status >= 500 || error.status === 429));

	if (!isRetryable) {
		return {
			shouldRetry: false,
			reason: 'Non-retryable error',
			changedStrategy: null,
			maxAttempts: MAX_ATTEMPTS
		};
	}

	const currentStrategy = error.code ?? error.name ?? 'unknown';
	if (previousStrategies.includes(currentStrategy)) {
		return {
			shouldRetry: false,
			reason: 'Same strategy repeated without change',
			changedStrategy: null,
			maxAttempts: MAX_ATTEMPTS
		};
	}

	return {
		shouldRetry: true,
		reason: 'Retryable failure with new strategy',
		changedStrategy: currentStrategy,
		maxAttempts: MAX_ATTEMPTS
	};
}
