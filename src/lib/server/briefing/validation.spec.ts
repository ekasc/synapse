import { describe, expect, it } from 'vitest';
import { extractBriefingJson, validateBriefing, ValidationError } from './validation';

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
	it('extracts the first JSON object from provider text', () => {
		const extracted = extractBriefingJson(
			`Here is the result:\n\n\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\``
		);

		expect(JSON.parse(extracted)).toMatchObject({
			code: 'CSIS 3375',
			name: 'Software Engineering'
		});
	});

	it('normalizes a valid course briefing for storage', () => {
		const result = validateBriefing(validOutput);

		expect(result).toMatchObject({
			code: 'CSIS 3375',
			name: 'Software Engineering',
			weeklyHours: '6-8',
			sources: [{ found: true }, { found: false }]
		});
	});

	it('rejects found sources without an http URL', () => {
		const output = {
			...validOutput,
			sources: [{ description: 'Official source', url: 'example.edu/course', found: true }]
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
});
