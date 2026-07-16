import {
	aggregateUsage,
	assertWithinBudget,
	dollarsToMicrodollars,
	estimateCostMicrodollars
} from './cost';
import { buildEvidenceBundle, makeEvidenceSources } from './evidence';
import { filterRelevantEvidence, targetForCategory } from './relevance';
import { createOpenRouterSearchAdapter, SearchProviderError } from './search-provider';
import { evidenceCategories } from './normalize';
import { isRetryableFailure, type ResearchModelPolicy, MODEL_POLICY } from './policy';
import {
	EVIDENCE_SYSTEM_PROMPT,
	SYNTHESIS_SYSTEM_PROMPT,
	buildEvidenceUserPrompt,
	buildSynthesisUserPrompt
} from './prompt';
import { validateStructuredBriefing, ValidationError } from './validation';
import { BRIEFING_V4_JSON_SCHEMA } from './schema';
import type {
	BriefingRequest,
	BriefingUsage,
	BriefingV4,
	EvidenceBundle,
	EvidenceCategory,
	EvidenceSource,
	IdentityCandidate
} from './schema';
import {
	admitBriefing,
	evaluateCourseIdentity,
	normalizeCourseCode,
	resolveInstitution,
	type ResolvedCourse
} from './accuracy-gate';

// ═══════════════════════════════════════════════════════════════
// Types & constants
// ═══════════════════════════════════════════════════════════════

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GENERATION_URL = 'https://openrouter.ai/api/v1/generation';

export const MAX_CATEGORY_CONCURRENCY = 3,
	MAX_SEARCH_REQUESTS = 8,
	MAX_STAGE_ATTEMPTS = 2,
	PIPELINE_TIMEOUT_MS = 150_000;

export const CATEGORY_CACHE_TTL_MS: Record<EvidenceCategory, number> = {
	catalog: 7 * 86_400_000,
	prerequisites: 7 * 86_400_000,
	outline: 24 * 3_600_000,
	schedule: 6 * 3_600_000,
	'professor-course': 6 * 3_600_000,
	'professor-profile': 24 * 3_600_000,
	'rate-my-professors': 24 * 3_600_000
};

type ProviderResponse = {
	id?: string;
	model?: string;
	provider?: string;
	choices?: Array<{
		message?: {
			content?: string;
			annotations?: Array<{ type?: string; url_citation?: { url?: string } }>;
		};
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		prompt_tokens_details?: { cached_tokens?: number };
		completion_tokens_details?: { reasoning_tokens?: number };
		cost?: string | number;
		server_tool_use?: { web_search_requests?: number };
	};
	error?: { message?: string };
};

export type AttemptCapture = {
	stage: string;
	attempt: number;
	responseId: string | null;
	requestedModel: string;
	actualModel: string | null;
	provider: string | null;
	query: string | null;
	responseJson: string | null;
	usage: BriefingUsage;
	elapsedMs: number;
	status: number;
	retry: boolean;
};

export type PipelineHooks = {
	onStage?: (stage: string) => void | Promise<void>;
	onAttempt?: (attempt: AttemptCapture) => void | Promise<void>;
	onEvidence?: (
		category: EvidenceCategory,
		sources: ReturnType<typeof makeEvidenceSources>
	) => void | Promise<void>;
	onIdentityCandidates?: (candidates: IdentityCandidate[]) => void | Promise<void>;
};

export class PipelineError extends Error {
	constructor(
		public readonly code:
			| 'AMBIGUOUS_COURSE'
			| 'NOT_FOUND'
			| 'UPSTREAM_ERROR'
			| 'INVALID_MODEL_OUTPUT'
			| 'COST_BUDGET_EXCEEDED'
			| 'CANCELLED'
			| 'TIME_LIMIT_EXCEEDED',
		message: string,
		public readonly status?: number
	) {
		super(message);
	}
}

export type PipelineOptions = {
	apiKey: string;
	fetchImpl?: typeof fetch;
	costCeilingMicrodollars?: number;
	timeoutMs?: number;
	modelPolicy?: ResearchModelPolicy;
	hooks?: PipelineHooks;
	isCancelled?: () => boolean | Promise<boolean>;
	sleep?: (ms: number) => Promise<void>;
	random?: () => number;
	now?: () => number;
	forceRefresh?: boolean;
	categoryCache?: {
		get: (category: EvidenceCategory) => Promise<ReturnType<typeof makeEvidenceSources> | null>;
		set: (
			category: EvidenceCategory,
			sources: ReturnType<typeof makeEvidenceSources>,
			ttlMs: number
		) => Promise<void>;
	};
};

