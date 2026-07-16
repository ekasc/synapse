import type { BriefingUsage } from './schema';
import { FLASH_SEARCH_MODEL, PRO_SYNTHESIS_MODEL } from './policy';
export type ModelPrice = { inputPerMillion: number; outputPerMillion: number };
export const MODEL_PRICES_MICRODOLLARS: Record<string, ModelPrice> = {
	[FLASH_SEARCH_MODEL]: { inputPerMillion: 77_000, outputPerMillion: 154_000 },
	[PRO_SYNTHESIS_MODEL]: { inputPerMillion: 1_392_000, outputPerMillion: 2_784_000 }
};
export const EXA_SEARCH_COST_MICRODOLLARS = 5_000;
export const DEFAULT_COST_CEILING_MICRODOLLARS = 100_000;
export function estimateCostMicrodollars(
	model: string,
	inputTokens: number,
	outputTokens: number,
	searchRequests = 0
): number {
	const p = MODEL_PRICES_MICRODOLLARS[model];
	if (!p) throw new Error('MODEL_NOT_PRICED');
	return (
		Math.ceil((inputTokens * p.inputPerMillion + outputTokens * p.outputPerMillion) / 1_000_000) +
		searchRequests * EXA_SEARCH_COST_MICRODOLLARS
	);
}
/** Converts a provider's decimal dollar cost without binary floating-point multiplication. */
export function dollarsToMicrodollars(value: unknown): number | null {
	if (typeof value !== 'string' && typeof value !== 'number') return null;
	const text = String(value).trim();
	if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
	const [whole, fraction = ''] = text.split('.');
	const rounded = (fraction + '0000000').slice(0, 7);
	let result = BigInt(whole) * 1_000_000n + BigInt(rounded.slice(0, 6));
	if (Number(rounded[6]) >= 5) result++;
	if (result > BigInt(Number.MAX_SAFE_INTEGER)) return null;
	return Number(result);
}
export function aggregateUsage(parts: BriefingUsage[]): BriefingUsage {
	return parts.reduce(
		(t, p) => ({
			inputTokens: t.inputTokens + p.inputTokens,
			outputTokens: t.outputTokens + p.outputTokens,
			reasoningTokens: t.reasoningTokens + p.reasoningTokens,
			cachedTokens: t.cachedTokens + p.cachedTokens,
			searchRequests: t.searchRequests + p.searchRequests,
			costMicrodollars: t.costMicrodollars + p.costMicrodollars
		}),
		{
			inputTokens: 0,
			outputTokens: 0,
			reasoningTokens: 0,
			cachedTokens: 0,
			searchRequests: 0,
			costMicrodollars: 0
		}
	);
}
export function assertWithinBudget(
	usage: BriefingUsage,
	ceiling = DEFAULT_COST_CEILING_MICRODOLLARS
) {
	if (!Number.isInteger(ceiling) || ceiling < 0 || usage.costMicrodollars > ceiling)
		throw new Error('COST_BUDGET_EXCEEDED');
}
