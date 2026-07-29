/**
 * Assessment component mapping helpers for the briefing view model.
 * Extracted from view-model.ts — keep in sync with the facade re-exports.
 */

import type { AssessmentCategory, Currentness } from './schema';
import type {
	StructuredSection,
	RenderableSource,
	AssessmentComponentView,
	PassingRequirementView
} from './briefing-types';
import { safeArray } from './view-parsing';

// ── V4 assessment components ──

export function mapV4Components(
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

export function componentWeightDisplay(c: Record<string, unknown>): string {
	if (typeof c.exactWeight === 'number') return `${c.exactWeight}%`;
	const min = typeof c.minWeight === 'number' ? c.minWeight : null;
	const max = typeof c.maxWeight === 'number' ? c.maxWeight : null;
	if (min !== null && max !== null) return `${min}\u2013${max}%`;
	if (min !== null) return `${min}%+`;
	if (max !== null) return `\u2264${max}%`;
	return 'Weight not found';
}

export function assessmentComponentsFromText(
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

// ── V4 passing rules ──

export function mapV4PassingRules(
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

// ── Assessment history note ──

export function assessmentHistoryNoteFromSources(sources: RenderableSource[]): string | null {
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

// ── Legacy assessment mapping ──

export function mapLegacyAssessmentComponents(
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

export function parseLegacyWeight(weight: string): {
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

export function inferAssessmentCategory(label: string): AssessmentCategory {
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

export function mapLegacyPassingRules(
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
