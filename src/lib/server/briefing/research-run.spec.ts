import { describe, expect, it, vi } from 'vitest';
import { runResearchRun, type CandidateBriefing, type ResearchAction } from './research-run';
import type { EvidenceSource } from './schema';

const source = (id: string): EvidenceSource => ({
	id,
	category: 'catalog',
	title: 'CSIS 4495 Applied Research Project',
	url: `https://www.douglascollege.ca/course/${id}`,
	canonicalUrl: `https://www.douglascollege.ca/course/${id}`,
	domain: 'www.douglascollege.ca',
	publisher: 'Douglas College',
	excerpt: 'CSIS 4495 Applied Research Project',
	sourceType: 'official',
	publishedAt: null,
	updatedAt: null,
	retrievedAt: '2026-01-01T00:00:00.000Z',
	currentness: 'current',
	retrievalStatus: 'retrieved',
	contentFingerprint: id,
	claimsSupported: []
});
const candidate = (id: string) =>
	({
		sources: [source(id)],
		claims: [],
		description: { sourceIds: [] },
		credits: { sourceIds: [] },
		prerequisites: { sourceIds: [] },
		corequisites: { sourceIds: [] },
		delivery: { sourceIds: [] },
		assessments: { sourceIds: [] },
		workload: { sourceIds: [] },
		rateMyProfessors: { sourceIds: [] },
		contradictions: { sourceIds: [] },
		missing: { sourceIds: [] },
		summary: { sourceIds: [] }
	}) as unknown as CandidateBriefing;
const req = (jobId: string, signal?: AbortSignal) => ({
	jobId,
	userId: 'user',
	briefingRequest: { courseCode: jobId },
	signal
});
const sequence = (...actions: ResearchAction[]) => ({
	next: vi.fn(async () => ({ action: actions.shift() }))
});

