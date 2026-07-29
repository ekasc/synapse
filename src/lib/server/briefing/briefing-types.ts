/**
 * Briefing detail view model types.
 * Extracted from view-model.ts — keep in sync with the facade re-exports.
 */

import type { AssessmentCategory, AssessmentComponent, PassingRequirement, Currentness } from './schema';

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
