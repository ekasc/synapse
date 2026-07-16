import { canonicalizeHttpUrl, currentnessForUrl, sourceTypeForUrl } from './evidence';
import type { BriefingRequest, BriefingUsage, BriefingV4, EvidenceSource } from './schema';

export const RESEARCH_RUN_DEFAULT_LIMITS = {
	maxDurationMs: 120_000,
	maxToolCalls: 12,
	maxProviderCalls: 8,
	maxSearchCalls: 6,
	maxFetchCalls: 4,
	maxCostUsd: 0.1
} as const;

export type ResearchRunLimits = typeof RESEARCH_RUN_DEFAULT_LIMITS;
export type ResearchRunMetadata = {
	runId: string;
	jobId: string;
	startedAt: string;
	completedAt?: string;
	providerCalls: number;
	toolCalls: number;
	searchCalls: number;
	fetchCalls: number;
	usage?: Partial<Pick<BriefingUsage, 'inputTokens' | 'outputTokens'>> & { costUsd?: number };
	termination:
		| 'submitted'
		| 'needs_input'
		| 'deadline'
		| 'tool_limit'
		| 'provider_limit'
		| 'cost_limit'
		| 'cancelled'
		| 'failed';
};
export type CandidateBriefing = BriefingV4;
export type ResearchAction =
	| {
			type: 'search';
			query: string;
			category?: EvidenceSource['category'];
			domain?: string;
			term?: string;
	  }
	| { type: 'fetch_page'; url: string }
	| { type: 'submit_candidate'; candidate: CandidateBriefing }
	| { type: 'request_clarification'; question: string }
	| { type: 'stop_insufficient'; reason: string };
export type ResearchModelClient = {
	next(input: {
		request: BriefingRequest;
		evidence: EvidenceSource[];
		actions: Array<{ type: string; summary: string }>;
		remaining: ResearchRunLimits;
		signal: AbortSignal;
	}): Promise<{
		action: unknown;
		usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number };
	}>;
};
export type SearchTool = (input: {
	query: string;
	category?: EvidenceSource['category'];
	domain?: string;
	term?: string;
	signal: AbortSignal;
}) => Promise<EvidenceSource[]>;
export type PageFetchResult = {
	url: string;
	finalUrl: string;
	retrievalStatus: EvidenceSource['retrievalStatus'];
	contentType: string | null;
	excerpt: string;
};
export type PageFetchTool = (url: string, signal: AbortSignal) => Promise<PageFetchResult>;
export type ResearchRunRequest = {
	jobId: string;
	userId: string;
	briefingRequest: BriefingRequest;
	limits?: Partial<ResearchRunLimits>;
	signal?: AbortSignal;
	isCancelled?: () => boolean | Promise<boolean>;
};
export type ResearchRunResult =
	| { status: 'completed'; candidate: CandidateBriefing; metadata: ResearchRunMetadata }
	| { status: 'needs_input'; question: string; metadata: ResearchRunMetadata }
	| {
			status: 'exhausted';
			reason: 'deadline' | 'tool_limit' | 'provider_limit' | 'cost_limit';
			metadata: ResearchRunMetadata;
	  }
	| { status: 'cancelled'; metadata: ResearchRunMetadata }
	| { status: 'failed'; errorCode: string; safeMessage: string; metadata: ResearchRunMetadata };
export type ResearchRunDependencies = {
	model: ResearchModelClient;
	search: SearchTool;
	fetchPage?: PageFetchTool;
	now?: () => number;
	newRunId?: () => string;
};

