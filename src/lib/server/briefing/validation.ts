export type Source = {
	claim: string;
	url?: string;
	kind: 'url' | 'user_context' | 'model_knowledge';
	confidence: 'high' | 'medium' | 'low';
};

export type BriefingOutput = Record<string, unknown> & {
	entity_snapshot?: {
		summary?: string;
		recent_context?: string[];
		sources?: Source[];
	};
	action_items?: { theme: string; point: string }[];
	flags?: { issue: string; severity: string; advice: string }[];
	recommendations?: string[];
};

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

/** Normalize a source: fill in defaults, rewrite training_data kind */
function normalizeSource(src: Record<string, unknown>): Source {
	const claim = String(src.claim ?? '').trim();
	const url = src.url ? String(src.url).trim() : undefined;
	let kind = String(src.kind ?? '').trim().toLowerCase();

	// Infer kind from URL presence
	if (!kind && url) kind = 'url';
	if (!kind) kind = 'model_knowledge';

	// Rewrite training_data → model_knowledge
	if (kind === 'training_data') kind = 'model_knowledge';

	const confidence = ['high', 'medium', 'low'].includes(src.confidence as string)
		? (src.confidence as 'high' | 'medium' | 'low')
		: 'low';

	return { claim, url, kind: kind as Source['kind'], confidence };
}

/** Validate a source entry */
function validateSource(src: Source): void {
	if (!src.claim) throw new ValidationError('Source claim is empty');
	if (src.kind === 'url' && src.url && !/^https?:\/\//.test(src.url)) {
		throw new ValidationError(`Source URL "${src.url}" must be http/https`);
	}
}

/** Validate the full briefing output. Returns normalized output or throws. */
export function validateBriefing(output: unknown): BriefingOutput {
	if (!output || typeof output !== 'object') {
		throw new ValidationError('Output is not an object');
	}

	const obj = output as Record<string, unknown>;

	// Normalize sources if present
	if (obj.entity_snapshot?.sources) {
		const sources = (obj.entity_snapshot.sources as Record<string, unknown>[]).map(normalizeSource);
		sources.forEach(validateSource);
		obj.entity_snapshot.sources = sources;
	}

	// Check minimum requirements
	const actionItems = (obj.action_items as { theme: string; point: string }[]) ?? [];
	const flags = (obj.flags as { issue: string; severity: string; advice: string }[]) ?? [];
	const recommendations = (obj.recommendations as string[]) ?? [];

	if (actionItems.length < 1 && recommendations.length < 1) {
		throw new ValidationError('Need at least 1 action item or recommendation');
	}

	return obj as BriefingOutput;
}
