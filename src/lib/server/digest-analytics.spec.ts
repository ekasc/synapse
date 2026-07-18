import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock('$env/dynamic/private', () => ({
	env: { OPENROUTER_API_KEY: 'test-key', OPENROUTER_MODEL: 'test-model' }
}));
vi.mock('./syllabus-parser', () => ({
	extractTextFromPdf: vi.fn().mockResolvedValue('official transcript text')
}));
vi.mock('openai', () => ({
	default: class {
		chat = { completions: { create: createCompletion } };
	}
}));

import { analyzeTranscriptFile } from './digest-analytics';

describe('transcript analytics', () => {
	beforeEach(() => vi.clearAllMocks());

	it('uses official transcript totals and letter grades', async () => {
		createCompletion.mockResolvedValue({
			choices: [
				{
					message: {
						content: JSON.stringify({
							courses: [
								{
									code: 'CSIS 4495',
									name: 'Applied Research Project',
									term: 'Summer 2026',
									credits: 3,
									currentPercent: 0,
									projectedPercent: 0,
									status: 'current',
									letter: ''
								},
								{
									code: 'BUSN 3431',
									name: 'Business Statistics II',
									term: 'Winter 2025',
									credits: 3,
									currentPercent: 0,
									projectedPercent: 0,
									status: 'finished',
									letter: 'A+'
								}
							],
							insights: [],
							cumulativeGpa: 3.24,
							earnedCredits: 54
						})
					}
				}
			]
		});

		const analysis = await analyzeTranscriptFile(
			new File(['pdf'], 'transcript.pdf', { type: 'application/pdf' }),
			[],
			[]
		);

		expect(analysis.totalGpa).toBe(3.24);
		expect(analysis.finishedCredits).toBe(54);
		expect(analysis.courses[1]).toMatchObject({
			letter: 'A+',
			currentPercent: 97,
			projectedPercent: 97
		});
	});
});
