/**
 * Single source of truth for Course Brief shape, schema version, and validation.
 *
 * `BRIEFING_JSON_SCHEMA` is the strict JSON Schema enforced by the LLM provider.
 * `Briefing` is the TypeScript type that mirrors the schema.
 * `BRIEFING_SCHEMA_VERSION` is part of the cache key so any schema change
 * automatically invalidates cached outputs.
 */

export const BRIEFING_SCHEMA_VERSION = 1 as const;

export type Briefing = {
	code: string;
	name: string;
	institution: string;
	professor: string;
	rmpRating: string;
	rmpCount: number | null;
	workload: string;
	weeklyHours: string | null;
	prereqReadiness: string;
	gradeStructure: { item: string; weight: string }[];
	recommendation: string;
	sources: { description: string; url?: string; found: boolean }[];
	researchedAt: string;
	modelUsed: string;
	schemaVersion: number;
};

export type BriefingRequest = {
	courseCode: string;
	courseName?: string;
	professorName?: string;
	institution?: string;
	additionalNotes?: string;
};

export const BRIEFING_JSON_SCHEMA = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'synapse.course_briefing.v1',
	type: 'object',
	additionalProperties: false,
	required: [
		'code',
		'name',
		'institution',
		'professor',
		'rmpRating',
		'rmpCount',
		'workload',
		'weeklyHours',
		'prereqReadiness',
		'gradeStructure',
		'recommendation',
		'sources'
	],
	properties: {
		code: { type: 'string', minLength: 1 },
		name: { type: 'string', minLength: 1 },
		institution: { type: 'string', minLength: 1 },
		professor: { type: 'string', minLength: 1 },
		rmpRating: { type: 'string', minLength: 1 },
		rmpCount: { type: ['number', 'null'] },
		workload: { type: 'string', minLength: 1 },
		weeklyHours: { type: ['string', 'null'] },
		prereqReadiness: { type: 'string', minLength: 1 },
		gradeStructure: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['item', 'weight'],
				properties: {
					item: { type: 'string', minLength: 1 },
					weight: { type: 'string', minLength: 1 }
				}
			}
		},
		recommendation: { type: 'string', minLength: 1 },
		sources: {
			type: 'array',
			minItems: 1,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['description', 'found'],
				properties: {
					description: { type: 'string', minLength: 1 },
					url: { type: ['string', 'null'] },
					found: { type: 'boolean' }
				}
			}
		}
	}
} as const;