// ═══════════════════════════════════════════════════════════════
// Pipeline
// ═══════════════════════════════════════════════════════════════

const emptyUsage = (): BriefingUsage => ({
	inputTokens: 0,
	outputTokens: 0,
	reasoningTokens: 0,
	cachedTokens: 0,
	searchRequests: 0,
	costMicrodollars: 0
});

function responseUsage(r: ProviderResponse, model: string): BriefingUsage {
	const i = Math.max(0, r.usage?.prompt_tokens ?? 0),
		o = Math.max(0, r.usage?.completion_tokens ?? 0),
		s = Math.max(0, r.usage?.server_tool_use?.web_search_requests ?? 0);
	return {
		inputTokens: i,
		outputTokens: o,
		reasoningTokens: Math.max(0, r.usage?.completion_tokens_details?.reasoning_tokens ?? 0),
		cachedTokens: Math.max(0, r.usage?.prompt_tokens_details?.cached_tokens ?? 0),
		searchRequests: s,
		costMicrodollars:
			dollarsToMicrodollars(r.usage?.cost) ?? estimateCostMicrodollars(model, i, o, s)
	};
}

export async function reconcileGenerationCost(
	id: string,
	apiKey: string,
	fetchImpl: typeof fetch = fetch
): Promise<number | null> {
	const r = await fetchImpl(`${GENERATION_URL}?id=${encodeURIComponent(id)}`, {
		headers: { authorization: `Bearer ${apiKey}` }
	});
	if (!r.ok) return null;
	const data = (await r.json().catch(() => null)) as {
		data?: { usage?: number | string; total_cost?: number | string };
	} | null;
	return dollarsToMicrodollars(data?.data?.total_cost ?? data?.data?.usage);
}

const sleepDefault = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function textFromHtml(html: string): string {
	const content =
		html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
		html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
		html;
	return content
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;|&#160;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&quot;|&#34;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/** Retrieve each cited official page independently; citations remain the source identity. */
function derivedCatalogPatternSources(
	category: EvidenceCategory,
	request: BriefingRequest
): EvidenceSource[] {
	const institution = resolveInstitution(request.institution);
	if (!institution?.catalogPathTemplates?.length) return [];
	const courseCodeSlug = normalizeCourseCode(request.courseCode).toLowerCase().replace(/\s+/g, '-');
	const urls = institution.catalogPathTemplates.map(
		(template) =>
			`https://${institution.domain}${template.replace('{courseCodeSlug}', courseCodeSlug)}`
	);
	return makeEvidenceSources(
		category,
		urls.map((url) => ({ title: request.courseCode, url, excerpt: request.courseCode })),
		urls,
		request
	);
}

async function hydrateOfficialSources(
	sources: EvidenceSource[],
	fetchImpl: typeof fetch
): Promise<EvidenceSource[]> {
	return Promise.all(
		sources.map(async (source) => {
			if (source.sourceType !== 'official') return source;
			try {
				const response = await fetchImpl(source.url, {
					headers: { accept: 'text/html,application/xhtml+xml' },
					signal: AbortSignal.timeout(15_000)
				});
				const type = response.headers.get('content-type') ?? '';
				if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(type))
					return { ...source, retrievalStatus: 'partial' };
				const text = textFromHtml(await response.text());
				if (text.length < 160) return { ...source, retrievalStatus: 'partial' };
				return { ...source, excerpt: text.slice(0, 8000), retrievalStatus: 'retrieved' };
			} catch {
				return { ...source, retrievalStatus: 'partial' };
			}
		})
	);
}

const OUTLINE_FIELDS = [
	'description',
	'credits',
	'prerequisites',
	'corequisites',
	'delivery',
	'assessments'
] as const;

function emptyCandidateSection() {
	return { text: '', sourceIds: [], claimIds: [] };
}

