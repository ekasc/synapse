import { describe, expect, it, vi } from 'vitest';
import { buildDeterministicBriefing, runEvidenceFirstPipeline } from './pipeline';
import { isCleanCourseField } from './field-quality';
import { validateStructuredBriefing } from './validation';
import type { BriefingRequest, BriefingUsage, EvidenceBundle, EvidenceSource } from './schema';

const request: BriefingRequest = { courseCode: 'CSIS 4280', institution: 'Douglas College' };
const usage: BriefingUsage = {
	inputTokens: 0,
	outputTokens: 0,
	reasoningTokens: 0,
	cachedTokens: 0,
	searchRequests: 1,
	costMicrodollars: 0
};

function source(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
	return {
		id: 'src_01',
		category: 'catalog',
		title: 'CSIS 4280 Special Topics in Emerging Technology',
		url: 'https://www.douglascollege.ca/course/csis-4280',
		canonicalUrl: 'https://www.douglascollege.ca/course/csis-4280',
		domain: 'www.douglascollege.ca',
		publisher: 'Douglas College',
		excerpt:
			'CSIS 4280 Special Topics in Emerging Technology. This course explores emerging technologies.',
		sourceType: 'official',
		publishedAt: null,
		updatedAt: null,
		retrievedAt: '2026-07-15T00:00:00.000Z',
		currentness: 'current',
		retrievalStatus: 'retrieved',
		contentFingerprint: 'fp',
		claimsSupported: [],
		...overrides
	};
}

const identity = {
	institution: 'Douglas College',
	courseCode: 'CSIS 4280',
	canonicalTitle: 'CSIS 4280 Special Topics in Emerging Technology',
	canonicalUrl: 'https://www.douglascollege.ca/course/csis-4280',
	sourceId: 'src_01',
	status: 'verified' as const,
	candidates: []
};

function bundle(sources: EvidenceSource[]): EvidenceBundle {
	return {
		version: 2,
		request,
		categories: ['catalog', 'outline'],
		sources,
		missingCategories: [],
		usage
	};
}

function candidate(sources: EvidenceSource[]) {
	const catalog = sources[0];
	const outline = sources[1] ?? catalog;
	const section = (text = '', sourceIds: string[] = [], claimIds: string[] = []) => ({
		text,
		sourceIds,
		claimIds
	});
	return {
		identity: {
			code: identity.courseCode,
			name: identity.canonicalTitle,
			institution: identity.institution,
			officialDomain: 'douglascollege.ca',
			catalogSourceId: catalog.id,
			candidates: [],
			confidence: 'high',
			verifiedAt: '2026-07-15T00:00:00.000Z'
		},
		instructor: { requestedName: null, name: null, status: 'not_requested', sourceIds: [] },
		description: section('This course explores emerging technologies.', [catalog.id], ['c1']),
		credits: section('3 credits', [catalog.id], ['c2']),
		prerequisites: section('Minimum grade C in CSIS 3175.', [catalog.id], ['c3']),
		corequisites: section(),
		delivery: section('Three-hour weekly lecture with a lab.', [outline.id], ['c4']),
		assessments: section('Assignments 30%; project 40%; final exam 30%.', [outline.id], ['c5']),
		workload: section(),
		rateMyProfessors: section(),
		contradictions: section(),
		missing: section(),
		summary: section(),
		claims: [
			['c1', 'This course explores emerging technologies.', catalog.id],
			['c2', '3 credits', catalog.id],
			['c3', 'Minimum grade C in CSIS 3175.', catalog.id],
			['c4', 'Three-hour weekly lecture with a lab.', outline.id],
			['c5', 'Assignments 30%; project 40%; final exam 30%.', outline.id]
		].map(([id, text, sourceId]) => ({
			id,
			text,
			status: 'verified_current',
			sourceIds: [sourceId],
			asOf: null,
			explanation: null
		}))
	};
}

function validate(value: Record<string, unknown>, sources: EvidenceSource[]) {
	return validateStructuredBriefing(
		value,
		sources,
		request,
		{
			researchedAt: '2026-07-15T00:00:00.000Z',
			modelUsed: 'pro',
			searchModel: 'flash',
			synthesisModel: 'pro',
			usage
		},
		identity
	);
}

