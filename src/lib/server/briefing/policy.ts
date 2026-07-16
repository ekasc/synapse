export const FLASH_SEARCH_MODEL = 'deepseek/deepseek-v4-flash' as const;
export const PRO_SYNTHESIS_MODEL = 'deepseek/deepseek-v4-pro' as const;
export const MODEL_POLICY = Object.freeze({
	search: FLASH_SEARCH_MODEL,
	synthesis: PRO_SYNTHESIS_MODEL,
	searchProvider: undefined,
	synthesisProvider: undefined
});
export type ResearchModelPolicy = typeof MODEL_POLICY;

export function resolveResearchModelPolicy(config: {
	COURSE_RESEARCH_SEARCH_PROVIDER?: string;
	COURSE_RESEARCH_SYNTHESIS_PROVIDER?: string;
}): ResearchModelPolicy {
	void config;
	return MODEL_POLICY;
}
export function isRetryableFailure(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const value = error as { status?: unknown; code?: unknown; name?: unknown };
	return (
		value.name === 'TimeoutError' ||
		value.code === 'ETIMEDOUT' ||
		(typeof value.status === 'number' && (value.status === 429 || value.status >= 500))
	);
}
export const isRetryableSynthesisFailure = isRetryableFailure;
export function rejectClientModelFields(body: Record<string, unknown>): void {
	if (
		[
			'model',
			'searchModel',
			'synthesisModel',
			'fallbackModel',
			'provider',
			'client',
			'baseURL'
		].some((field) => Object.hasOwn(body, field))
	)
		throw new Error('MODEL_SELECTION_NOT_ALLOWED');
}
