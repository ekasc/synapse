import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterResearchModelClient, parseJsonAction, parseToolAction } from './research-model-client';
import { MODEL_POLICY } from './policy';

const state = {
	request: { courseCode: 'CSIS 4495' },
	evidence: [],
	actions: [],
	remaining: {
		maxDurationMs: 1,
		maxToolCalls: 1,
		maxProviderCalls: 1,
		maxSearchCalls: 1,
		maxFetchCalls: 1,
		maxCostUsd: 1
	},
	signal: new AbortController().signal
};
describe('OpenRouter ResearchModelClient', () => {
	it('constructs an explicit model request and parses exactly one action', async () => {
		const fetchImpl = vi.fn(
			async (_url, init) =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: JSON.stringify({ action: { type: 'search', query: 'CSIS 4495' } })
								}
							}
						],
						usage: { prompt_tokens: 3, completion_tokens: 2, cost: '0.01' }
					}),
					{ status: 200 }
				)
		) as unknown as typeof fetch;
		const client = createOpenRouterResearchModelClient({
			apiKey: 'secret',
			policy: MODEL_POLICY,
			fetchImpl
		});
		await expect(client.next(state)).resolves.toMatchObject({
			action: { type: 'search', query: 'CSIS 4495' },
			usage: { inputTokens: 3, outputTokens: 2, costUsd: 0.01 }
		});
		const init = fetchImpl.mock.calls[0][1] as RequestInit;
		expect(init.signal).toBe(state.signal);
		expect(JSON.parse(String(init.body))).toMatchObject({
			model: MODEL_POLICY.search,
			provider: { allow_fallbacks: true, require_parameters: true }
		});
		expect(JSON.parse(String(init.body))).not.toHaveProperty('response_format');
		expect(JSON.parse(String(init.body))).toMatchObject({ tool_choice: { function: { name: 'research_action' } } });
	});
	it('falls back to a bounded official-catalog search for a malformed planner action', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						choices: [
							{ message: { content: JSON.stringify({ action: { type: 'search', query: 3 } }) } }
						]
					}),
					{ status: 200 }
				)
		) as unknown as typeof fetch;
		await expect(
			createOpenRouterResearchModelClient({ apiKey: 'x', policy: MODEL_POLICY, fetchImpl }).next(
				state
			)
		).resolves.toMatchObject({ action: { type: 'search', category: 'catalog' } });
	});
	it('accepts a direct action object from a JSON-mode provider', async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					JSON.stringify({ choices: [{ message: { content: '{"type":"search","query":"CSIS 4495"}' } }] }),
					{ status: 200 }
				)
		) as unknown as typeof fetch;
		await expect(
			createOpenRouterResearchModelClient({ apiKey: 'x', policy: MODEL_POLICY, fetchImpl }).next(state)
		).resolves.toMatchObject({ action: { type: 'search', query: 'CSIS 4495' } });
	});
	it('recovers a JSON action from an ignored markdown fence', () => {
		expect(parseJsonAction('```json\n{"action":{"type":"search","query":"CSIS 4495"}}\n```')).toEqual({
			type: 'search',
			query: 'CSIS 4495'
		});
	});
	it('accepts multipart text content', () => {
		expect(parseJsonAction([{ type: 'text', text: '{"type":"search","query":"CSIS 4495"}' }])).toEqual({
			type: 'search',
			query: 'CSIS 4495'
		});
	});
	it('parses an OpenAI-compatible tool call', () => {
		expect(
			parseToolAction([{ function: { name: 'research_action', arguments: '{"action":{"type":"search","query":"CSIS 4495"}}' } }])
		).toEqual({ type: 'search', query: 'CSIS 4495' });
	});
	it('parses a provider tool call with object arguments', () => {
		expect(
			parseToolAction([
				{ function: { name: 'research_action', arguments: { type: 'search', query: 'CSIS 4495' } } }
			])
		).toEqual({ type: 'search', query: 'CSIS 4495' });
	});
});
