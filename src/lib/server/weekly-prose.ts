import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { WeeklyDigest } from '$lib/dashboard/weekly';

/**
 * Optional prose layer for the Weekly Planning Digest.
 *
 * The deterministic digest from `buildWeeklyDigest` is the source of truth.
 * This module only rewrites that structured data into two or three sentences.
 * It never calculates scores, dates, grades, risk, or ordering, and the page
 * renders the full structured digest when no API key is configured or the
 * call fails (returns null).
 */

export type WeeklyProse = { prose: string; model: string };

const WEEKLY_PROSE_SYSTEM_PROMPT = [
	'You turn the provided weekly plan JSON into a short plain-English summary of two or three sentences.',
	'Rules: preserve every date, course code, weight, and count exactly as given.',
	'Do not add claims, advice, grades, risk levels, or ordering that the JSON does not contain.',
	'Do not calculate, estimate, or infer anything.',
	'If the plan is empty, say there is nothing that needs attention.',
	'Write in a calm field-notebook tone. No headings, no bullet points.'
].join(' ');

export async function composeWeeklyProse(
	digest: WeeklyDigest,
	options: { apiKey?: string; model?: string } = {}
): Promise<WeeklyProse | null> {
	const apiKey = options.apiKey ?? env.OPENROUTER_API_KEY;
	if (!apiKey) return null;
	const model = options.model || env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
	try {
		const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey });
		const response = await client.chat.completions.create({
			model,
			max_tokens: 400,
			temperature: 0.2,
			messages: [
				{ role: 'system', content: WEEKLY_PROSE_SYSTEM_PROMPT },
				{ role: 'user', content: JSON.stringify(digest) }
			]
		});
		const prose = response.choices[0]?.message?.content?.trim();
		return prose ? { prose, model } : null;
	} catch {
		return null;
	}
}
