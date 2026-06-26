import type { Briefing } from '$lib/server/db/d1';

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
		const url = optionalString(entry?.url) ?? undefined;

		if (found && !url) {
			throw new ValidationError('Found sources must include a URL');
		}

		if (url && !/^https?:\/\//i.test(url)) {
			throw new ValidationError(`Source URL "${url}" must be http/https`);
		}

		return { description, url, found };
	});

	if (!sources.some((source) => source.found)) {
		throw new ValidationError('At least one found source is required');
	}

	return sources;
}

export function extractBriefingJson(text: string): string {
	const firstBrace = text.indexOf('{');
	const lastBrace = text.lastIndexOf('}');

	if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
		throw new ValidationError('No JSON object found in response');
	}

	return text.slice(firstBrace, lastBrace + 1);
}

export function validateBriefing(output: unknown): Briefing {
	if (!output || typeof output !== 'object') {
		throw new ValidationError('Output is not an object');
	}

	const obj = output as Record<string, unknown>;
	const rmpCount = obj.rmpCount == null ? undefined : Number(obj.rmpCount);

	return {
		code: requiredString(obj.code, 'code').toUpperCase(),
		name: requiredString(obj.name, 'name'),
		institution: requiredString(obj.institution, 'institution'),
		professor: requiredString(obj.professor, 'professor'),
		rmpRating: requiredString(obj.rmpRating, 'rmpRating'),
		rmpCount: Number.isFinite(rmpCount) ? rmpCount : undefined,
		workload: requiredString(obj.workload, 'workload'),
		weeklyHours: optionalString(obj.weeklyHours),
		prereqReadiness: requiredString(obj.prereqReadiness, 'prereqReadiness'),
		gradeStructure: normalizeGradeStructure(obj.gradeStructure),
		recommendation: requiredString(obj.recommendation, 'recommendation'),
		sources: normalizeSources(obj.sources),
		researchedAt: new Date().toISOString()
	};
}
