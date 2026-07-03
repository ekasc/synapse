import { describe, expect, it } from 'vitest';
import {
	buildOpenRouterRequestFallback,
	buildOpenRouterRequestStrict,
	parseResponse,
	researchBriefing
} from './request';
import { BRIEFING_JSON_SCHEMA } from './schema';
import { ValidationError } from './validation';

const messages = [
	{ role: 'system' as const, content: 'system' },
	{ role: 'user' as const, content: 'user' }
];

const validBriefingJson = JSON.stringify({
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
		}
	]
});

function makeFetch(responses: Array<{ status: number; body: unknown }>): typeof fetch {
	let call = 0;
	return (async (_input: RequestInfo | URL, _init?: RequestInit) => {
		const r = responses[call++] ?? responses[responses.length - 1];
		return new Response(JSON.stringify(r.body), {
			status: r.status,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof fetch;
}

describe('briefing request', () => {
	it('builds a strict json_schema request with web and response-healing plugins', () => {
		const request = buildOpenRouterRequestStrict('deepseek/deepseek-v4-flash', messages);
		expect(request.model).toBe('deepseek/deepseek-v4-flash');
		expect(request.messages).toBe(messages);
		expect(request.response_format).toEqual({
			type: 'json_schema',
			json_schema: {
				name: 'course_briefing',
				strict: true,
				schema: BRIEFING_JSON_SCHEMA
			}
		});
		expect(request.plugins).toEqual(
			expect.arrayContaining([{ id: 'web' }, { id: 'response-healing' }])
		);
		expect(request.temperature).toBe(0);
		expect(request.seed).toBe(0);
		expect(request.provider).toEqual({ require_parameters: true });
	});

	it('builds a fallback json_object request when strict is unsupported', () => {
		const request = buildOpenRouterRequestFallback('deepseek/deepseek-v4-flash', messages);
		expect(request.response_format).toEqual({ type: 'json_object' });
		expect(request.plugins).toEqual(
			expect.arrayContaining([{ id: 'web' }, { id: 'response-healing' }])
		);
		expect(request.provider).toBeUndefined();
	});

	it('parses a valid response and stamps the model + schema version', () => {
		const briefing = parseResponse(
			{ choices: [{ message: { content: validBriefingJson } }] },
			'test-model'
		);
		expect(briefing.code).toBe('CSIS 3375');
		expect(briefing.modelUsed).toBe('test-model');
		expect(briefing.schemaVersion).toBeDefined();
	});

	it('throws when the response has no content', () => {
		expect(() => parseResponse({ choices: [{ message: { content: null } }] }, 'm')).toThrow(
			ValidationError
		);
	});

	it('researchBriefing returns a briefing on the first attempt', async () => {
		const fetchImpl = makeFetch([
			{ status: 200, body: { choices: [{ message: { content: validBriefingJson } }] } }
		]);
		const result = await researchBriefing({
			apiKey: 'k',
			model: 'm',
			messages,
			fetchImpl
		});
		expect(result.attempts).toBe(1);
		expect(result.usedStrict).toBe(true);
		expect(result.briefing.code).toBe('CSIS 3375');
	});

	it('researchBriefing falls back to json_object when strict is unsupported', async () => {
		const fetchImpl = makeFetch([
			{
				status: 400,
				body: { error: { message: 'json_schema strict is not supported by this model' } }
			},
			{ status: 200, body: { choices: [{ message: { content: validBriefingJson } }] } }
		]);
		const result = await researchBriefing({
			apiKey: 'k',
			model: 'm',
			messages,
			fetchImpl,
			maxRetries: 3
		});
		expect(result.attempts).toBe(2);
		expect(result.usedStrict).toBe(false);
		expect(result.briefing.code).toBe('CSIS 3375');
	});

	it('researchBriefing retries on 5xx', async () => {
		const fetchImpl = makeFetch([
			{ status: 500, body: { error: { message: 'upstream' } } },
			{ status: 200, body: { choices: [{ message: { content: validBriefingJson } }] } }
		]);
		const result = await researchBriefing({
			apiKey: 'k',
			model: 'm',
			messages,
			fetchImpl
		});
		expect(result.attempts).toBe(2);
	});

	it('researchBriefing throws when retries are exhausted', async () => {
		const fetchImpl = makeFetch([
			{
				status: 400,
				body: { error: { message: 'json_schema strict is not supported' } }
			},
			{ status: 400, body: { error: { message: 'json_schema strict is not supported' } } },
			{ status: 400, body: { error: { message: 'json_schema strict is not supported' } } }
		]);
		await expect(
			researchBriefing({ apiKey: 'k', model: 'm', messages, fetchImpl, maxRetries: 2 })
		).rejects.toThrow();
	});
});
