import { describe, expect, it } from 'vitest';
import { validateGenerateRequest, validatePracticeResponse, ValidationError } from './schema';

describe('validateGenerateRequest', () => {
	it('accepts a course with an optional trimmed topic', () => {
		expect(validateGenerateRequest({ courseId: 'csis-4495', topic: '  event logging  ' })).toEqual({
			courseId: 'csis-4495',
			topic: 'event logging'
		});
	});

	it('omits an empty topic', () => {
		expect(validateGenerateRequest({ courseId: '  csis-4495  ', topic: ' ' })).toEqual({
			courseId: 'csis-4495'
		});
	});

	it.each([null, 'string', 42])('rejects a non-object body', (body) => {
		expect(() => validateGenerateRequest(body)).toThrow(ValidationError);
	});

	it.each([{}, { courseId: '' }, { courseId: 123 }])('rejects an invalid course id', (body) => {
		expect(() => validateGenerateRequest(body)).toThrow(ValidationError);
	});

	it('rejects a non-string or oversized topic', () => {
		expect(() => validateGenerateRequest({ courseId: 'c1', topic: 4 })).toThrow(ValidationError);
		expect(() => validateGenerateRequest({ courseId: 'c1', topic: 'x'.repeat(201) })).toThrow(
			ValidationError
		);
	});

	it('accepts unique selected course material ids', () => {
		expect(
			validateGenerateRequest({ courseId: 'c1', materialIds: [' material-1 ', 'material-2'] })
		).toEqual({ courseId: 'c1', materialIds: ['material-1', 'material-2'] });
	});

	it.each([
		[[]],
		[Array.from({ length: 9 }, (_, index) => `material-${index}`)],
		[['material-1', 'material-1']],
		[['material-1', ' ']],
		[['material-1', 2]]
	])('rejects invalid material selections', (materialIds) => {
		expect(() => validateGenerateRequest({ courseId: 'c1', materialIds })).toThrow(ValidationError);
	});
});

describe('validatePracticeResponse', () => {
	const validSources = new Map([
		['chunk-1', { materialId: 'mat-1', fileName: 'notes.pdf', pageStart: 12, pageEnd: 12 }],
		['chunk-2', { materialId: 'mat-2', fileName: 'slides.pdf', pageStart: 4, pageEnd: 5 }]
	]);

	function validQuestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			id: 'q1',
			courseCode: 'CSIS 4495',
			topic: 'Normalization',
			question: 'What is 3NF?',
			options: ['A', 'B', 'C', 'D'],
			correctIndex: 0,
			explanation: '3NF removes transitive dependencies.',
			source: { chunkId: 'chunk-1' },
			...overrides
		};
	}

	function validFlashcard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			id: 'f1',
			courseCode: 'CSIS 4495',
			topic: 'Normalization',
			front: 'What is 3NF?',
			back: 'Third Normal Form removes transitive dependencies.',
			source: { chunkId: 'chunk-1' },
			...overrides
		};
	}

	function validPayload() {
		return {
			questions: Array.from({ length: 5 }, (_, index) => validQuestion({ id: `q${index}` })),
			flashcards: Array.from({ length: 8 }, (_, index) => validFlashcard({ id: `f${index}` }))
		};
	}

	it('accepts 5 questions and 8 flashcards and attaches trusted citation data', () => {
		const result = validatePracticeResponse(validPayload(), validSources, 'CSIS 4495');
		expect(result.questions).toHaveLength(5);
		expect(result.flashcards).toHaveLength(8);
		expect(result.questions[0].source).toEqual({
			materialId: 'mat-1',
			fileName: 'notes.pdf',
			pageStart: 12,
			pageEnd: 12
		});
	});

	it('rejects incorrect item counts', () => {
		const payload = validPayload();
		expect(() =>
			validatePracticeResponse(
				{ ...payload, questions: payload.questions.slice(1) },
				validSources,
				'CSIS 4495'
			)
		).toThrow(ValidationError);
		expect(() =>
			validatePracticeResponse(
				{ ...payload, flashcards: payload.flashcards.slice(1) },
				validSources,
				'CSIS 4495'
			)
		).toThrow(ValidationError);
	});

	it('rejects invalid question fields', () => {
		const payload = validPayload();
		expect(() =>
			validatePracticeResponse(
				{
					...payload,
					questions: [validQuestion({ correctIndex: 5 }), ...payload.questions.slice(1)]
				},
				validSources,
				'CSIS 4495'
			)
		).toThrow(ValidationError);
		expect(() =>
			validatePracticeResponse(
				{
					...payload,
					questions: [
						validQuestion({ options: ['A', '', 'C', 'D'] }),
						...payload.questions.slice(1)
					]
				},
				validSources,
				'CSIS 4495'
			)
		).toThrow(ValidationError);
	});

	it('rejects a chunk id outside the selected context', () => {
		const payload = validPayload();
		expect(() =>
			validatePracticeResponse(
				{
					...payload,
					questions: [
						validQuestion({ source: { chunkId: 'unknown' } }),
						...payload.questions.slice(1)
					]
				},
				validSources,
				'CSIS 4495'
			)
		).toThrow('not found in selected context');
	});

	it('rejects content generated for a different course', () => {
		const payload = validPayload();
		expect(() =>
			validatePracticeResponse(
				{
					...payload,
					questions: [validQuestion({ courseCode: 'MATH 1120' }), ...payload.questions.slice(1)]
				},
				validSources,
				'CSIS 4495'
			)
		).toThrow(ValidationError);
	});

	it.each(['not-an-object', null, { flashcards: [] }, { questions: [] }])(
		'rejects an incomplete response',
		(response) => {
			expect(() => validatePracticeResponse(response, validSources, 'CSIS 4495')).toThrow(
				ValidationError
			);
		}
	);
});
