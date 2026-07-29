/**
 * Canonical UI view model for Course Brief detail pages.
 * All V2/V3/V4 branching is centralized in toDetailViewModel().
 *
 * Re-exports types from briefing-types.ts and delegates helpers to
 * view-parsing.ts and view-assessment.ts.
 */

import type { Briefing } from '$lib/server/db/d1';
import { isCleanCourseField, type CourseOutlineField } from './field-quality';
import type { Currentness } from './schema';

// ── Re-exports from extracted modules ──
export type {
	SourceClass,
	SourceCurrentness,
	RenderableSource,
	EvidenceStatus,
	StructuredSection,
	RenderableClaim,
	ProfessorView,
	CourseOfferingView,
	StudentReviewView,
	StudentSentimentView,
	AssessmentComponentView,
	PassingRequirementView,
	UsageView,
	BriefingDetailViewModel
} from './briefing-types';

import type {
	EvidenceStatus,
	RenderableSource,
	RenderableClaim,
	ProfessorView,
	CourseOfferingView,
	BriefingDetailViewModel,
	StructuredSection
} from './briefing-types';

import {
	classifyViewSource,
	parseRatingFromText,
	parseRatingCountFromText,
	parseWouldTakeAgainFromText,
	parseSentimentFromRmpText,
	safeText,
	safeArray,
	safeObject,
	safeLegacySummary,
	evidenceSummary
} from './view-parsing';

import {
	mapV4Components,
	assessmentComponentsFromText,
	mapV4PassingRules,
	assessmentHistoryNoteFromSources,
	mapLegacyAssessmentComponents,
	mapLegacyPassingRules
} from './view-assessment';