function asAction(value: unknown): ResearchAction | null {
	if (!value || typeof value !== 'object') return null;
	const action = value as Record<string, unknown>;
	if (action.type === 'search' && typeof action.query === 'string') return action as ResearchAction;
	if (action.type === 'fetch_page' && typeof action.url === 'string')
		return action as ResearchAction;
	if (
		action.type === 'submit_candidate' &&
		action.candidate &&
		typeof action.candidate === 'object'
	)
		return action as ResearchAction;
	if (action.type === 'request_clarification' && typeof action.question === 'string')
		return action as ResearchAction;
	if (action.type === 'stop_insufficient' && typeof action.reason === 'string')
		return action as ResearchAction;
	return null;
}
function candidateHasKnownSources(candidate: CandidateBriefing, evidence: Map<string, EvidenceSource>): boolean {
	const known = new Set(evidence.keys());
	const cited = [
		...candidate.claims.flatMap((claim) => claim.sourceIds),
		...[
			'description',
			'credits',
			'prerequisites',
			'corequisites',
			'delivery',
			'assessments',
			'workload',
			'rateMyProfessors',
			'contradictions',
			'missing',
			'summary'
		].flatMap((key) => candidate[key as keyof CandidateBriefing] as never)
	];
	return cited.every((value) => {
		if (typeof value === 'string') return known.has(value);
		if (value && typeof value === 'object' && 'sourceIds' in value)
			return (value as { sourceIds: string[] }).sourceIds.every((id) => known.has(id));
		return true;
	});
}
export function createPageFetchTool(
	fetchImpl: typeof fetch = fetch,
	maxBytes = 250_000
): PageFetchTool {
	return async (value, signal) => {
		const url = canonicalizeHttpUrl(value);
		if (!url)
			return {
				url: value,
				finalUrl: value,
				retrievalStatus: 'unavailable',
				contentType: null,
				excerpt: ''
			};
		try {
			const response = await fetchImpl(url, { signal, redirect: 'follow' });
			const finalUrl = canonicalizeHttpUrl(response.url) ?? url;
			if (!response.ok)
				return {
					url,
					finalUrl,
					retrievalStatus: 'unavailable',
					contentType: response.headers.get('content-type'),
					excerpt: ''
				};
			const text = (await response.text()).slice(0, maxBytes).replace(/\s+/g, ' ').trim();
			return {
				url,
				finalUrl,
				retrievalStatus: text ? 'retrieved' : 'partial',
				contentType: response.headers.get('content-type'),
				excerpt: text.slice(0, 4000)
			};
		} catch (error) {
			if (signal.aborted) throw error;
			return { url, finalUrl: url, retrievalStatus: 'unavailable', contentType: null, excerpt: '' };
		}
	};
}

