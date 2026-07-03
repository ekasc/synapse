import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db/d1';
import type { Briefing } from '$lib/server/briefing/schema';
import { researchBriefing } from '$lib/server/briefing/request';
import {
	COURSE_BRIEFING_SYSTEM_PROMPT,
	buildCourseBriefingUserPrompt
} from '$lib/server/briefing/prompt';

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

type BriefPostBody = {
	code: string;
	courseName?: string;
	institution?: string;
	professorName?: string;
	additionalNotes?: string;
	model?: string;
};

function resolveModel(model: string | undefined): string {
	const envModel = env.OPENROUTER_MODEL?.trim();
	return model?.trim() || envModel || DEFAULT_MODEL;
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) {
		return json({ error: 'Cloudflare platform not available' }, { status: 500 });
	}

	const body = (await request.json()) as BriefPostBody;
	const code = body.code;
	const courseName = body.courseName ?? '';
	const institution = body.institution ?? '';
	const professorName = body.professorName ?? '';
	const additionalNotes = body.additionalNotes ?? '';

	if (!code || typeof code !== 'string') {
		return json({ error: 'Course code is required' }, { status: 400 });
	}

	const normalizedCode = code.trim().toUpperCase();
	const normalizedCourseName = courseName.trim().slice(0, 500);
	const normalizedInst = institution.trim();
	const normalizedProf = professorName.trim();
	const normalizedNotes = additionalNotes.trim().slice(0, 1200);
	const model = resolveModel(body.model);

	const db = createDb(platform.env.BRIEF_DB);

	const cached = await db.getBrief(normalizedCode);
	if (cached) {
		return json({ brief: cached, cached: true });
	}

	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return json({
			brief: null,
			error: 'Course not found',
			hint: 'Configure OPENROUTER_API_KEY in .env for live research'
		});
	}

	const messages = [
		{ role: 'system' as const, content: COURSE_BRIEFING_SYSTEM_PROMPT },
		{
			role: 'user' as const,
			content: buildCourseBriefingUserPrompt({
				courseCode: normalizedCode,
				courseName: normalizedCourseName,
				professorName: normalizedProf,
				institution: normalizedInst,
				additionalNotes: normalizedNotes
			})
		}
	];

	try {
		const result = await researchBriefing({ apiKey, model, messages });
		const briefing: Briefing = result.briefing;
		await db.saveBrief(briefing);
		return json({ brief: briefing, cached: false, source: 'llm' });
	} catch {
		return json({
			brief: null,
			error: 'Course not found',
			hint: 'Briefing research failed'
		});
	}
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
