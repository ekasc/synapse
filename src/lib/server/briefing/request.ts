import { BRIEFING_JSON_SCHEMA, BRIEFING_SCHEMA_VERSION } from './schema';
import type { Briefing, BriefingRequest } from './schema';
import { ValidationError, extractBriefingContent, parseBriefingContent } from './validation';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type OpenRouterMessage =
	| { role: 'system' | 'user'; content: string }
	| { role: 'assistant'; content: string };

export type OpenRouterPlugin = { id: string; [key: string]: unknown };

export type OpenRouterRequest = {
	model: string;
	messages: OpenRouterMessage[];
	plugins?: OpenRouterPlugin[];
	response_format?:
		| { type: 'json_object' }
		| {
				type: 'json_schema';
				json_schema: { name: string; strict: true; schema: unknown };
		  };
	provider?: { require_parameters?: boolean };
	temperature?: number;
	max_tokens?: number;
	seed?: number;
};

export type OpenRouterChoice = {
	message?: { content?: string | null };
	finish_reason?: string | null;
};

export type OpenRouterResponse = {
	choices?: OpenRouterChoice[];
	error?: { code?: number; message?: string; metadata?: Record<string, unknown> };
};

export type BuildRequestInput = {
	model: string;
	messages: OpenRouterMessage[];
};

export type ResearchInput = BuildRequestInput & {
	apiKey: string;
	fetchImpl?: typeof fetch;
	maxRetries?: number;
};

export type ResearchResult = {
	briefing: Briefing;
	usedStrict: boolean;
	attempts: number;
};

export function buildOpenRouterRequestStrict(
	model: string,
	messages: OpenRouterMessage[]
): OpenRouterRequest {
	return {
		model,
		messages,
		plugins: [{ id: 'web' }, { id: 'response-healing' }],
		response_format: {
			type: 'json_schema',
			json_schema: {
				name: 'course_briefing',
				strict: true,
				schema: BRIEFING_JSON_SCHEMA
			}
		},
		provider: { require_parameters: true },
		seed: 0,
		temperature: 0
	};
}

export function buildOpenRouterRequestFallback(
	model: string,
	messages: OpenRouterMessage[]
): OpenRouterRequest {
	return {
		model,
		messages,
		plugins: [{ id: 'web' }, { id: 'response-healing' }],
		response_format: { type: 'json_object' },
		seed: 0,
		temperature: 0
	};
}

export function buildRequest({ model, messages }: BuildRequestInput): OpenRouterRequest {
	return buildOpenRouterRequestStrict(model, messages);
}

function isUnsupportedStrictSchemaError(data: OpenRouterResponse): boolean {
	const message = (data.error?.message ?? '').toLowerCase();
	if (!message) return false;
	return (
		message.includes('json_schema') ||
		message.includes('strict') ||
		message.includes('response_format') ||
		message.includes('require_parameters')
	);
}

async function callOpenRouter(
	apiKey: string,
	body: OpenRouterRequest,
	fetchImpl: typeof fetch
): Promise<OpenRouterResponse> {
	const response = await fetchImpl(OPENROUTER_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
			'HTTP-Referer': 'https://synapse.app',
			'X-Title': 'Synapse Course Brief'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const errorPayload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
		return {
			error: {
				code: response.status,
				message: errorPayload.error?.message ?? `OpenRouter returned ${response.status}`,
				metadata: errorPayload.error?.metadata
			}
		};
	}

	return (await response.json()) as OpenRouterResponse;
}

export function parseResponse(data: OpenRouterResponse, model: string): Briefing {
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new ValidationError('LLM returned no JSON content');
	}
	return parseBriefingContent(extractBriefingContent(content), model);
}

export async function researchBriefing({
	apiKey,
	model,
	messages,
	fetchImpl,
	maxRetries = 2
}: ResearchInput): Promise<ResearchResult> {
	const fetchToUse = fetchImpl ?? fetch;
	let attempt = 0;
	let usedStrict = false;
	let lastError: unknown;

	while (attempt <= maxRetries) {
		attempt++;
		const isStrict = attempt === 1;
		const request = isStrict
			? buildOpenRouterRequestStrict(model, messages)
			: buildOpenRouterRequestFallback(model, messages);
		usedStrict = isStrict;

		const data = await callOpenRouter(apiKey, request, fetchToUse);

		if (data.error) {
			lastError = new Error(data.error.message);
			if (isStrict && isUnsupportedStrictSchemaError(data)) {
				continue;
			}
			if (data.error.code && data.error.code >= 500) {
				continue;
			}
			throw new Error(data.error.message);
		}

		try {
			const briefing = parseResponse(data, model);
			return { briefing, usedStrict, attempts: attempt };
		} catch (err) {
			lastError = err;
			if (err instanceof ValidationError && attempt <= maxRetries) {
				continue;
			}
			throw err;
		}
	}

	throw lastError instanceof Error ? lastError : new Error('Briefing research failed');
}

export function stableRequestString(request: BriefingRequest, model: string): string {
	return JSON.stringify({
		model,
		schema: BRIEFING_SCHEMA_VERSION,
		request
	});
}
