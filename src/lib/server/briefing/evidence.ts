import { EVIDENCE_BUNDLE_VERSION } from './schema';
import type {
	BriefingRequest,
	BriefingUsage,
	EvidenceBundle,
	EvidenceCategory,
	EvidenceSource
} from './schema';
import { evidenceCategories } from './normalize';
import { matchInstitutionDomain, resolveInstitution } from './accuracy-gate';

export const MAX_SEARCH_RESULTS_RETAINED = 10;
export const MAX_CANDIDATE_SOURCES = 60;
export const MAX_UNIQUE_SOURCES = 20;
export const MAX_SYNTHESIS_SOURCES = 12;
export const MAX_EVIDENCE_CHARACTERS = 18_000;
export const MAX_SOURCE_CHARACTERS = 2_400;

export function canonicalizeHttpUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		if (url.username || url.password) return null;
		url.hash = '';
		url.hostname = url.hostname.toLowerCase();
		url.searchParams.sort();
		for (const key of [...url.searchParams.keys()]) {
			if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
		}
		if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
		return url.toString();
	} catch {
		return null;
	}
}

export function currentnessForUrl(url: string, now = new Date()): EvidenceSource['currentness'] {
	const years = [...url.matchAll(/(?:19|20)\d{2}/g)].map((match) => Number(match[0]));
	if (years.some((year) => year < now.getUTCFullYear() - 2)) return 'historical';
	if (years.some((year) => year >= now.getUTCFullYear() - 1)) return 'current';
	return 'current'; // Undated official pages default to current, not unknown
}

export function sourceTypeForUrl(url: string, institution?: string): EvidenceSource['sourceType'] {
	const host = new URL(url).hostname.toLowerCase();
	if (host.includes('ratemyprofessors.com')) return 'rmp';
	const configured = resolveInstitution(institution);
	if (configured && (host === configured.domain || host.endsWith(`.${configured.domain}`)))
		return 'official';
	if (!configured && matchInstitutionDomain(host)) return 'official';
	return 'other';
}

function fingerprint(value: string): string {
	// Stable non-security fingerprint; persisted only for dedupe/audit correlation.
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
	return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function makeEvidenceSources(
	category: EvidenceCategory,
	items: Array<{
		title: string;
		url: string;
		excerpt: string;
		publisher?: string | null;
		publishedAt?: string | null;
		updatedAt?: string | null;
	}>,
	citedUrls: Iterable<string>,
	request: BriefingRequest,
	retrievedAt = new Date().toISOString()
): EvidenceSource[] {
	const citations = new Set([...citedUrls].map(canonicalizeHttpUrl).filter(Boolean));
	const seen = new Set<string>();
	const sources: EvidenceSource[] = [];
	for (const item of items.slice(0, MAX_SEARCH_RESULTS_RETAINED)) {
		const url = canonicalizeHttpUrl(item.url);
		if (!url || !citations.has(url) || seen.has(url)) continue;
		seen.add(url);
		sources.push({
			id:
				category === 'catalog'
					? `src_${String(sources.length + 1).padStart(2, '0')}`
					: `src_${category.replaceAll('-', '_')}_${String(sources.length + 1).padStart(2, '0')}`,
			category,
			title: String(item.title).trim().slice(0, 300),
			url,
			canonicalUrl: url,
			domain: new URL(url).hostname,
			publisher: item.publisher?.trim() || new URL(url).hostname,
			excerpt: String(item.excerpt).trim().slice(0, 4000),
			sourceType: sourceTypeForUrl(url, request.institution),
			retrievedAt,
			publishedAt: item.publishedAt ?? null,
			updatedAt: item.updatedAt ?? null,
			currentness: currentnessForUrl(
				`${url} ${item.publishedAt ?? ''} ${item.updatedAt ?? ''}`,
				new Date(retrievedAt)
			),
			retrievalStatus: 'retrieved',
			contentFingerprint: fingerprint(`${item.title}\n${item.excerpt}`),
			claimsSupported: []
		});
	}
	return sources;
}

const CATEGORY_TERMS: Partial<Record<EvidenceCategory, RegExp>> = {
	catalog: /course code|course description|credits|course title/i,
	prerequisites: /prerequisite|corequisite|requisite|minimum grade/i,
	outline:
		/means of assessment|assessment|method\(s\) of instruction|learning outcomes|contact hours/i,
	schedule: /\bcrn\b|instructor|start time|end time|fall|winter|spring|summer/i,
	'professor-course': /instructor|faculty|professor|course code/i,
	'professor-profile': /faculty|department|professor|instructor/i,
	'rate-my-professors': /overall quality|rating|would take again|difficulty|professor/i
};

function compactCategoryExcerpt(source: EvidenceSource): string {
	const text = source.excerpt.replace(/\s+/g, ' ').trim();
	if (text.length <= MAX_SOURCE_CHARACTERS) return text;
	const pattern = CATEGORY_TERMS[source.category];
	if (!pattern) return text.slice(0, MAX_SOURCE_CHARACTERS);
	const matches = [
		...text.matchAll(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))
	];
	if (!matches.length) return text.slice(0, MAX_SOURCE_CHARACTERS);
	const windows = matches.slice(0, 6).map((match) => ({
		start: Math.max(0, (match.index ?? 0) - 180),
		end: Math.min(text.length, (match.index ?? 0) + match[0].length + 520)
	}));
	const merged: Array<{ start: number; end: number }> = [];
	for (const window of windows) {
		const previous = merged.at(-1);
		if (previous && window.start <= previous.end) previous.end = Math.max(previous.end, window.end);
		else merged.push(window);
	}
	return merged
		.map(({ start, end }) => text.slice(start, end))
		.join(' … ')
		.slice(0, MAX_SOURCE_CHARACTERS);
}

