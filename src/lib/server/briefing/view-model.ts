/**
 * Canonical UI view model for Course Brief detail pages.
 * All V2/V3/V4 branching is centralized in toDetailViewModel().
 */

import type { Briefing } from '$lib/server/db/d1';
import { isCleanCourseField, type CourseOutlineField } from './field-quality';
import type {
	AssessmentCategory,
	AssessmentComponent,
	PassingRequirement,
	Currentness
} from './schema';

// ── Source classification ──

export type SourceClass =
	| 'official_catalog'
	| 'official_outline'
	| 'official_schedule'
	| 'official_faculty'
	| 'rmp_review'
	| 'secondary'
	| 'unknown';

export type SourceCurrentness = Currentness;

export type RenderableSource = {
	id: string;
	label: string;
	url: string | null;
	class: SourceClass;
	currentness: SourceCurrentness;
	termOrDate: string | null;
};

// ── Evidence status ──

export type EvidenceStatus =
	| 'verified_current'
	| 'verified_historical'
	| 'supported_non_official'
	| 'inferred'
	| 'unknown'
	| 'contradicted';

// ── Structured sections ──

export type StructuredSection = {
	id: string;
	title: string;
	text: string;
	status: EvidenceStatus;
	sourceIds: string[];
	explanation: string | null;
};

// ── Claims ──

export type RenderableClaim = {
	id: string;
	text: string;
	status: EvidenceStatus;
	sourceIds: string[];
	explanation: string | null;
};

// ── Professor ──

export type ProfessorView = {
	requestedName: string | null;
	assignmentStatus:
		| 'verified_current_official'
		| 'supported_current_non_official'
		| 'verified_historical'
		| 'contradicted'
		| 'not_verified'
		| 'not_requested';
	assignmentDetail: string | null;
	facultyAffiliation: string | null;
	facultySourceIds: string[];
	currentListedInstructor: string | null;
};

export type CourseOfferingView = {
	term: string;
	relationship: 'current' | 'upcoming' | 'historical';
	instructor: {
		name: string;
		verification: 'official' | 'user_confirmed' | 'student_reported' | 'unverified';
		sourceLabel?: string;
	} | null;
	crn?: string;
	section?: string;
	campus?: string;
	modality?: string;
	schedule?: string;
	sourceIds: string[];
};

export type StudentReviewView = {
	present: boolean;
	label: string;
	rating: number | null;
	ratingCount: number | null;
	wouldTakeAgainPercent: number | null;
	difficulty: number | null;
	themes: string[];
	sourceIds: string[];
	rmpNote: string | null;
};

export type StudentSentimentView = {
	positives: string[];
	concerns: string[];
	sampleSize: number | null;
	courseSpecific: boolean;
	sourceIds: string[];
};

// ── Assessment view ──

export type AssessmentComponentView = {
	label: string;
	minWeight: number | null;
	maxWeight: number | null;
	exactWeight: number | null;
	weightDisplay: string;
	category: AssessmentCategory;
	currentness: Currentness;
	term: string | null;
	sourceIds: string[];
	note: string | null;
};

export type PassingRequirementView = {
	ruleText: string;
	ruleType: string;
	threshold: number | null;
	currentness: Currentness;
	term: string | null;
	sourceIds: string[];
	explanation: string | null;
};

// ── Usage ──

export type UsageView =
	| {
			available: true;
			freshSearches: number;
			cachedCategories: number;
			synthesisAttempts: number;
			inputTokens: number;
			outputTokens: number;
			reasoningTokens: number;
			costMicrodollars: number;
	  }
	| { available: false; reason: 'legacy_briefing' | 'missing_data' };

// ── Detail view model ──

