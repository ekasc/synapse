import { describe, expect, it, vi } from 'vitest';
import { createOpenRouterSearchAdapter, SearchProviderError } from './search-provider';
import { MODEL_POLICY } from './policy';
const input = (signal = new AbortController().signal) => ({
	request: { courseCode: 'CSIS 4495', institution: 'Douglas College' },
	category: 'catalog' as const,
	query: 'CSIS 4495',
	policy: MODEL_POLICY,
	signal
});
const data = (sources: unknown) => ({
	choices: [
		{
			message: {
				content: JSON.stringify({ sources }),
				annotations: [{ url_citation: { url: 'https://www.douglascollege.ca/course/csis-4495' } }]
			}
		}
	],
	usage: { prompt_tokens: 2, completion_tokens: 1, server_tool_use: { web_search_requests: 1 } }
});
describe('OpenRouter search adapter', () => {
	it('returns normalized results and preserves the pinned provider body', async () => {
		const transport = vi.fn(async () => ({
			status: 200,
			data: data([
				{
					title: 'CSIS 4495 Applied Research Project',
					url: 'https://www.douglascollege.ca/course/csis-4495',
					excerpt: 'CSIS 4495 Applied Research Project'
				}
			])
		}));
		const result = await createOpenRouterSearchAdapter(transport)(input());
		expect(result).toMatchObject({
			status: 'results',
			usage: { inputTokens: 2, searchRequests: 1 }
		});
		expect(result.sources).toHaveLength(1);
		expect(transport.mock.calls[0][0]).toMatchObject({
			model: MODEL_POLICY.search,
			provider: { allow_fallbacks: true, require_parameters: true }
		});
	});
	it('keeps cited official-page text when the model supplies a short excerpt', async () => {
		const result = await createOpenRouterSearchAdapter(async () => ({
			status: 200,
			data: {
				choices: [
					{
						message: {
							content: JSON.stringify({
								sources: [
									{
										title: 'CSIS 4495 Applied Research Project',
										url: 'https://www.douglascollege.ca/course/csis-4495',
										excerpt: 'Short description'
									}
								]
							}),
							annotations: [
								{
									url_citation: {
										url: 'https://www.douglascollege.ca/course/csis-4495',
										content: 'Credits 3.00 Prerequisites None'
									}
								}
							]
						}
					}
				]
			}
		}))(input());
		expect(result.sources[0]?.excerpt).toBe('Credits 3.00 Prerequisites None');
	});

	it('distinguishes empty, rate-limited, provider, and malformed responses', async () => {
		await expect(
			createOpenRouterSearchAdapter(async () => ({ status: 200, data: data([]) }))(input())
		).resolves.toMatchObject({ status: 'results' });
		await expect(
			createOpenRouterSearchAdapter(async () => ({ status: 429, data: {} }))(input())
		).rejects.toMatchObject({ code: 'RATE_LIMITED' });
		await expect(
			createOpenRouterSearchAdapter(async () => ({ status: 500, data: {} }))(input())
		).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
		await expect(
			createOpenRouterSearchAdapter(async () => ({
				status: 200,
				data: { choices: [{ message: { content: 'bad' } }] }
			}))(input())
		).rejects.toBeInstanceOf(SearchProviderError);
	});
	it('passes cancellation to transport without creating sources', async () => {
		const controller = new AbortController();
		const transport = vi.fn(
			(_body, signal: AbortSignal) =>
				new Promise((_, reject) =>
					signal.addEventListener('abort', () => reject(new Error('aborted')))
				)
		);
		const pending = createOpenRouterSearchAdapter(transport)(input(controller.signal));
		controller.abort();
		await expect(pending).rejects.toThrow('aborted');
		expect(transport.mock.calls[0][1].aborted).toBe(true);
	});
});