export function buildEvidenceBundle(
	request: BriefingRequest,
	categorySources: Partial<Record<EvidenceCategory, EvidenceSource[]>>,
	usage: BriefingUsage
): EvidenceBundle {
	const categories = evidenceCategories(request);
	const priority: EvidenceCategory[] = [
		'catalog',
		'outline',
		'prerequisites',
		'schedule',
		'professor-course',
		'professor-profile',
		'rate-my-professors'
	];
	const synthesisOrder = priority.filter((category) => categories.includes(category));
	const queues = new Map(
		synthesisOrder.map((category) => [
			category,
			[...(categorySources[category] ?? [])]
				.sort(
					(left, right) =>
						Number(right.currentness === 'current') - Number(left.currentness === 'current')
				)
				.slice(0, MAX_CANDIDATE_SOURCES)
		])
	);
	let chars = 0;
	const sources: EvidenceSource[] = [];
	const sourceIds = new Set<string>();
	const representedUrls = new Set<string>();
	const add = (source: EvidenceSource, requiredCategory: boolean) => {
		if (sourceIds.has(source.id) || sources.length >= MAX_SYNTHESIS_SOURCES) return;
		// A category's first source is retained even when another category uses the same page.
		// Additional copies of an already represented URL add no new evidence.
		if (!requiredCategory && representedUrls.has(source.canonicalUrl)) return;
		const excerpt = compactCategoryExcerpt(source);
		const remaining = MAX_EVIDENCE_CHARACTERS - chars;
		if (remaining <= 0) return;
		const bounded = excerpt.slice(0, remaining);
		if (!bounded) return;
		sources.push({ ...source, excerpt: bounded });
		sourceIds.add(source.id);
		representedUrls.add(source.canonicalUrl);
		chars += bounded.length;
	};

	// First pass reserves one bounded, category-specific source for every available category.
	for (const category of synthesisOrder) {
		const source = queues.get(category)?.shift();
		if (source) add(source, true);
	}
	// Second pass adds useful distinct URLs without allowing duplicate full pages to crowd out categories.
	for (const category of synthesisOrder) {
		for (const source of queues.get(category) ?? []) add(source, false);
	}
	return {
		version: EVIDENCE_BUNDLE_VERSION,
		request,
		categories,
		sources,
		missingCategories: categories.filter(
			(category) => !sources.some((source) => source.category === category)
		),
		usage
	};
}