export async function runResearchRun(
	request: ResearchRunRequest,
	deps: ResearchRunDependencies
): Promise<ResearchRunResult> {
	const limits = { ...RESEARCH_RUN_DEFAULT_LIMITS, ...request.limits };
	const now = deps.now ?? Date.now;
	const startedAtMs = now();
	const controller = new AbortController();
	const abort = () => controller.abort();
	request.signal?.addEventListener('abort', abort, { once: true });
	const evidence = new Map<string, EvidenceSource>();
	const actions: Array<{ type: string; summary: string }> = [];
	let providerCalls = 0,
		toolCalls = 0,
		searchCalls = 0,
		fetchCalls = 0;
	let usage: ResearchRunMetadata['usage'];
	const metadata = (termination: ResearchRunMetadata['termination']): ResearchRunMetadata => ({
		runId: deps.newRunId ? deps.newRunId() : crypto.randomUUID(),
		jobId: request.jobId,
		startedAt: new Date(startedAtMs).toISOString(),
		completedAt: new Date(now()).toISOString(),
		providerCalls,
		toolCalls,
		searchCalls,
		fetchCalls,
		...(usage ? { usage } : {}),
		termination
	});
	const cancelled = async () => controller.signal.aborted || Boolean(await request.isCancelled?.());
	const exhausted = (): 'deadline' | 'tool_limit' | 'provider_limit' | 'cost_limit' | null => {
		if (now() - startedAtMs >= limits.maxDurationMs) return 'deadline';
		if (toolCalls >= limits.maxToolCalls) return 'tool_limit';
		if (providerCalls >= limits.maxProviderCalls) return 'provider_limit';
		if ((usage?.costUsd ?? 0) >= limits.maxCostUsd) return 'cost_limit';
		return null;
	};
	try {
		for (;;) {
			if (await cancelled()) return { status: 'cancelled', metadata: metadata('cancelled') };
			const limit = exhausted();
			if (limit) return { status: 'exhausted', reason: limit, metadata: metadata(limit) };
			providerCalls++;
			const response = await deps.model.next({
				request: request.briefingRequest,
				evidence: [...evidence.values()],
				actions,
				remaining: {
					...limits,
					maxToolCalls: limits.maxToolCalls - toolCalls,
					maxProviderCalls: limits.maxProviderCalls - providerCalls,
					maxSearchCalls: limits.maxSearchCalls - searchCalls,
					maxFetchCalls: limits.maxFetchCalls - fetchCalls
				},
				signal: controller.signal
			});
			usage = response.usage;
			if (await cancelled()) return { status: 'cancelled', metadata: metadata('cancelled') };
			const action = asAction(response.action);
			if (!action)
				return {
					status: 'failed',
					errorCode: 'MALFORMED_ACTION',
					safeMessage: 'Research returned an invalid action.',
					metadata: metadata('failed')
				};
			if (action.type === 'submit_candidate') {
				if (!candidateHasKnownSources(action.candidate, evidence))
					return {
						status: 'failed',
						errorCode: 'INVALID_CANDIDATE_SOURCES',
						safeMessage: 'Research returned invalid source citations.',
						metadata: metadata('failed')
					};
				return {
					status: 'completed',
					// Sources are capability-owned run state. Never admit model-provided source
					// fields, even when their IDs are known; that would let a model alter an
					// admissible URL, domain, or currentness after retrieval.
					candidate: { ...action.candidate, sources: [...evidence.values()] },
					metadata: metadata('submitted')
				};
			}
			if (action.type === 'request_clarification')
				return {
					status: 'needs_input',
					question: action.question,
					metadata: metadata('needs_input')
				};
			if (action.type === 'stop_insufficient')
				return {
					status: 'failed',
					errorCode: 'INSUFFICIENT_EVIDENCE',
					safeMessage: action.reason.slice(0, 500),
					metadata: metadata('failed')
				};
			if (toolCalls >= limits.maxToolCalls)
				return { status: 'exhausted', reason: 'tool_limit', metadata: metadata('tool_limit') };
			toolCalls++;
			if (action.type === 'search') {
				if (searchCalls >= limits.maxSearchCalls)
					return { status: 'exhausted', reason: 'tool_limit', metadata: metadata('tool_limit') };
				searchCalls++;
				const sources = await deps.search({ ...action, signal: controller.signal });
				for (const source of sources) evidence.set(source.id, source);
				actions.push({ type: 'search', summary: `${action.query}: ${sources.length} results` });
			} else {
				if (fetchCalls >= limits.maxFetchCalls)
					return { status: 'exhausted', reason: 'tool_limit', metadata: metadata('tool_limit') };
				fetchCalls++;
				const fetched = await (deps.fetchPage ?? createPageFetchTool())(
					action.url,
					controller.signal
				);
				const url = canonicalizeHttpUrl(fetched.finalUrl);
				if (url)
					evidence.set(`fetch_${fetchCalls}`, {
						id: `fetch_${fetchCalls}`,
						category: 'catalog',
						title: url,
						url,
						canonicalUrl: url,
						domain: new URL(url).hostname,
						publisher: new URL(url).hostname,
						excerpt: fetched.excerpt,
						sourceType: sourceTypeForUrl(url, request.briefingRequest.institution),
						publishedAt: null,
						updatedAt: null,
						retrievedAt: new Date(now()).toISOString(),
						currentness: currentnessForUrl(url),
						retrievalStatus: fetched.retrievalStatus,
						contentFingerprint: `fetch-${fetchCalls}`,
						claimsSupported: []
					});
				actions.push({ type: 'fetch_page', summary: fetched.retrievalStatus });
			}
		}
	} catch (error) {
		if (await cancelled()) return { status: 'cancelled', metadata: metadata('cancelled') };
		const code =
			error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
				? error.message
				: 'RESEARCH_RUN_FAILED';
		return {
			status: 'failed',
			errorCode: code,
			safeMessage: 'Research could not be completed.',
			metadata: metadata('failed')
		};
	} finally {
		request.signal?.removeEventListener('abort', abort);
	}
}
