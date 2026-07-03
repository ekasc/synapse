import type { Briefing } from './schema';
import { BRIEFING_SCHEMA_VERSION } from './schema';

type RawSource = {
	description?: unknown;
	url?: unknown;
	found?: unknown;
};

type RawGradeItem = {
	item?: unknown;
	weight?: unknown;
};

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

const HTTP_URL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

function requiredString(value: unknown, field: string): string {
	const normalized = typeof value === 'string' ? value.trim() : '';
	if (!normalized) throw new ValidationError(`${field} is required`);
	return normalized;
}

function optionalString(value: unknown): string | null {
	if (value == null) return null;
	const normalized = String(value).trim();
	return normalized || null;
}

function normalizeRmpRating(value: unknown): string {
	if (value == null) return 'N/A';
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed || 'N/A';
	}
	return 'N/A';
}

function normalizeRmpCount(value: unknown): number | null {
	if (value == null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGradeStructure(value: unknown): Briefing['gradeStructure'] {
	if (!Array.isArray(value)) return [];

	return value
		.map((entry: RawGradeItem) => ({
			item: typeof entry?.item === 'string' ? entry.item.trim() : '',
			weight: typeof entry?.weight === 'string' ? entry.weight.trim() : ''
		}))
		.filter((entry) => entry.item && entry.weight);
}

function normalizeSources(value: unknown): Briefing['sources'] {
	if (!Array.isArray(value)) {
		throw new ValidationError('sources must be an array');
	}

	const sources = value.map((entry: RawSource) => {
		const description = requiredString(entry?.description, 'source description');
		const found = entry?.found === true;
		const url = optionalString(entry?.url);

		if (found) {
			if (!url) {
				throw new ValidationError('Found sources must include a URL');
			}
			if (!HTTP_URL.test(url)) {
				throw new ValidationError(`Source URL "${url}" must be http/https`);
			}
		}

		return { description, url: url ?? undefined, found };
	});

	if (!sources.some((source) => source.found)) {
		throw new ValidationError('At least one found source is required');
	}

	return sources;
}

function toBriefing(output: unknown, modelUsed: string): Briefing {
	if (!output || typeof output !== 'object') {
		throw new ValidationError('Output is not an object');
	}

	const obj = output as Record<string, unknown>;

	return {
		code: requiredString(obj.code, 'code').toUpperCase(),
		name: requiredString(obj.name, 'name'),
		institution: requiredString(obj.institution, 'institution'),
		professor: requiredString(obj.professor, 'professor'),
		rmpRating: normalizeRmpRating(obj.rmpRating),
		rmpCount: normalizeRmpCount(obj.rmpCount),
		workload: requiredString(obj.workload, 'workload'),
		weeklyHours: optionalString(obj.weeklyHours),
		prereqReadiness: requiredString(obj.prereqReadiness, 'prereqReadiness'),
		gradeStructure: normalizeGradeStructure(obj.gradeStructure),
		recommendation: requiredString(obj.recommendation, 'recommendation'),
		sources: normalizeSources(obj.sources),
		researchedAt: new Date().toISOString(),
		modelUsed,
		schemaVersion: BRIEFING_SCHEMA_VERSION
	};
}

export function parseBriefingContent(content: string, modelUsed: string): Briefing {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (err) {
		throw new ValidationError(
			`Model returned invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`
		);
	}
	return toBriefing(parsed, modelUsed);
}

export function parseCachedBriefing(content: string): Briefing {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch (err) {
		throw new ValidationError(
			`Cached briefing is not valid JSON: ${err instanceof Error ? err.message : 'parse error'}`
		);
	}
	if (!parsed || typeof parsed !== 'object') {
		throw new ValidationError('Cached briefing is not an object');
	}
	const obj = parsed as Record<string, unknown>;
	const required = [
		'code',
		'name',
		'institution',
		'professor',
		'rmpRating',
		'workload',
		'prereqReadiness',
		'recommendation',
		'sources',
		'gradeStructure',
		'researchedAt',
		'modelUsed',
		'schemaVersion'
	];
	for (const field of required) {
		if (!(field in obj)) {
			throw new ValidationError(`Cached briefing missing field: ${field}`);
		}
	}
	return parsed as Briefing;
}

export function extractBriefingContent(raw: string | null | undefined): string {
	if (typeof raw !== 'string') {
		throw new ValidationError('LLM returned no JSON content');
	}
	const trimmed = raw.trim();
	if (!trimmed) {
		throw new ValidationError('LLM returned no JSON content');
	}
	return trimmed;
}

export function validateBriefing(output: unknown): Briefing {
	return toBriefing(output, 'unknown');
}