describe('ResearchRun', () => {
	it('keeps concurrent run state, counters, evidence, and candidates isolated', async () => {
		const search = vi.fn(async ({ query }: { query: string }) => [source(query)]);
		const [a, b] = await Promise.all([
			runResearchRun(req('A'), {
				model: sequence(
					{ type: 'search', query: 'a' },
					{ type: 'submit_candidate', candidate: candidate('a') }
				),
				search,
				newRunId: () => 'a'
			}),
			runResearchRun(req('B'), {
				model: sequence(
					{ type: 'search', query: 'b' },
					{ type: 'submit_candidate', candidate: candidate('b') }
				),
				search,
				newRunId: () => 'b'
			})
		]);
		expect(a).toMatchObject({
			status: 'completed',
			metadata: { runId: 'a', searchCalls: 1, providerCalls: 2 }
		});
		expect(b).toMatchObject({
			status: 'completed',
			metadata: { runId: 'b', searchCalls: 1, providerCalls: 2 }
		});
		expect((a as { candidate: CandidateBriefing }).candidate.sources[0].id).toBe('a');
		expect((b as { candidate: CandidateBriefing }).candidate.sources[0].id).toBe('b');
	});
	it('cancellation aborts one in-flight provider without affecting another', async () => {
		const controller = new AbortController();
		const blocked = {
			next: vi.fn(
				({ signal }: { signal: AbortSignal }) =>
					new Promise((_, reject) =>
						signal.addEventListener('abort', () => reject(new Error('aborted')))
					)
			)
		};
		const one = runResearchRun(req('one', controller.signal), { model: blocked, search: vi.fn() });
		const two = runResearchRun(req('two'), {
			model: sequence({ type: 'submit_candidate', candidate: candidate('two') }),
			search: vi.fn()
		});
		await vi.waitFor(() => expect(blocked.next).toHaveBeenCalledOnce());
		controller.abort();
		expect(await one).toMatchObject({ status: 'cancelled' });
		expect(await two).toMatchObject({ status: 'completed' });
		expect(blocked.next.mock.calls[0][0].signal.aborted).toBe(true);
	});
	it('passes the run signal to in-flight search and fetch tools', async () => {
		const controller = new AbortController();
		const search = vi.fn(
			({ signal }: { signal: AbortSignal }) =>
				new Promise((_, reject) =>
					signal.addEventListener('abort', () => reject(new Error('abort')))
				)
		);
		const running = runResearchRun(req('search', controller.signal), {
			model: sequence({ type: 'search', query: 'x' }),
			search
		});
		await vi.waitFor(() => expect(search).toHaveBeenCalledOnce());
		controller.abort();
		expect(await running).toMatchObject({ status: 'cancelled' });
		expect(search.mock.calls[0][0].signal.aborted).toBe(true);
		const fetchController = new AbortController();
		const fetchPage = vi.fn(
			(_url: string, signal: AbortSignal) =>
				new Promise((_, reject) =>
					signal.addEventListener('abort', () => reject(new Error('abort')))
				)
		);
		const fetching = runResearchRun(req('fetch', fetchController.signal), {
			model: sequence({ type: 'fetch_page', url: 'https://example.test' }),
			search: vi.fn(),
			fetchPage
		});
		await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledOnce());
		fetchController.abort();
		expect(await fetching).toMatchObject({ status: 'cancelled' });
		expect(fetchPage.mock.calls[0][1].aborted).toBe(true);
	});
	it('enforces tool, provider, and deadline limits', async () => {
		expect(
			await runResearchRun(
				{ ...req('tool'), limits: { maxProviderCalls: 1 } },
				{
					model: sequence({ type: 'search', query: 'x' }),
					search: vi.fn(async () => []),
					newRunId: () => 'x'
				}
			)
		).toMatchObject({ status: 'exhausted', reason: 'provider_limit' });
		const model = sequence({ type: 'search', query: 'x' }, { type: 'search', query: 'y' });
		expect(
			await runResearchRun(
				{ ...req('tool'), limits: { maxToolCalls: 1 } },
				{ model, search: vi.fn(async () => []) }
			)
		).toMatchObject({ status: 'exhausted', reason: 'tool_limit' });
		expect(
			await runResearchRun(
				{ ...req('provider'), limits: { maxProviderCalls: 0 } },
				{ model: sequence(), search: vi.fn() }
			)
		).toMatchObject({ status: 'exhausted', reason: 'provider_limit' });
		expect(
			await runResearchRun(
				{ ...req('deadline'), limits: { maxDurationMs: 0 } },
				{ model: sequence(), search: vi.fn() }
			)
		).toMatchObject({ status: 'exhausted', reason: 'deadline' });
	});
	it('runs search, fetch, and submit with a retrieved source and no persistence capability', async () => {
		const fetched = source('fetch_1');
		const result = await runResearchRun(req('sequence'), {
			model: sequence(
				{ type: 'search', query: 'CSIS 4495' },
				{ type: 'fetch_page', url: fetched.url },
				{ type: 'submit_candidate', candidate: candidate('fetch_1') }
			),
			search: vi.fn(async () => [source('search_1')]),
			fetchPage: vi.fn(async () => ({
				url: fetched.url,
				finalUrl: fetched.url,
				retrievalStatus: 'retrieved',
				contentType: 'text/html',
				excerpt: fetched.excerpt
			}))
		});
		expect(result).toMatchObject({
			status: 'completed',
			metadata: { searchCalls: 1, fetchCalls: 1, toolCalls: 2 }
		});
		expect((result as { candidate: CandidateBriefing }).candidate.sources.map((item) => item.id)).toEqual([
			'search_1',
			'fetch_1'
		]);
	});

	it('rejects malformed actions and returns submitted candidates without persistence capabilities', async () => {
		expect(
			await runResearchRun(req('bad'), {
				model: { next: async () => ({ action: { type: 'write_d1' } }) },
				search: vi.fn()
			})
		).toMatchObject({ status: 'failed', errorCode: 'MALFORMED_ACTION' });
		const result = await runResearchRun(req('done'), {
			model: sequence({ type: 'submit_candidate', candidate: candidate('done') }),
			search: vi.fn()
		});
		expect(result).toMatchObject({ status: 'completed', metadata: { toolCalls: 0 } });
	});
	it('replaces model-supplied source fields with the isolated run evidence', async () => {
		const untrusted = candidate('trusted');
		untrusted.sources = [{ ...source('trusted'), url: 'https://attacker.invalid/forged' }];
		const result = await runResearchRun(req('trusted'), {
			model: sequence(
				{ type: 'search', query: 'trusted' },
				{ type: 'submit_candidate', candidate: untrusted }
			),
			search: vi.fn(async () => [source('trusted')])
		});
		expect((result as { candidate: CandidateBriefing }).candidate.sources[0].url).toBe(
			'https://www.douglascollege.ca/course/trusted'
		);
	});
});