describe('Course Brief extraction boundary', () => {
	it('accepts a clean, source-separated official synthesis', () => {
		const sources = [source(), source({ id: 'outline', category: 'outline' })];
		const briefing = validate(candidate(sources), sources);
		expect(briefing.description.text).toBe('This course explores emerging technologies.');
		expect(briefing.prerequisites.text).toBe('Minimum grade C in CSIS 3175.');
		expect(briefing.delivery.text).toBe('Three-hour weekly lecture with a lab.');
		expect(briefing.assessments.text).toBe('Assignments 30%; project 40%; final exam 30%.');
	});

	it('rejects noisy mixed evidence for each outline field and duplicate paragraphs', () => {
		expect(
			isCleanCourseField(
				'description',
				'Instructor last name: Xing. Textbook: Web Development.',
				request.courseCode
			)
		).toBe(false);
		expect(
			isCleanCourseField('prerequisites', 'Course status Open. CSIS 1280.', request.courseCode)
		).toBe(false);
		expect(
			isCleanCourseField(
				'delivery',
				'Textbook: Mobile Applications. Final exam 30%.',
				request.courseCode
			)
		).toBe(false);
		expect(
			isCleanCourseField(
				'assessments',
				'Course outline navigation. This course explores emerging technologies.',
				request.courseCode
			)
		).toBe(false);
		const sources = [source(), source({ id: 'outline', category: 'outline' })];
		const polluted = candidate(sources);
		polluted.prerequisites = { ...polluted.prerequisites, text: polluted.description.text };
		expect(() => validate(polluted, sources)).toThrow('course outline fields must not duplicate');
	});

	it('does not admit unrelated course pages or RMP evidence as official course fields', () => {
		const unrelated = source({
			id: 'other',
			category: 'outline',
			title: 'CSIS 1280 Web Development',
			excerpt: 'CSIS 1280 Web Development.'
		});
		const rmp = source({
			id: 'rmp',
			category: 'rate-my-professors',
			sourceType: 'rmp',
			domain: 'ratemyprofessors.com'
		});
		const sources = [source(), unrelated, rmp];
		const fromUnrelated = candidate(sources);
		fromUnrelated.description = { ...fromUnrelated.description, sourceIds: ['other'] };
		expect(() => validate(fromUnrelated, sources)).toThrow(
			'description source does not match the requested course'
		);
		const fromRmp = candidate(sources);
		fromRmp.description = { ...fromRmp.description, sourceIds: ['rmp'] };
		expect(() => validate(fromRmp, sources)).toThrow('description requires official evidence');
	});

	it('hydrates one official outline and preserves all supported synthesized fields', async () => {
		const page = `
			<html><body><h1>${identity.canonicalTitle}</h1>
			<p>This course explores emerging technologies.</p><p>Credits 3.</p>
			<p>Prerequisites: Minimum grade C in CSIS 3175.</p>
			<p>Three-hour weekly lecture with a lab.</p>
			<p>Assignments 30%; project 40%; final exam 30%.</p></body></html>`;
		const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
			if (!init?.body) return new Response(page, { headers: { 'content-type': 'text/html' } });
			const body = JSON.parse(String(init.body));
			const isSynthesis = Boolean(body.response_format);
			const sources = [source(), source({ id: 'src_outline_01', category: 'outline' })];
			const content = isSynthesis
				? candidate(sources)
				: {
						sources: [
							{
								title: identity.canonicalTitle,
								url: identity.canonicalUrl,
								excerpt: 'Short search snippet.'
							}
						]
					};
			return new Response(
				JSON.stringify({
					id: crypto.randomUUID(),
					model: isSynthesis ? 'deepseek/deepseek-v4-pro' : 'deepseek/deepseek-v4-flash',
					choices: [
						{
							message: {
								content: JSON.stringify(content),
								annotations: [
									{ type: 'url_citation', url_citation: { url: identity.canonicalUrl } }
								]
							}
						}
					],
					usage: {
						prompt_tokens: 1,
						completion_tokens: 1,
						cost: '0',
						server_tool_use: { web_search_requests: 1 }
					}
				}),
				{ headers: { 'content-type': 'application/json' } }
			);
		}) as unknown as typeof fetch;
		const getCachedEvidence = vi.fn(async () => [
			source({ excerpt: 'Stale empty briefing evidence.' })
		]);
		const result = await runEvidenceFirstPipeline(request, {
			apiKey: 'x',
			fetchImpl,
			costCeilingMicrodollars: 200_000,
			forceRefresh: true,
			categoryCache: { get: getCachedEvidence, set: async () => {} }
		});
		expect(getCachedEvidence).toHaveBeenCalledTimes(4);
		expect(result.evidence.sources.some((entry) => entry.excerpt.includes('Assignments 30%'))).toBe(
			true
		);
		expect(result.briefing.description.text).toBe('This course explores emerging technologies.');
		expect(result.briefing.credits.text).toBe('3 credits');
		expect(result.briefing.prerequisites.text).toBe('Minimum grade C in CSIS 3175.');
		expect(result.briefing.delivery.text).toBe('Three-hour weekly lecture with a lab.');
		expect(result.briefing.assessments.text).toBe('Assignments 30%; project 40%; final exam 30%.');
		const synthesisBodies = fetchImpl.mock.calls
			.map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : null))
			.filter((body) => body?.response_format);
		expect(synthesisBodies).toHaveLength(1);
		for (const body of synthesisBodies) {
			expect(body.response_format.json_schema.schema.required).not.toContain('sources');
			expect(body.response_format.json_schema.schema.properties).not.toHaveProperty('sources');
		}
	});

	it('rejects a polluted synthesized field while retaining the valid fixture shape', () => {
		const sources = [source(), source({ id: 'outline', category: 'outline' })];
		const polluted = candidate(sources);
		polluted.delivery = {
			text: 'Instructor last name Xing. Textbook: Mobile Applications.',
			sourceIds: ['outline'],
			claimIds: ['c4']
		};
		expect(() => validate(polluted, sources)).toThrow('delivery contains mixed evidence');
	});

	it('refetches a cached canonical official URL after empty primary search', async () => {
		const page = `<html><body><h1>${identity.canonicalTitle}</h1><p>CSIS 4280 Special Topics in Emerging Technology. Credits 3. This official course page describes emerging technology topics and current course information for enrolled students.</p></body></html>`;
		const cached = source({
			excerpt: 'Stale search snippet.',
			canonicalUrl: identity.canonicalUrl
		});
		const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
			if (!init?.body) return new Response(page, { headers: { 'content-type': 'text/html' } });
			const body = JSON.parse(String(init.body));
			const content = body.response_format ? {} : { sources: [] };
			return new Response(
				JSON.stringify({
					id: crypto.randomUUID(),
					model: body.response_format ? 'deepseek/deepseek-v4-pro' : 'deepseek/deepseek-v4-flash',
					choices: [{ message: { content: JSON.stringify(content) } }],
					usage: {
						prompt_tokens: 1,
						completion_tokens: 1,
						cost: '0',
						server_tool_use: { web_search_requests: 1 }
					}
				}),
				{ headers: { 'content-type': 'application/json' } }
			);
		}) as unknown as typeof fetch;
		const result = await runEvidenceFirstPipeline(request, {
			apiKey: 'x',
			fetchImpl,
			costCeilingMicrodollars: 200_000,
			forceRefresh: true,
			categoryCache: {
				get: async (category) => (category === 'catalog' ? [cached] : null),
				set: async () => {}
			}
		});
		const catalog = result.evidence.sources.find((entry) => entry.category === 'catalog');
		expect(catalog?.excerpt).toContain('Credits 3');
		expect(catalog?.excerpt).not.toContain('Stale search snippet');
		expect(result.briefing.identity.catalogSourceId).toBe(catalog?.id);
	});

	it('returns unavailable fields when synthesis fails instead of excerpt text', async () => {
		const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
			if (!init?.body)
				return new Response(
					`<main><h1>${identity.canonicalTitle}</h1><p>CSIS 4280 Special Topics in Emerging Technology. This official course page contains enough current course information for source validation.</p></main>`,
					{ headers: { 'content-type': 'text/html' } }
				);
			const body = JSON.parse(String(init.body));
			const content = body.response_format
				? { malformed: true }
				: {
						sources: [
							{
								title: identity.canonicalTitle,
								url: identity.canonicalUrl,
								excerpt: source().excerpt
							}
						]
					};
			return new Response(
				JSON.stringify({
					id: crypto.randomUUID(),
					model: body.response_format ? 'deepseek/deepseek-v4-pro' : 'deepseek/deepseek-v4-flash',
					choices: [
						{
							message: {
								content: JSON.stringify(content),
								annotations: [
									{ type: 'url_citation', url_citation: { url: identity.canonicalUrl } }
								]
							}
						}
					],
					usage: {
						prompt_tokens: 1,
						completion_tokens: 1,
						cost: '0',
						server_tool_use: { web_search_requests: 1 }
					}
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}) as unknown as typeof fetch;
		const result = await runEvidenceFirstPipeline(request, {
			apiKey: 'x',
			fetchImpl,
			costCeilingMicrodollars: 200_000
		});
		expect(result.briefing.description.text).toBe('');
		expect(result.briefing.prerequisites.text).toBe('');
		expect(result.briefing.delivery.text).toBe('');
		expect(result.briefing.assessments.text).toBe('');
		const synthesisBodies = fetchImpl.mock.calls
			.map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : null))
			.filter((body) => body?.response_format);
		expect(synthesisBodies.length).toBeGreaterThanOrEqual(1);
		for (const body of synthesisBodies) {
			expect(body.response_format.json_schema.schema.required).not.toContain('sources');
			expect(body.response_format.json_schema.schema.properties).not.toHaveProperty('sources');
		}
	});

	it('does not retain the former deterministic excerpt fallback', () => {
		const noisy = source({
			excerpt: 'Instructor last name. Course status. Textbook. CSIS 1280. Duplicate paragraph.'
		});
		const briefing = buildDeterministicBriefing(
			bundle([noisy]),
			identity,
			request,
			'flash',
			'2026-07-15'
		);
		expect(briefing.description.text).toBe('');
		expect(briefing.prerequisites.text).toBe('');
		expect(briefing.delivery.text).toBe('');
		expect(briefing.assessments.text).toBe('');
	});
});