function removeDuplicateCandidateFields(candidate: Record<string, unknown>): void {
	const seen = new Set<string>();
	for (const field of OUTLINE_FIELDS) {
		const section = candidate[field] as Record<string, unknown> | undefined;
		const text = typeof section?.text === 'string' ? section.text : '';
		const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
		if (!normalized) continue;
		if (seen.has(normalized)) candidate[field] = emptyCandidateSection();
		else seen.add(normalized);
	}
}

function invalidFieldFrom(error: unknown): (typeof OUTLINE_FIELDS)[number] | null {
	if (!(error instanceof ValidationError)) return null;
	const match = error.message.match(
		/^(description|credits|prerequisites|corequisites|delivery|assessments)\b/
	);
	return match ? (match[1] as (typeof OUTLINE_FIELDS)[number]) : null;
}

export async function runEvidenceFirstPipeline(
	request: BriefingRequest,
	options: PipelineOptions
): Promise<{ briefing: BriefingV4; evidence: EvidenceBundle }> {
	const fetchImpl = options.fetchImpl ?? fetch,
		policy = options.modelPolicy ?? MODEL_POLICY,
		hooks = options.hooks ?? {},
		started = (options.now ?? Date.now)(),
		now = options.now ?? Date.now;
	if (policy.search !== MODEL_POLICY.search || policy.synthesis !== MODEL_POLICY.synthesis)
		throw new PipelineError('UPSTREAM_ERROR', 'Unapproved internal model policy');
	let searchOps = 0;
	const usages: BriefingUsage[] = [];
	projectReportBudget(policy, options.costCeilingMicrodollars);

	const cancelled = async () => {
		if (await options.isCancelled?.())
			throw new PipelineError('CANCELLED', 'Course research was cancelled');
		if (now() - started > (options.timeoutMs ?? PIPELINE_TIMEOUT_MS))
			throw new PipelineError('TIME_LIMIT_EXCEEDED', 'Course research timed out');
	};

	const projected = (model: string, input: number, output: number, search = 0) => {
		try {
			assertWithinBudget(
				aggregateUsage([
					...usages,
					{
						...emptyUsage(),
						inputTokens: input,
						outputTokens: output,
						searchRequests: search,
						costMicrodollars: estimateCostMicrodollars(model, input, output, search)
					}
				]),
				options.costCeilingMicrodollars
			);
		} catch {
			throw new PipelineError('COST_BUDGET_EXCEEDED', 'Cost budget exceeded');
		}
	};

	async function call(
		stage: string,
		model: string,
		body: Record<string, unknown>,
		isSearch: boolean,
		query: string | null = null
	): Promise<ProviderResponse> {
		let last: unknown;
		for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt++) {
			await cancelled();
			if (isSearch) {
				if (searchOps >= MAX_SEARCH_REQUESTS)
					throw new PipelineError('COST_BUDGET_EXCEEDED', 'Search operation limit exceeded');
				projected(model, 8_000, 3_000, 1);
				searchOps++;
			} else projected(model, 8_000, 3_500);
			const began = now();
			let status = 0;
			try {
				const response = await fetchImpl(CHAT_URL, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						authorization: `Bearer ${options.apiKey}`
					},
					body: JSON.stringify(body),
					signal: AbortSignal.timeout(
						Math.min(isSearch ? 45_000 : 90_000, options.timeoutMs ?? PIPELINE_TIMEOUT_MS)
					)
				});
				status = response.status;
				const data = (await response.json().catch(() => ({}))) as ProviderResponse;
				let u = responseUsage(data, model);
				if (data.id && data.usage?.cost == null) {
					const reconciled = await reconcileGenerationCost(data.id, options.apiKey, fetchImpl);
					if (reconciled != null) u = { ...u, costMicrodollars: reconciled };
				}
				usages.push(u);
				await hooks.onAttempt?.({
					stage,
					attempt,
					responseId: data.id ?? null,
					requestedModel: model,
					actualModel: data.model ?? null,
					provider: data.provider ?? null,
					query,
					responseJson: response.ok ? JSON.stringify(data) : null,
					usage: u,
					elapsedMs: now() - began,
					status,
					retry: !response.ok && attempt < 2
				});
				if (!response.ok)
					throw new PipelineError('UPSTREAM_ERROR', 'Provider unavailable', response.status);
				if (data.model && data.model !== model && !data.model.startsWith(`${model}-`))
					throw new PipelineError('UPSTREAM_ERROR', 'Provider served an unapproved model');
				return data;
			} catch (error) {
				last = error;
				if (status === 0)
					await hooks.onAttempt?.({
						stage,
						attempt,
						responseId: null,
						requestedModel: model,
						actualModel: null,
						provider: null,
						query,
						responseJson: null,
						usage: emptyUsage(),
						elapsedMs: now() - began,
						status: 0,
						retry: attempt < 2
					});
				if (attempt === MAX_STAGE_ATTEMPTS || !isRetryableFailure(error)) throw error;
				await cancelled();
				const delay = Math.floor(
					250 * 2 ** (attempt - 1) * (0.5 + (options.random ?? Math.random)())
				);
				await (options.sleep ?? sleepDefault)(delay);
			}
		}
		throw last;
	}

	async function search(category: EvidenceCategory) {
		if (!options.forceRefresh) {
			const cached = await options.categoryCache?.get(category);
			if (cached) {
				const relevant = filterRelevantEvidence(cached, request, targetForCategory(category));
				await hooks.onEvidence?.(category, relevant);
				return relevant;
			}
		}
		const cached = await options.categoryCache?.get(category);
		if (cached && !options.forceRefresh) {
			const relevant = filterRelevantEvidence(cached, request, targetForCategory(category));
			await hooks.onEvidence?.(category, relevant);
			return relevant;
		}
		const effectiveRequest =
			category === 'catalog' ? { ...request, professorName: undefined } : request;
		const query = buildEvidenceUserPrompt(effectiveRequest, category);
		const runSearch = async (stage: string, searchQuery: string) => {
			const searchAdapter = createOpenRouterSearchAdapter(async (body, signal) => {
				const r = await call(stage, policy.search, body, true, searchQuery);
				if (signal.aborted) throw new PipelineError('CANCELLED', 'Course research was cancelled');
				return { status: 200, data: r };
			});
			return searchAdapter({
				request,
				category,
				query: searchQuery,
				systemPrompt: EVIDENCE_SYSTEM_PROMPT,
				policy,
				signal: AbortSignal.timeout(Math.min(60_000, options.timeoutMs ?? PIPELINE_TIMEOUT_MS))
			});
		};
		let searched: Awaited<ReturnType<typeof runSearch>>;
		try {
			searched = await runSearch(`search:${category}`, query);
		} catch (error) {
			if (!(error instanceof SearchProviderError) || error.code !== 'MALFORMED_RESPONSE')
				throw error;
			searched = { status: 'empty', sources: [], usage: {} };
		}
		let sources = filterRelevantEvidence(searched.sources, request, targetForCategory(category));
		if (!sources.length && cached?.length) {
			// Primary search is empty, not an excuse to discard a previously validated canonical URL.
			sources = (
				await hydrateOfficialSources(
					filterRelevantEvidence(cached, request, targetForCategory(category)),
					fetchImpl
				)
			).filter((source) => source.retrievalStatus === 'retrieved');
		}
		if (!sources.length) {
			const institution = resolveInstitution(request.institution);
			if (institution) {
				const discoveryQuery = `${query}\nOFFICIAL_DOMAIN_DISCOVERY: search only ${institution.domain} for ${request.courseCode}${request.courseName ? ` ${request.courseName}` : ''}.`;
				try {
					const discovered = await runSearch(`discovery:${category}`, discoveryQuery);
					sources = filterRelevantEvidence(
						discovered.sources,
						request,
						targetForCategory(category)
					);
				} catch (error) {
					if (!(error instanceof SearchProviderError) || error.code !== 'MALFORMED_RESPONSE')
						throw error;
				}
			}
		}
		if (!sources.length) sources = derivedCatalogPatternSources(category, request);
		const hydrated = await hydrateOfficialSources(sources, fetchImpl);
		const usable = hydrated.filter((source) =>
			source.sourceType === 'official' ? source.retrievalStatus === 'retrieved' : true
		);
		if (usable.length)
			await options.categoryCache?.set(category, usable, CATEGORY_CACHE_TTL_MS[category]);
		await hooks.onEvidence?.(category, usable);
		return usable;
	}

	await hooks.onStage?.('resolving_identity');
	const catalog = await search('catalog');
	const identity = evaluateCourseIdentity(catalog, request);
	if (identity.status === 'rejected') {
		if (identity.code === 'CONFLICTING_CANONICAL_TITLES') {
			await hooks.onIdentityCandidates?.(
				identity.candidates.map((candidate) => ({
					code: request.courseCode,
					name: candidate.title,
					institution: request.institution ?? '',
					officialDomain: new URL(candidate.url).hostname,
					sourceLabel: 'Official catalog',
					url: candidate.url,
					sourceId: candidate.sourceId
				}))
			);
			throw new PipelineError('AMBIGUOUS_COURSE', identity.code);
		}
		throw new PipelineError('NOT_FOUND', identity.code);
	}
	const resolvedIdentity = identity.course;
	const categories = evidenceCategories(request).filter(
		(category) => category !== 'catalog' && category !== 'professor-profile'
	);
	const result: Partial<Record<EvidenceCategory, ReturnType<typeof makeEvidenceSources>>> = {
		catalog
	};
	const groups: Array<{ stage: string; categories: EvidenceCategory[] }> = [
		{
			stage: 'searching_outline',
			categories: categories.filter((category) => ['prerequisites', 'outline'].includes(category))
		},
		{
			stage: 'searching_instructor',
			categories: categories.filter((category) =>
				['schedule', 'professor-course', 'rate-my-professors'].includes(category)
			)
		}
	];
	for (const group of groups) {
		if (!group.categories.length) continue;
		await hooks.onStage?.(group.stage);
		const results = await Promise.allSettled(
			group.categories.map(async (category) => [category, await search(category)] as const)
		);
		for (const r of results) {
			if (r.status === 'fulfilled') {
				const [c, s] = r.value;
				result[c] = s;
			}
		}
	}
	const evidence = buildEvidenceBundle(request, result, aggregateUsage(usages));
	await hooks.onStage?.('ranking_evidence');
	await cancelled();
	await hooks.onStage?.('synthesizing');
	const researchedAt = new Date(now()).toISOString();
	let briefing: BriefingV4 | undefined;
	try {
		const synthesis = await call(
			'synthesis',
			policy.synthesis,
			{
				model: policy.synthesis,
				messages: [
					{ role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
					{ role: 'user', content: buildSynthesisUserPrompt(evidence, resolvedIdentity) }
				],
				temperature: 0,
				max_tokens: 6000,
				response_format: {
					type: 'json_schema',
					json_schema: {
						name: 'course_brief',
						strict: true,
						schema: BRIEFING_V4_JSON_SCHEMA
					}
				}
			},
			false
		);
		const content = synthesis.choices?.[0]?.message?.content;
		if (!content) throw new Error('Synthesis returned no content');
		const candidate = JSON.parse(content) as Record<string, unknown>;
		removeDuplicateCandidateFields(candidate);
		for (let attempt = 0; attempt <= OUTLINE_FIELDS.length; attempt++) {
			try {
				briefing = validateStructuredBriefing(
					candidate,
					evidence.sources,
					request,
					{
						researchedAt,
						modelUsed: policy.synthesis,
						searchModel: policy.search,
						synthesisModel: policy.synthesis,
						usage: aggregateUsage(usages)
					},
					resolvedIdentity
				);
				break;
			} catch (error) {
				const field = invalidFieldFrom(error);
				if (!field || attempt === OUTLINE_FIELDS.length) throw error;
				candidate[field] = emptyCandidateSection();
			}
		}
		if (!briefing) throw new Error('Synthesis did not produce a briefing');
		const outlineText = evidence.sources
			.filter((source) => source.category === 'outline' && source.currentness === 'current')
			.map((source) => source.excerpt)
			.join('\n');
		const needsOutlineRepair =
			(!briefing.delivery.text &&
				/method\(s\) of instruction|learning activities/i.test(outlineText)) ||
			(!briefing.assessments.text &&
				/means of assessment|\bevaluation\b|\bassessment\b/i.test(outlineText));
		if (needsOutlineRepair) {
			try {
				const repair = await call(
					'synthesis:repair',
					policy.synthesis,
					{
						model: policy.synthesis,
						messages: [
							{ role: 'system', content: SYNTHESIS_SYSTEM_PROMPT },
							{
								role: 'user',
								content: `${buildSynthesisUserPrompt(evidence, resolvedIdentity)}\n\nReturn the complete JSON again. Fill concise Delivery and Assessments from explicitly labelled current official course or outline evidence when present.`
							}
						],
						temperature: 0,
						max_tokens: 6000,
						response_format: {
							type: 'json_schema',
							json_schema: { name: 'course_brief', strict: true, schema: BRIEFING_V4_JSON_SCHEMA }
						}
					},
					false
				);
				const repaired = validateStructuredBriefing(
					JSON.parse(repair.choices?.[0]?.message?.content ?? ''),
					evidence.sources,
					request,
					{
						researchedAt,
						modelUsed: policy.synthesis,
						searchModel: policy.search,
						synthesisModel: policy.synthesis,
						usage: aggregateUsage(usages)
					},
					resolvedIdentity
				);
				if (repaired.delivery.text || repaired.assessments.text) briefing = repaired;
			} catch {
				// Retain the first validated result if repair cannot be admitted.
			}
		}
		const offerings = briefing.offerings
			? [
					briefing.offerings.current,
					briefing.offerings.upcoming,
					...(briefing.offerings.historical ?? [])
				]
			: [];
		const admission = admitBriefing(
			briefing.sources,
			resolvedIdentity,
			offerings,
			briefing.claims,
			request
		);
		if (admission.status !== 'accepted' && admission.status !== 'partial')
			throw new Error('Synthesis did not meet admission requirements');
	} catch {
		briefing = buildUnavailableBriefing(
			evidence,
			resolvedIdentity,
			request,
			policy.search,
			researchedAt
		);
	}
	await hooks.onStage?.('validating');
	return { briefing: briefing!, evidence };
}