export function toDetailViewModel(b: Briefing): BriefingDetailViewModel {
	const isLegacy = b.schemaVersion < 4;
	const v4 = b.v4Report;

	// ── V4 path ──
	if (v4 && b.schemaVersion >= 4) {
		const identity = safeObject(v4.identity);
		const instructor = safeObject(v4.instructor);
		const v4Usage = b.usage ?? {
			inputTokens: 0,
			outputTokens: 0,
			searchRequests: 0,
			costMicrodollars: 0
		};

		const sectionFromV4 = (name: string, title: string): StructuredSection | null => {
			const raw = safeObject(v4[name]);
			if (!raw || typeof raw !== 'object') return null;
			const v4Claims = Array.isArray(v4.claims) ? v4.claims.map(safeObject) : [];
			const claimIds = safeArray(raw.claimIds);
			const relatedClaims = v4Claims.filter((c) => claimIds.includes(String(c.id)));
			const statuses = relatedClaims.map((c) => String(c.status));
			const text = safeText(raw.text);
			const courseField = [
				'description',
				'credits',
				'prerequisites',
				'corequisites',
				'delivery',
				'assessments'
			].includes(name)
				? (name as CourseOutlineField)
				: null;
			return {
				id: name,
				title,
				text: courseField && !isCleanCourseField(courseField, text, b.code) ? '' : text,
				status: (statuses[0] as EvidenceStatus) || 'unknown',
				sourceIds: safeArray(raw.sourceIds),
				explanation: typeof raw.explanation === 'string' ? raw.explanation : null
			};
		};

		const v4Sources = Array.isArray(v4.sources) ? v4.sources.map(safeObject) : [];

		const renderableClaim = (c: Record<string, unknown>): RenderableClaim => ({
			id: String(c.id ?? ''),
			text: String(c.text ?? ''),
			status: String(c.status) as EvidenceStatus,
			sourceIds: safeArray(c.sourceIds),
			explanation: typeof c.explanation === 'string' ? c.explanation : null
		});

		const summarySection = sectionFromV4('summary', 'Summary');
		const assessmentsSection = sectionFromV4('assessments', 'Assessment structure');
		const rmpSection = sectionFromV4('rateMyProfessors', 'Student reviews');
		const rmpText = rmpSection?.text ?? '';
		const rmpProfile = safeObject(v4.rmpProfile);
		const sentiment = safeObject(v4.studentSentiment);
		const visibleSourceIds = new Set([
			...['description', 'credits', 'prerequisites', 'delivery', 'assessments'].flatMap((name) =>
				safeArray(safeObject(v4[name]).sourceIds)
			),
			...safeArray(instructor.sourceIds),
			...safeArray(rmpSection?.sourceIds),
			...safeArray(rmpProfile.sourceIds),
			...safeArray(sentiment.sourceIds),
			...['current', 'upcoming'].flatMap((key) => {
				const offering = safeObject(safeObject(v4.offerings)[key]);
				return [
					...safeArray(offering.sourceIds),
					...safeArray(safeObject(offering.instructor).sourceIds)
				];
			})
		]);

		const sources: RenderableSource[] = v4Sources
			.filter((s) => visibleSourceIds.has(String(s.id ?? '')))
			.filter((s) => String(s.retrievalStatus ?? 'retrieved') !== 'unavailable')
			.map((s) => {
				const cls = classifyViewSource(s, 0, String(s.title ?? s.description ?? ''));
				return {
					id: String(s.id ?? ''),
					label: String(s.title ?? s.publisher ?? 'Source'),
					url: String(s.url ?? ''),
					class: cls.class,
					currentness: cls.currentness,
					termOrDate: cls.termOrDate
				};
			});

		return {
			courseCode: b.code,
			title: b.name,
			institution: b.institution,
			officialDomain: String(identity.officialDomain ?? ''),
			confidence: String(identity.confidence ?? ''),
			researchedAt: b.researchedAt,
			schemaVersion: b.schemaVersion,
			evidenceSummary: evidenceSummary(sources),
			isLegacy: false,
			legacyLabel: null,

			summary: summarySection && safeLegacySummary(summarySection.text) ? summarySection : null,
			description: sectionFromV4('description', 'Description'),
			credits: sectionFromV4('credits', 'Credits'),
			prerequisites: sectionFromV4('prerequisites', 'Prerequisites'),
			corequisites: sectionFromV4('corequisites', 'Corequisites'),
			restrictions: null,
			delivery: sectionFromV4('delivery', 'Delivery'),
			workload: sectionFromV4('workload', 'Workload'),
			assessments: assessmentsSection,

			professor: {
				requestedName: String(instructor.requestedName ?? '') || null,
				assignmentStatus:
					(String(instructor.status) as ProfessorView['assignmentStatus']) || 'not_verified',
				assignmentDetail: String(instructor.detail ?? '') || null,
				facultyAffiliation: null,
				facultySourceIds: [],
				currentListedInstructor: String(instructor.name ?? '')
			},

			studentReviews:
				rmpSection?.sourceIds.length || rmpText.trim() || rmpProfile.profileUrl
					? {
							present: true,
							label: rmpText,
							rating:
								typeof rmpProfile.overallRating === 'number'
									? rmpProfile.overallRating
									: (parseRatingFromText(rmpText) ?? parseFloat(rmpText.split('/')[0])) || null,
							ratingCount:
								typeof rmpProfile.ratingCount === 'number'
									? rmpProfile.ratingCount
									: (parseRatingCountFromText(rmpText) ?? b.rmpCount ?? null),
							wouldTakeAgainPercent:
								typeof rmpProfile.wouldTakeAgainPercent === 'number'
									? rmpProfile.wouldTakeAgainPercent
									: parseWouldTakeAgainFromText(rmpText),
							difficulty: typeof rmpProfile.difficulty === 'number' ? rmpProfile.difficulty : null,
							themes: safeArray(rmpProfile.themes),
							sourceIds: safeArray(rmpProfile.sourceIds).length
								? safeArray(rmpProfile.sourceIds)
								: (rmpSection?.sourceIds ?? []),
							rmpNote:
								'Student-reported; not official evidence of teaching history, course identity, assignment, or offering.'
						}
					: null,
			studentSentiment: (() => {
				if (safeArray(sentiment.sourceIds).length > 0) {
					return {
						positives: safeArray(sentiment.positives),
						concerns: safeArray(sentiment.concerns),
						sampleSize: typeof sentiment.sampleSize === 'number' ? sentiment.sampleSize : null,
						courseSpecific: sentiment.courseSpecific === true,
						sourceIds: safeArray(sentiment.sourceIds)
					};
				}
				const parsed = parseSentimentFromRmpText(rmpText);
				if (parsed.positives.length === 0 && parsed.concerns.length === 0) return null;
				return {
					positives: parsed.positives,
					concerns: parsed.concerns,
					sampleSize: null,
					courseSpecific: false,
					sourceIds: rmpSection?.sourceIds ?? []
				};
			})(),

			claims: (Array.isArray(v4.claims) ? v4.claims.map(safeObject) : []).map(renderableClaim),
			sources,

			assessmentComponents:
				mapV4Components(v4.assessmentComponents as Array<Record<string, unknown>> | undefined | null, sources) ??
				assessmentComponentsFromText(assessmentsSection, sources),
			assessmentHistoryNote: assessmentHistoryNoteFromSources(sources),
			passingRequirements: mapV4PassingRules(v4.passingRequirements as Array<Record<string, unknown>> | undefined | null),

			gradeBreakdown: null,
			gradeNotes: null,
			contradictions: safeText(safeObject(v4.contradictions).text).split('\n').filter(Boolean),
			missingEvidence: safeText(safeObject(v4.missing).text).split('\n').filter(Boolean),
			workloadHoursPerWeek: null,

			usage: {
				available: true,
				freshSearches: v4Usage.searchRequests,
				cachedCategories: v4Usage.searchRequests === 0 ? 6 : 0,
				synthesisAttempts: 1,
				inputTokens: v4Usage.inputTokens,
				outputTokens: v4Usage.outputTokens,
				reasoningTokens: 0,
				costMicrodollars: v4Usage.costMicrodollars
			},

			offerings: mapOfferings(v4.offerings as Record<string, unknown> | undefined, sources)
		};
	}

	// ── Legacy V2/V3 path ──

	const sources: RenderableSource[] = (b.sources ?? []).map((s, i) => {
		const cls = classifyViewSource(
			{ sourceType: s.sourceType ?? '', url: s.url ?? '', currentness: s.currentness ?? '' },
			i,
			s.description || s.title
		);
		return {
			id: String(s.id ?? i + 1),
			label: s.title || s.description || `Source ${i + 1}`,
			url: s.url ?? null,
			class: cls.class,
			currentness: cls.currentness,
			termOrDate: cls.termOrDate
		};
	});

	const professorRaw = b.professor ?? '';
	const hasRmp = b.rmpRating && b.rmpRating !== 'N/A' && b.rmpRating.trim();
	const hasHistoricalOutline = sources.some(
		(s) => s.class === 'official_outline' && s.currentness === 'historical'
	);

	const legacyDefault: EvidenceStatus = 'unknown';

	return {
		courseCode: b.code,
		title: b.name,
		institution: b.institution,
		officialDomain: null,
		confidence: null,
		researchedAt: b.researchedAt,
		schemaVersion: b.schemaVersion,
		evidenceSummary: evidenceSummary(sources),
		isLegacy,
		legacyLabel: isLegacy ? 'Legacy briefing' : null,

		summary: safeLegacySummary(b.summary || b.recommendation)
			? {
					id: 'summary',
					title: 'Summary',
					text: b.summary || b.recommendation,
					status: legacyDefault,
					sourceIds: [],
					explanation: null
				}
			: null,

		description: null,
		credits: null,
		prerequisites:
			b.prerequisites || b.prereqReadiness
				? {
						id: 'prerequisites',
						title: 'Prerequisites',
						text: b.prerequisites || b.prereqReadiness,
						status: legacyDefault,
						sourceIds: [],
						explanation: null
					}
				: null,
		corequisites: null,
		restrictions: null,
		delivery: null,

		workload:
			b.workload && b.workload !== 'Not verified'
				? {
						id: 'workload',
						title: hasHistoricalOutline ? 'Historical workload' : 'Workload',
						text: b.workload,
						status: hasHistoricalOutline ? 'verified_historical' : legacyDefault,
						sourceIds: [],
						explanation: hasHistoricalOutline ? 'Based on historical course outline' : null
					}
				: null,

		assessments:
			b.gradeStructure && b.gradeStructure.length > 0
				? {
						id: 'assessments',
						title: hasHistoricalOutline ? 'Historical assessment structure' : 'Grade Structure',
						text: '',
						status: hasHistoricalOutline ? 'verified_historical' : legacyDefault,
						sourceIds: [],
						explanation: null
					}
				: null,

		professor: {
			requestedName: b.identity?.courseCode
				? (b.instructor?.requestedName ?? b.instructor?.name) || null
				: professorRaw && professorRaw !== 'N/A' && professorRaw !== 'Not requested'
					? professorRaw.split(/\s*[,(]\s*/)[0]?.trim() || professorRaw
					: null,
			assignmentStatus: 'not_verified',
			assignmentDetail: null,
			facultyAffiliation: sources.some((s) => s.class === 'official_faculty')
				? 'Listed in Douglas College faculty directory'
				: null,
			facultySourceIds: sources.filter((s) => s.class === 'official_faculty').map((s) => s.id),
			currentListedInstructor: null
		},

		studentReviews: hasRmp
			? {
					present: true,
					label: b.rmpRating,
					rating: parseFloat(b.rmpRating.split(' ')[0]) || null,
					ratingCount: b.rmpCount ?? null,
					wouldTakeAgainPercent: null,
					difficulty: null,
					themes: [],
					sourceIds: sources.filter((s) => s.class === 'rmp_review').map((s) => s.id),
					rmpNote:
						'Student-reported; not official evidence of teaching history, course identity, assignment, or offering.'
				}
			: null,
		studentSentiment: null,

		claims: (b.claims ?? []).map(
			(c): RenderableClaim => ({
				id: c.id || `legacy-${b.code}`,
				text: c.text,
				status: 'unknown',
				sourceIds: c.sourceIds ?? [],
				explanation: null
			})
		),

		sources,

		assessmentComponents: mapLegacyAssessmentComponents(
			b.gradeStructure,
			sources,
			hasHistoricalOutline
		),
		assessmentHistoryNote: hasHistoricalOutline
			? assessmentHistoryNoteFromSources(sources) ||
				'Based on a historical official outline \u2014 may not reflect the current offering'
			: null,
		passingRequirements: mapLegacyPassingRules(b.recommendation, sources, hasHistoricalOutline),

		gradeBreakdown: b.gradeStructure?.length ? b.gradeStructure : null,
		gradeNotes: hasHistoricalOutline
			? 'Based on a historical official outline \u2014 may not reflect the current offering'
			: null,
		contradictions: b.contradictions ?? [],
		missingEvidence: b.missingEvidence ?? [],
		workloadHoursPerWeek: null,

		usage: { available: false, reason: 'legacy_briefing' as const },
		offerings: null
	};
}

// ── Private helpers (not extracted because they're tightly coupled to toDetailViewModel) ──

function mapOfferings(
	raw: Record<string, unknown> | undefined | null,
	_sources: RenderableSource[]
): { current?: CourseOfferingView; upcoming?: CourseOfferingView } | null {
	if (!raw) return null;
	const result: { current?: CourseOfferingView; upcoming?: CourseOfferingView } = {};
	for (const key of ['current', 'upcoming'] as const) {
		const obj = safeObject((raw as Record<string, unknown>)[key]);
		if (!obj || typeof obj.term !== 'object' || !(obj.term as Record<string, unknown>)?.label)
			continue;
		const inst = safeObject(obj.instructor);
		const labels: Record<string, string> = {
			official: 'Verified from official source',
			user_confirmed: 'User confirmed',
			student_reported: 'Student-reported',
			unverified: 'Not verified'
		};
		const verification = String(inst.verification ?? 'unverified');
		result[key] = {
			term: String((obj.term as Record<string, unknown>).label),
			relationship: String(obj.relationship ?? 'current') as CourseOfferingView['relationship'],
			instructor: inst.name
				? ({
						name: String(inst.name),
						verification,
						sourceLabel: labels[String(inst.verification ?? 'unverified')] ?? 'Not verified'
					} as CourseOfferingView['instructor'])
				: null,
			crn: typeof obj.crn === 'string' ? obj.crn : undefined,
			section: typeof obj.section === 'string' ? obj.section : undefined,
			campus: typeof obj.campus === 'string' ? obj.campus : undefined,
			modality: typeof obj.modality === 'string' ? obj.modality : undefined,
			schedule: typeof obj.schedule === 'string' ? obj.schedule : undefined,
			sourceIds: safeArray(obj.sourceIds)
		};
	}
	return result.current || result.upcoming ? result : null;
}
