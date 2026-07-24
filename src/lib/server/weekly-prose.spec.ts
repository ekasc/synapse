import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock('$env/dynamic/private', () => ({
	env: { OPENROUTER_API_KEY: '', OPENROUTER_MODEL: '' }
}));

vi.mock('openai', () => ({
	default: class {
		chat = { completions: { create: createCompletion } };
	}
}));

import { composeWeeklyProse } from './weekly-prose';
import { buildWeeklyDigest, type WeeklyDigestInput } from '$lib/dashboard/weekly';

const digestInput: WeeklyDigestInput = {
	now: new Date(2026, 6, 20, 9, 0, 0),
	courses: [],
	semesters: [],
	courseGraph: { edges: [] },
	calendarEvents: [],
	practiceSessions: [],
	studySessions: [],
	materials: [],
	materialIndexes: [],
	briefings: []
};

describe('composeWeeklyProse', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns null when no API key is configured', async () => {
		expect(await composeWeeklyProse(buildWeeklyDigest(digestInput))).toBeNull();
		expect(createCompletion).not.toHaveBeenCalled();
	});

	it('hands the deterministic digest to the model verbatim and returns the prose', async () => {
		const digest = buildWeeklyDigest(digestInput);
		createCompletion.mockResolvedValue({
			choices: [{ message: { content: '  Nothing needs attention this week.  ' } }]
		});
		const result = await composeWeeklyProse(digest, {
			apiKey: 'test-key',
			model: 'test-model'
		});
		expect(result).toEqual({ prose: 'Nothing needs attention this week.', model: 'test-model' });
		expect(createCompletion).toHaveBeenCalledOnce();
		const request = createCompletion.mock.calls[0][0];
		expect(request.model).toBe('test-model');
		expect(request.messages[1]).toEqual({ role: 'user', content: JSON.stringify(digest) });
		expect(request.messages[0].content).toContain('Do not calculate');
	});

	it('returns null when the model call fails', async () => {
		createCompletion.mockRejectedValue(new Error('upstream failure'));
		const result = await composeWeeklyProse(buildWeeklyDigest(digestInput), {
			apiKey: 'test-key'
		});
		expect(result).toBeNull();
	});

	it('returns null when the model returns empty content', async () => {
		createCompletion.mockResolvedValue({ choices: [{ message: { content: '   ' } }] });
		const result = await composeWeeklyProse(buildWeeklyDigest(digestInput), {
			apiKey: 'test-key'
		});
		expect(result).toBeNull();
	});
});
