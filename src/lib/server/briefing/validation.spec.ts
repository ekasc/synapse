import { describe, expect, it } from 'vitest';
import {
	extractBriefingContent,
	parseBriefingContent,
	parseCachedBriefing,
	validateBriefing,
	ValidationError
} from './validation';
import { BRIEFING_SCHEMA_VERSION } from './schema';

const validOutput = {
	code: 'CSIS 3375',
	name: 'Software Engineering',
	institution: 'Douglas College',
	professor: 'A. Instructor',
	rmpRating: '4.1 / 5.0',
	rmpCount: 12,
	workload: 'Medium workload with weekly labs',
	weeklyHours: '6-8',
	prereqReadiness: 'Prerequisites not checked against your graph',
	gradeStructure: [{ item: 'Assignments', weight: '40%' }],
	recommendation: 'Confirm the current outline before registering.',
	sources: [
		{
			description: 'Official course outline',
			url: 'https://example.edu/courses/csis-3375',
			found: true
		},
		{
			description: 'RateMyProfessor profile',
			found: false
		}
	]
};

describe('course briefing validation', () => {
	it('extracts a trimmed JSON string from a response', () => {
		const extracted = extractBriefingContent(`  {"code":"CSIS 3375"}  `);
		expect(extracted).toBe('{"code":"CSIS 3375"}');
	});

	it('rejects empty or missing content', () => {
		expect(() => extractBriefingContent('')).toThrow(ValidationError);
		expect(() => extractBriefingContent(null)).toThrow(ValidationError);
		expect(() => extractBriefingContent(undefined)).toThrow(ValidationError);
	});

	it('parses LLM content and stamps model + schema version', () => {
		const briefing = parseBriefingContent(JSON.stringify(validOutput), 'openai/gpt-5.2');
		expect(briefing.code).toBe('CSIS 3375');
		expect(briefing.rmpRating).toBe('4.1 / 5.0');
		expect(briefing.modelUsed).toBe('openai/gpt-5.2');
		expect(briefing.schemaVersion).toBe(BRIEFING_SCHEMA_VERSION);
		expect(briefing.researchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('parses cached content without re-stamping researchedAt', () => {
		const original = {
			...validOutput,
			researchedAt: '2026-01-01T00:00:00.000Z',
			modelUsed: 'deepseek/deepseek-v4-flash',
			schemaVersion: BRIEFING_SCHEMA_VERSION
		};
		const cached = parseCachedBriefing(JSON.stringify(original));
		expect(cached.researchedAt).toBe('2026-01-01T00:00:00.000Z');
		expect(cached.modelUsed).toBe('deepseek/deepseek-v4-flash');
	});

	it('normalizes a valid course briefing for storage', () => {
		const result = validateBriefing(validOutput);
		expect(result).toMatchObject({
			code: 'CSIS 3375',
			name: 'Software Engineering',
			weeklyHours: '6-8',
			sources: [{ found: true }, { found: false }]
		});
		expect(result.modelUsed).toBe('unknown');
		expect(result.schemaVersion).toBe(BRIEFING_SCHEMA_VERSION);
	});

	it('normalizes null rmpRating to "N/A" instead of throwing', () => {
		const result = parseBriefingContent(
			JSON.stringify({ ...validOutput, rmpRating: null }),
			'model'
		);
		expect(result.rmpRating).toBe('N/A');
	});

	it('normalizes rmpCount non-finite values to null', () => {
		const result = parseBriefingContent(
			JSON.stringify({ ...validOutput, rmpCount: 'NaN' }),
			'model'
		);
		expect(result.rmpCount).toBeNull();
	});

	it('rejects found sources without an http URL', () => {
		const output = {
			...validOutput,
			sources: [{ description: 'Official source', url: 'example.edu/course', found: true }]
		};

		expect(() => validateBriefing(output)).toThrow(ValidationError);
	});

	it('rejects found sources with a non-http URL', () => {
		const output = {
			...validOutput,
			sources: [{ description: 'Official source', url: 'ftp://example.edu/course', found: true }]
		};

		expect(() => validateBriefing(output)).toThrow(ValidationError);
	});

	it('rejects briefings without actionable source evidence', () => {
		const output = {
			...validOutput,
			sources: [{ description: 'No public source found', found: false }]
		};

		expect(() => validateBriefing(output)).toThrow('At least one found source is required');
	});

	it('rejects malformed JSON content from the LLM', () => {
		expect(() => parseBriefingContent('not json', 'model')).toThrow(ValidationError);
	});

	it('rejects cached content that is not a Briefing', () => {
		expect(() => parseCachedBriefing('{"code":"x"}')).toThrow(ValidationError);
	});
});