function section(text = '', sourceIds: string[] = [], claimIds: string[] = []) {
	return { text, sourceIds, claimIds };
}

export function buildDeterministicBriefing(
	evidence: EvidenceBundle,
	identity: ResolvedCourse,
	request: BriefingRequest,
	searchModel: string,
	researchedAt: string
): BriefingV4 {
	return buildUnavailableBriefing(evidence, identity, request, searchModel, researchedAt);
}

/** A synthesis failure is an evidence gap, never permission to expose retrieved prose. */
function buildUnavailableBriefing(
	evidence: EvidenceBundle,
	identity: ResolvedCourse,
	request: BriefingRequest,
	searchModel: string,
	researchedAt: string
): BriefingV4 {
	const catalog = evidence.sources.find((source) => source.id === identity.sourceId);
	if (!catalog) throw new PipelineError('NOT_FOUND', 'Verified catalog source is unavailable');
	const empty = () => section();
	return {
		schemaVersion: 5,
		identity: {
			code: identity.courseCode,
			name: identity.canonicalTitle,
			institution: identity.institution,
			officialDomain:
				resolveInstitution(request.institution)?.domain ?? new URL(catalog.url).hostname,
			catalogSourceId: catalog.id,
			candidates: [],
			confidence: 'high',
			verifiedAt: researchedAt
		},
		instructor: {
			requestedName: request.professorName ?? null,
			name: null,
			status: request.professorName ? 'requested_by_user' : 'not_requested',
			sourceIds: []
		},
		description: empty(),
		credits: empty(),
		prerequisites: empty(),
		corequisites: empty(),
		delivery: empty(),
		assessments: empty(),
		workload: empty(),
		rateMyProfessors: empty(),
		contradictions: empty(),
		missing: empty(),
		summary: empty(),
		claims: [],
		sources: evidence.sources,
		researchedAt,
		modelUsed: 'synthesis-unavailable',
		searchModel,
		synthesisModel: 'none',
		usage: evidence.usage
	};
}

function projectReportBudget(policy: ResearchModelPolicy, ceiling = 100_000) {
	const maximum = MAX_SEARCH_REQUESTS * estimateCostMicrodollars(policy.search, 8_000, 3_000, 1);
	if (maximum > ceiling)
		throw new PipelineError('COST_BUDGET_EXCEEDED', 'Projected report cost exceeds budget');
}
