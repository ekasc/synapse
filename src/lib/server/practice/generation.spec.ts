import { describe, expect, it } from 'vitest';
import { generatePracticeMaterials } from './generation';

const source = { materialId: 'material-1', fileName: 'book.pdf' };

function generatedPayload(courseCode: string) {
	return {
		questions: Array.from({ length: 5 }, (_, index) => ({
			id: `q${index + 1}`,
			courseCode,
			topic: 'Topic',
			question: `Question ${index + 1}?`,
			options: ['A', 'B', 'C', 'D'],
			correctIndex: 0,
			explanation: 'Because A is correct.',
			source: { chunkId: 'chunk-1' }
		})),
		flashcards: Array.from({ length: 8 }, (_, index) => ({
			id: `f${index + 1}`,
			courseCode,
			topic: 'Topic',
			front: `Front ${index + 1}`,
			back: `Back ${index + 1}`,
			source: { chunkId: 'chunk-1' }
		}))
	};
}

type CapturedRequest = {
	messages: { content: string }[];
	response_format: {
		json_schema: {
			schema: {
				properties: {
					questions: { items: { properties: { courseCode: { enum: string[] } } } };
					flashcards: { items: { properties: { courseCode: { enum: string[] } } } };
				};
			};
		};
	};
};

describe('generatePracticeMaterials', () => {
	it('pins the exact saved course code in both the prompt and structured-output schema', async () => {
		const courseCode = 'CYBER 101';
		const requestBodies: CapturedRequest[] = [];
		const fetchImpl: typeof fetch = async (_input, init) => {
			requestBodies.push(JSON.parse(String(init?.body)) as CapturedRequest);
			return new Response(
				JSON.stringify({
					choices: [{ message: { content: JSON.stringify(generatedPayload(courseCode)) } }]
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		};

		const result = await generatePracticeMaterials(
			[
				{
					id: 'chunk-1',
					text: 'Course material',
					source: { ...source, pageStart: 7, pageEnd: 7 }
				}
			],
			{ apiKey: 'test-key', courseCode, focusTopic: 'Linux event logging', fetchImpl }
		);

		expect(result.questions).toHaveLength(5);
		expect(result.questions[0].source).toEqual({
			...source,
			pageStart: 7,
			pageEnd: 7
		});
		const requestBody = requestBodies[0];
		expect(requestBody.messages[0].content).toContain(`courseCode exactly "${courseCode}"`);
		expect(requestBody.messages[0].content).toContain(
			'Focus every question and flashcard on this requested topic: "Linux event logging"'
		);
		expect(
			requestBody.response_format.json_schema.schema.properties.questions.items.properties
				.courseCode.enum
		).toEqual([courseCode]);
		expect(
			requestBody.response_format.json_schema.schema.properties.flashcards.items.properties
				.courseCode.enum
		).toEqual([courseCode]);
	});
});
