import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db/d1';
import type { Briefing } from '$lib/server/db/d1';
import { extractBriefingJson, validateBriefing } from '$lib/server/briefing/validation';
import {
	COURSE_BRIEFING_SYSTEM_PROMPT,
	COURSE_BRIEFING_WEB_TOOL,
	buildCourseBriefingUserPrompt
} from '$lib/server/briefing/prompt';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function researchViaLLM(
	code: string,
	institution: string,
	professorName: string
): Promise<Briefing | null> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) return null;

	const userPrompt = buildCourseBriefingUserPrompt({
		courseCode: code,
		professorName,
		institution
	});

	try {
		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://synapse.app',
				'X-Title': 'Synapse Course Brief'
			},
			body: JSON.stringify({
				model: env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash',
				tools: [COURSE_BRIEFING_WEB_TOOL],
				messages: [
					{ role: 'system', content: COURSE_BRIEFING_SYSTEM_PROMPT },
					{ role: 'user', content: userPrompt }
				],
				temperature: 0.1,
				max_tokens: 3000
			})
		});

		if (!response.ok) {
			// Log only the status to avoid leaking provider error payloads (which can
			// include echoed request details) into application/transport logs.
			console.error(`OpenRouter API error: status ${response.status}`);
			await response.text().catch(() => undefined);
			return null;
		}

		const data = (await response.json()) as {
			choices?: { message?: { content?: string; reasoning?: string } }[];
		};
		const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.message?.reasoning;
		if (!text) return null;
		return validateBriefing(JSON.parse(extractBriefingJson(text)));
	} catch (err) {
		console.error('LLM research failed:', err instanceof Error ? err.message : err);
		return null;
	}
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) {
		return json({ error: 'Cloudflare platform not available' }, { status: 500 });
	}

	const body = (await request.json()) as {
		code: string;
		institution?: string;
		professorName?: string;
	};
	const code = body.code;
	const institution = body.institution ?? '';
	const professorName = body.professorName ?? '';

	if (!code || typeof code !== 'string') {
		return json({ error: 'Course code is required' }, { status: 400 });
	}

	const normalizedCode = code.trim().toUpperCase();
	const normalizedInst = institution.trim();
	const normalizedProf = professorName.trim();

	const db = createDb(platform.env.BRIEF_DB);

	const cached = await db.getBrief(normalizedCode);
	if (cached) {
		return json({ brief: cached, cached: true });
	}

	const llmResult = await researchViaLLM(normalizedCode, normalizedInst, normalizedProf);
	if (llmResult) {
		await db.saveBrief(llmResult);
		return json({ brief: llmResult, cached: false, source: 'llm' });
	}

	return json({
		brief: null,
		error: 'Course not found',
		hint: 'Configure OPENROUTER_API_KEY in .env for live research'
	});
}

export async function DELETE({ url, platform }: RequestEvent) {
	if (!platform) {
		return json({ error: 'Cloudflare platform not available' }, { status: 500 });
	}
	const code = url.searchParams.get('code');
	if (!code) {
		return json({ error: 'Course code is required' }, { status: 400 });
	}
	const db = createDb(platform.env.BRIEF_DB);
	await db.deleteBrief(code.trim().toUpperCase());
	return json({ deleted: true });
}
