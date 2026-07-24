/**
 * Source classification, term extraction, and text-parsing helpers for the briefing view model.
 * Extracted from view-model.ts — keep in sync with the facade re-exports.
 */

import type {
	SourceClass,
	SourceCurrentness,
	RenderableSource
} from './briefing-types';

// ── Source classification (view-specific, separate from accuracy-gate) ──

export function classifyViewSource(
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

export function classifySourceType(raw: string, url: string, description?: string): SourceClass {
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

export function extractTerm(url: string, description?: string): string | null {
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

export function classifyCurrentness(raw: string, termOrDate: string | null): SourceCurrentness {
	if (raw === 'current' || raw === 'historical') return raw as SourceCurrentness;
	if (termOrDate) {
		const year = parseInt(termOrDate.slice(0, 4));
		if (!isNaN(year) && year < 2026) return 'historical';
		return 'current';
	}
	return 'unknown';
}

// ── Safe accessors ──

export function safeText(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

export function safeArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [];
}

export function safeObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

// ── Text parsing ──

export function parseRatingFromText(text: string): number | null {
	if (!text) return null;
	const m = text.match(/(?:overall\s+)?rating\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(?:\/\s*5)?/i);
	if (!m) return null;
	const n = parseFloat(m[1]);
	return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

export function parseRatingCountFromText(text: string): number | null {
	if (!text) return null;
	const m = text.match(/based\s+on\s+(\d+)\s+ratings?/i);
	if (!m) return null;
	const n = parseInt(m[1], 10);
	return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseWouldTakeAgainFromText(text: string): number | null {
	if (!text) return null;
	const m = text.match(/(\d+)\s*%\s*(?:of\s+(?:students|raters)\s+)?would\s+take\s+again/i);
	if (!m) return null;
	const n = parseInt(m[1], 10);
	return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export function parseSentimentFromRmpText(
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

export function safeLegacySummary(text: string | undefined | null): string | null {
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

// ── Evidence summary ──

export function evidenceSummary(sources: RenderableSource[]): string {
	const hasCurrent = sources.some((s) => s.currentness === 'current');
	const hasHistorical = sources.some((s) => s.currentness === 'historical');
	if (hasCurrent && hasHistorical) return 'Current and historical evidence';
	if (hasCurrent) return 'Current evidence';
	if (hasHistorical) return 'Historical evidence';
	return 'Currentness unavailable';
}
