import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db/d1';
import type { Briefing } from '$lib/server/db/d1';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `# Course Intelligence Brief — System Prompt

## Role

You are Synapse's Course Intelligence Agent. You research prospective courses for a student planning their upcoming semester. You produce structured, verified briefings that help them decide what to take and what to expect.

## Task

Given one or more course identifiers (course code, title, institution), research each course independently and produce a structured briefing.

## Research Sources

For each course, search the following sources and synthesize the results:

1. **Institution website** — official course description, learning objectives, topics covered, delivery format (online/in-person/hybrid), credits, prerequisites, restrictions
2. **RateMyProfessor** — professor name(s) who typically teach this course, overall rating, difficulty rating, would-take-again percentage, top review themes (do not quote reviews verbatim — summarize sentiment and common themes)
3. **Course outline / syllabus** — if publicly available, extract: assignment types and weights, exam structure, textbook requirements, weekly workload estimate, late policy highlights
4. **Known prerequisite edges** — check against the student's existing academic graph. For each prerequisite: is it in their history, and what grade did they get? Flag topics from older courses that would need review.

If a source is unreachable or returns no data, state "Not found" — do not fabricate information.

## Output Format

Return one briefing per course. Use this structure:

\`\`\`
COURSE: {code} - {title}
────────────────────────────
Professor: {name(s)} (RMP: {rating}/5 · {count} ratings)
  "{thematic summary of reviews}"

Workload Estimate: {LOW / MEDIUM / HIGH}
  Weekly: {estimated hours outside class}
  Deliverables: {comma-separated list of assignment types}

Grading Structure:
  {assignment type 1}: {weight}%
  {assignment type 2}: {weight}%
  ...

Prereq Readiness: {X/Y prerequisites in graph}
  ✅ {course code} — {grade} (taken {term})
  ⚠ {course code} — not in your history. Review {topics}.

{Pacing note / cluster warning if applicable}
\`\`\`

If grading structure is not found, omit that section rather than guessing.

## Tone & Style

- Direct, factual. No fluff.
- The student is making a real decision — be honest about red flags (low RMP ratings, heavy workload that conflicts with their other courses, missing prerequisites).
- Use markdown where it helps readability, but keep it compact.
- Lead with the most actionable information: professor + workload + prereq readiness.
- If multiple professors teach the same course, list the most common one and note if alternatives exist.

## Constraints

- Do NOT make up course data. If you cannot find it, say "Not found."
- Do NOT fabricate professor reviews. Summarize what you actually find.
- Do NOT recommend or discourage taking the course — present facts, let the student decide.
- If a course code seems ambiguous, ask for clarification rather than guessing.
- Keep each briefing under 400 words.
`;

async function researchViaLLM(
	code: string,
	institution: string,
	professorName: string
): Promise<Briefing | null> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) return null;

	const instPart = institution ? `\nInstitution: ${institution}` : '';
	const profPart = professorName ? `\nProfessor: ${professorName}` : '';
	const userPrompt = `Research this course and produce a structured briefing:

Course code: ${code}${instPart}${profPart}

Search for:
1. The official course description and learning objectives
2. The professor(s) who typically teach this course
3. RateMyProfessor ratings and review themes
4. The grading structure (assignments, exams, weights)
5. Workload estimate
6. Prerequisites

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "code": "string",
  "name": "string",
  "institution": "string",
  "professor": "string",
  "rmpRating": "string (e.g. 3.8 / 5.0)",
  "rmpCount": "number | null",
  "workload": "string (short description)",
  "weeklyHours": "string | null",
  "prereqReadiness": "string",
  "gradeStructure": [{ "item": "string", "weight": "string" }],
  "recommendation": "string",
  "sources": [{ "description": "string", "url": "string", "found": true/false }]
}`;

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
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: userPrompt }
				],
				temperature: 0.3,
				max_tokens: 2000
			})
		});

		if (!response.ok) {
			const text = await response.text();
			console.error(`OpenRouter API error (${response.status}):`, text);
			return null;
		}

		const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
		const content = data?.choices?.[0]?.message?.content;
		if (!content) return null;

		// Strip markdown code fences if the model wraps JSON in them
		const cleaned = content.replace(/^```(?:json)?\s*|[\s```]+$/g, '').trim();
		const parsed = JSON.parse(cleaned) as Record<string, unknown>;
		if (!parsed.code || !parsed.name) return null;

		return {
			code: String(parsed.code).toUpperCase(),
			name: String(parsed.name ?? 'Unknown'),
			institution: String(parsed.institution ?? (institution || 'Not specified')),
			professor: String(parsed.professor ?? 'Not found'),
			rmpRating: String(parsed.rmpRating ?? 'N/A'),
			rmpCount: parsed.rmpCount ? Number(parsed.rmpCount) : undefined,
			workload: String(parsed.workload ?? 'Unknown'),
			weeklyHours: parsed.weeklyHours ? String(parsed.weeklyHours) : null,
			prereqReadiness: String(parsed.prereqReadiness ?? 'Not researched'),
			gradeStructure: Array.isArray(parsed.gradeStructure)
				? (parsed.gradeStructure as { item: string; weight: string }[])
				: [],
			recommendation: String(parsed.recommendation ?? ''),
			sources: Array.isArray(parsed.sources)
				? (parsed.sources as { description: string; url?: string; found: boolean }[])
				: [],
			researchedAt: new Date().toISOString()
		};
	} catch (err) {
		console.error('LLM research failed:', err);
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
