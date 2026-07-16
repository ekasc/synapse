import { describe, expect, it } from 'vitest';
import {
	DEFAULT_COST_CEILING_MICRODOLLARS,
	dollarsToMicrodollars,
	estimateCostMicrodollars
} from './cost';
import {
	FLASH_SEARCH_MODEL,
	PRO_SYNTHESIS_MODEL,
	rejectClientModelFields,
	resolveResearchModelPolicy
} from './policy';

describe('course research model and cost policy', () => {
	it('uses integer microdollars for the published DeepSeek and Exa prices', () => {
		expect(estimateCostMicrodollars(FLASH_SEARCH_MODEL, 25_000, 3_000, 5)).toBe(27_387);
		expect(estimateCostMicrodollars(PRO_SYNTHESIS_MODEL, 25_000, 3_000, 5)).toBe(68_152);
		expect(DEFAULT_COST_CEILING_MICRODOLLARS).toBe(100_000);
	});

	it('rejects client model selection while leaving provider recovery to OpenRouter', () => {
		expect(() => rejectClientModelFields({ model: 'openrouter/auto' })).toThrow(
			'MODEL_SELECTION_NOT_ALLOWED'
		);
		expect(resolveResearchModelPolicy({ COURSE_RESEARCH_SEARCH_PROVIDER: 'auto' })).toMatchObject({
			search: FLASH_SEARCH_MODEL,
			synthesis: PRO_SYNTHESIS_MODEL
		});
	});
	it('converts authoritative decimal costs at rounding boundaries without float multiplication', () => {
		expect(dollarsToMicrodollars('0.0000004')).toBe(0);
		expect(dollarsToMicrodollars('0.0000005')).toBe(1);
		expect(dollarsToMicrodollars('1.2345678')).toBe(1_234_568);
	});
});