export type BriefingDetailViewModel = {
	courseCode: string;
	title: string;
	institution: string;
	officialDomain: string | null;
	confidence: string | null;
	researchedAt: string;
	schemaVersion: number;
	evidenceSummary: string;
	isLegacy: boolean;
	legacyLabel: string | null;

	summary: StructuredSection | null;
	description: StructuredSection | null;
	credits: StructuredSection | null;
	prerequisites: StructuredSection | null;
	corequisites: StructuredSection | null;
	restrictions: string | null;
	delivery: StructuredSection | null;
	workload: StructuredSection | null;
	assessments: StructuredSection | null;

	professor: ProfessorView;
	studentReviews: StudentReviewView | null;
	studentSentiment: StudentSentimentView | null;

	claims: RenderableClaim[];
	sources: RenderableSource[];

	assessmentComponents: AssessmentComponentView[] | null;
	assessmentHistoryNote: string | null;
	passingRequirements: PassingRequirementView[] | null;

	gradeBreakdown: { item: string; weight: string }[] | null;
	gradeNotes: string | null;

	contradictions: string[];
	missingEvidence: string[];

	workloadHoursPerWeek: number | null;

	usage: UsageView;

	offerings: {
		current?: CourseOfferingView;
		upcoming?: CourseOfferingView;
	} | null;
};

// ── Helpers ──

function classifySource(
	source: Record<string, unknown>,
	_i: number,
	description?: string
): { class: SourceClass; currentness: SourceCurrentness; termOrDate: string | null } {
	const rawType = String(source.sourceType ?? '');
	const url = String(source.url ?? '');
	const rawCurrentness = String(source.currentness ?? '');

	const sourceClass = classifySourceType(rawType, url, description);
	const termOrDate = extractTerm(url, description);
	const currentness = classifyCurrentness(rawCurrentness, termOrDate);

	return { class: sourceClass, currentness, termOrDate };
}

function classifySourceType(raw: string, url: string, description?: string): SourceClass {
	const desc = (description ?? '').toLowerCase();
	if (raw === 'rmp' || url.includes('ratemyprofessors')) return 'rmp_review';
	if (!url)
		return raw === 'official' ? 'official_catalog' : raw === 'rmp' ? 'rmp_review' : 'unknown';
	try {
		const host = new URL(url).hostname;
		const path = new URL(url).pathname.toLowerCase();
		if (host.includes('ratemyprofessors')) return 'rmp_review';
		if (host.includes('douglascollege.ca') || host.includes('douglascollege')) {
			if (path.includes('faculty') || path.includes('people') || path.includes('computing-studies'))
				return 'official_faculty';
			if (/20[12]\d[0-3]\d/.test(path) || /\d[46]$/.test(path)) return 'official_outline';
			if (path.includes('schedule') || path.includes('timetable')) return 'official_schedule';
			if (desc.includes('outline')) return 'official_outline';
			if (desc.includes('timetable') || desc.includes('schedule')) return 'official_schedule';
			return 'official_catalog';
		}
	} catch {
		/* fall through */
	}
	return raw === 'official' ? 'official_catalog' : raw === 'rmp' ? 'rmp_review' : 'unknown';
}

function extractTerm(url: string, description?: string): string | null {
	try {
		const m = new URL(url).pathname.match(/(\d{4}[0-3]\d|\d{6})/);
		if (m) return m[1];
	} catch {
		/* ignore */
	}
	const desc = (description ?? '').toLowerCase();
	const termMatch = desc.match(/(fall|spring|summer|winter)\s*(20\d{2})/i);
	if (termMatch) return `${termMatch[1]} ${termMatch[2]}`;
	return null;
}

function classifyCurrentness(raw: string, termOrDate: string | null): SourceCurrentness {
	if (raw === 'current' || raw === 'historical') return raw as SourceCurrentness;
	if (termOrDate) {
		const year = parseInt(termOrDate.slice(0, 4));
		if (!isNaN(year) && year < 2026) return 'historical';
		return 'current';
	}
	return 'unknown';
}

function safeText(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function safeArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [];
}

function safeObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function parseRatingFromText(text: string): number | null {
	if (!text) return null;
	const m = text.match(/(?:overall\s+)?rating\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:\/\s*5)?/i);
	if (!m) return null;
	const n = parseFloat(m[1]);
	return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

function parseRatingCountFromText(text: string): number | null {
	if (!text) return null;
	const m = text.match(/based\s+on\s+(\d+)\s+ratings?/i);
	if (!m) return null;
	const n = parseInt(m[1], 10);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseWouldTakeAgainFromText(text: string): number | null {
	if (!text) return null;
	const m = text.match(/(\d+)\s*%\s*(?:of\s+(?:students|raters)\s+)?would\s+take\s+again/i);
	if (!m) return null;
	const n = parseInt(m[1], 10);
	return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function parseSentimentFromRmpText(
	text: string
): { positives: string[]; concerns: string[] } {
	if (!text) return { positives: [], concerns: [] };
	const positives: string[] = [];
	const concerns: string[] = [];
	const positiveMarkers =
		/\b(?:others?\s+praise[^.]*\.|positive\s+reviews?\s+(?:mention|include)[^.]*\.|praises?\s+[^.]*\.|[^.]*praise\s+him[^.]*\.)/gi;
	const concernMarkers =
		/\b(?:some\s+students\s+(?:find|report|complain)[^.]*\.|critics?\s+(?:mention|note)[^.]*\.|concerns?\s+(?:include|are)[^.]*\.|negative\s+reviews?\s+(?:mention|include)[^.]*\.)/gi;
	const clean = (s: string) =>
		s
			.replace(/^[.\s]+|[.\s]+$/g, '')
			.replace(/^(others?|some\s+students?|critics?|praises?|concerns?)\s+/i, '')
			.trim();
	let m: RegExpExecArray | null;
	while ((m = positiveMarkers.exec(text)) !== null) {
		const c = clean(m[0]);
		if (c.length > 12) positives.push(c);
	}
	while ((m = concernMarkers.exec(text)) !== null) {
		const c = clean(m[0]);
		if (c.length > 12) concerns.push(c);
	}
	return { positives, concerns };
}

// ── Mapper ──

function mapV4Components(
	raw: Array<Record<string, unknown>> | undefined | null,
	sources: RenderableSource[]
): AssessmentComponentView[] | null {
	if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
	return raw.map((c) => ({
		label: String(c.label ?? ''),
		minWeight: typeof c.minWeight === 'number' ? c.minWeight : null,
		maxWeight: typeof c.maxWeight === 'number' ? c.maxWeight : null,
		exactWeight: typeof c.exactWeight === 'number' ? c.exactWeight : null,
		weightDisplay: componentWeightDisplay(c),
		category: String(c.category ?? 'other') as AssessmentCategory,
		currentness: String(c.currentness ?? 'unknown') as Currentness,
		term: typeof c.term === 'string' ? c.term : null,
		sourceIds: safeArray(c.sourceIds),
		note: typeof c.note === 'string' ? c.note : null
	}));
}

function componentWeightDisplay(c: Record<string, unknown>): string {
	if (typeof c.exactWeight === 'number') return `${c.exactWeight}%`;
	const min = typeof c.minWeight === 'number' ? c.minWeight : null;
	const max = typeof c.maxWeight === 'number' ? c.maxWeight : null;
	if (min !== null && max !== null) return `${min}\u2013${max}%`;
	if (min !== null) return `${min}%+`;
	if (max !== null) return `\u2264${max}%`;
	return 'Weight not found';
}

function assessmentComponentsFromText(
	section: StructuredSection | null,
	sources: RenderableSource[]
): AssessmentComponentView[] | null {
	if (!section?.text) return null;
	const sourceSet = new Set(section.sourceIds);
	const relatedSources = sources.filter((source) => sourceSet.has(source.id));
	const currentness: Currentness = relatedSources.some((source) => source.currentness === 'current')
		? 'current'
		: relatedSources.some((source) => source.currentness === 'historical')
			? 'historical'
			: 'unknown';
	const components: AssessmentComponentView[] = [];
	const pattern = /(?:^|[.;,]\s*)([^.;,]+?)\s*:?\s*(\d{1,3})%?\s*(?:-|\u2013)\s*(\d{1,3})%/g;
	for (const match of section.text.matchAll(pattern)) {
		const label = match[1].trim();
		const minWeight = Number(match[2]);
		const maxWeight = Number(match[3]);
		if (!label || minWeight > 100 || maxWeight > 100) continue;
		components.push({
			label,
			minWeight,
			maxWeight,
			exactWeight: minWeight === maxWeight ? minWeight : null,
			weightDisplay: minWeight === maxWeight ? `${minWeight}%` : `${minWeight}\u2013${maxWeight}%`,
			category: inferAssessmentCategory(label),
			currentness,
			term: relatedSources.find((source) => source.termOrDate)?.termOrDate ?? null,
			sourceIds: section.sourceIds,
			note: null
		});
	}
	return components.length ? components : null;
}

function mapV4PassingRules(
	raw: Array<Record<string, unknown>> | undefined | null
): PassingRequirementView[] | null {
	if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
	return raw.map((r) => ({
		ruleText: String(r.ruleText ?? ''),
		ruleType: String(r.ruleType ?? 'other'),
		threshold: typeof r.threshold === 'number' ? r.threshold : null,
		currentness: String(r.currentness ?? 'unknown') as Currentness,
		term: typeof r.term === 'string' ? r.term : null,
		sourceIds: safeArray(r.sourceIds),
		explanation: typeof r.explanation === 'string' ? r.explanation : null
	}));
}

function assessmentHistoryNoteFromSources(sources: RenderableSource[]): string | null {
	const hasHistorical = sources.some(
		(s) => s.currentness === 'historical' && s.class === 'official_outline'
	);
	if (!hasHistorical) return null;
	const hSrc = sources.find(
		(s) => s.currentness === 'historical' && s.class === 'official_outline'
	);
	return hSrc?.termOrDate
		? `Based on the ${hSrc.termOrDate} official outline \u2014 may not reflect the current offering`
		: 'Based on a historical official outline \u2014 may not reflect the current offering';
}

function mapLegacyAssessmentComponents(
	gradeStructure: { item: string; weight: string }[] | undefined | null,
	sources: RenderableSource[],
	hasHistoricalOutline: boolean
): AssessmentComponentView[] | null {
	if (!gradeStructure || gradeStructure.length === 0) return null;
	return gradeStructure.map((g) => {
		const { minWeight, maxWeight, exactWeight, weightDisplay } = parseLegacyWeight(g.weight);
		return {
			label: g.item,
			minWeight,
			maxWeight,
			exactWeight,
			weightDisplay,
			category: inferAssessmentCategory(g.item),
			currentness: hasHistoricalOutline ? 'historical' : 'unknown',
			term: null,
			sourceIds: [],
			note: null
		};
	});
}

function parseLegacyWeight(weight: string): {
	minWeight: number | null;
	maxWeight: number | null;
	exactWeight: number | null;
	weightDisplay: string;
} {
	const trimmed = weight.trim();
	if (/^\d{1,3}%$/.test(trimmed)) {
		const v = parseInt(trimmed);
		return { minWeight: v, maxWeight: v, exactWeight: v, weightDisplay: `${v}%` };
	}
	const rangeMatch = trimmed.match(/(\d{1,3})%?\s*[\-\u2013]\s*(\d{1,3})%/);
	if (rangeMatch) {
		const min = parseInt(rangeMatch[1]);
		const max = parseInt(rangeMatch[2]);
		return {
			minWeight: min,
			maxWeight: max,
			exactWeight: null,
			weightDisplay: `${min}\u2013${max}%`
		};
	}
	return { minWeight: null, maxWeight: null, exactWeight: null, weightDisplay: trimmed };
}

function inferAssessmentCategory(label: string): AssessmentCategory {
	const lower = label.toLowerCase();
	if (lower.includes('assignment') || lower.includes('homework')) return 'assignments';
	if (lower.includes('lab')) return 'labs';
	if (lower.includes('quiz')) return 'quizzes';
	if (lower.includes('midterm')) return 'midterm';
	if (lower.includes('final exam') || lower.includes('final_exam')) return 'final_exam';
	if (lower.includes('research project') || lower.includes('research_project'))
		return 'research_project';
	if (lower.includes('project')) return 'project';
	if (lower.includes('presentation')) return 'presentation';
	if (lower.includes('participation')) return 'participation';
	return 'other';
}

function mapLegacyPassingRules(
	recommendation: string | undefined | null,
	sources: RenderableSource[],
	hasHistoricalOutline: boolean
): PassingRequirementView[] | null {
	if (!recommendation) return null;
	const lower = recommendation.toLowerCase();
	const rules: PassingRequirementView[] = [];
	const examMatch = lower.match(
		/(exam[^.]*?(?:require|must|need|at least|minimum|pass)[^.]*?(?:\d{1,3})[^.]*%[^.]*?(?:combined|overall|total)?[^.]*)/i
	);
	if (examMatch) {
		const pctMatch = examMatch[0].match(/(\d{1,3})\s*%/);
		const threshold = pctMatch ? parseInt(pctMatch[1]) : null;
		const isCombined = /combined|overall|total/i.test(examMatch[0]);
		rules.push({
			ruleText: examMatch[0].trim(),
			ruleType: isCombined ? 'combined_exam_minimum' : 'other',
			threshold,
			currentness: hasHistoricalOutline ? 'historical' : 'unknown',
			term: null,
			sourceIds: [],
			explanation: hasHistoricalOutline ? 'Derived from historical course outline' : null
		});
	}
	return rules.length > 0 ? rules : null;
}

function safeLegacySummary(text: string | undefined | null): string | null {
	if (!text) return null;
	const lower = text.toLowerCase();
	const hasRmpTeaching =
		/taught\b[^.]*?\brate\s*my\s*professors?\b/i.test(text) ||
		/has\s+taught\b[^.]*?\brate\s*my\s*professors?\b/i.test(text) ||
		/previously\b[^.]*?\brate\s*my\s*professors?\b/i.test(text) ||
		/\brmp\b[^.]*?(?:teach|taught|instructor|assigned)/i.test(lower);
	if (hasRmpTeaching) return null;
	return text;
}

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
				const cls = classifySource(s, 0, String(s.title ?? s.description ?? ''));
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
				mapV4Components(v4.assessmentComponents, sources) ??
				assessmentComponentsFromText(assessmentsSection, sources),
			assessmentHistoryNote: assessmentHistoryNoteFromSources(sources),
			passingRequirements: mapV4PassingRules(v4.passingRequirements),

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
		const cls = classifySource(
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

function mapOfferings(
	raw: Record<string, unknown> | undefined | null,
	sources: RenderableSource[]
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
		result[key] = {
			term: String((obj.term as Record<string, unknown>).label),
			relationship: String(obj.relationship ?? 'current') as CourseOfferingView['relationship'],
			instructor: inst.name
				? {
						name: String(inst.name),
						verification: String(
							inst.verification ?? 'unverified'
						) as CourseOfferingView['instructor']['verification'],
						sourceLabel: labels[String(inst.verification ?? 'unverified')] ?? 'Not verified'
					}
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

function evidenceSummary(sources: RenderableSource[]): string {
	const hasCurrent = sources.some((s) => s.currentness === 'current');
	const hasHistorical = sources.some((s) => s.currentness === 'historical');
	if (hasCurrent && hasHistorical) return 'Current and historical evidence';
	if (hasCurrent) return 'Current evidence';
	if (hasHistorical) return 'Historical evidence';
	return 'Currentness unavailable';
}
