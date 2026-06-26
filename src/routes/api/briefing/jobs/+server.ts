import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createBriefingRunner } from '$lib/server/briefing/runner';
import { createDb } from '$lib/server/db/d1';
import { env } from '$env/dynamic/private';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type JobFrozen = { courseCode: string; professorName?: string | null; institution?: string | null };

async function processJob(binding: D1Database, jobId: string, courseCode: string) {
	const runner = createBriefingRunner(binding);
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) {
		await runner.failJob(jobId, 'NO_API_KEY', 'OpenRouter API key not configured');
		return;
	}

	try {
		const job = await runner.getJob(jobId);
		if (!job) return;

		const jobFrozen: JobFrozen = JSON.parse(job.frozenContext);

		const cached = await runner.getCachedOutput(job.cacheKey);
		if (cached) {
			await runner.completeJob(jobId, cached);
			return;
		}

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
					{
						role: 'system',
						content: `# Course Intelligence Brief — System Prompt

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


IMPORTANT: Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{{
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
}}`
					},
					{
						role: 'user',
						content: `Research this course and produce a structured briefing:

Course code: ${courseCode}${jobFrozen.professorName ? `\nProfessor: ${jobFrozen.professorName}` : ''}${jobFrozen.institution ? `\nInstitution: ${jobFrozen.institution}` : ''}

Search for:
1. Course description
2. Professor info
3. RMP ratings
4. Grading structure
5. Workload
6. Prerequisites`
					}
				],
				temperature: 0.3,
				max_tokens: 2000
			})
		});

		if (!response.ok) {
			const text = await response.text();
			console.error(`OpenRouter error (${response.status}):`, text);
			await runner.failJob(jobId, 'LLM_ERROR', `OpenRouter returned ${response.status}`);
			return;
		}

		const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
		const content = data?.choices?.[0]?.message?.content;
		if (!content) {
			await runner.failJob(jobId, 'EMPTY_RESPONSE', 'LLM returned empty response');
			return;
		}

		const cleaned = content.replace(/^```(?:json)?\s*|[\s```]+$/g, '').trim();

		const parsed = JSON.parse(cleaned);
		if (!parsed.code || !parsed.name) {
			await runner.failJob(jobId, 'VALIDATION_FAILED', 'Output missing required fields');
			return;
		}

		await runner.setCachedOutput(job.cacheKey, content);
		await runner.completeJob(jobId, content);

		// Save to briefings table for page load
		try {
			const db = createDb(binding);
			await db.saveBrief({
				code: String(parsed.code),
				name: String(parsed.name ?? 'Unknown'),
				institution: String(parsed.institution ?? courseCode),
				professor: String(parsed.professor ?? 'Not found'),
				rmpRating: String(parsed.rmpRating ?? 'N/A'),
				rmpCount: parsed.rmpCount ? Number(parsed.rmpCount) : undefined,
				workload: String(parsed.workload ?? 'Unknown'),
				weeklyHours: parsed.weeklyHours ? String(parsed.weeklyHours) : null,
				prereqReadiness: String(parsed.prereqReadiness ?? ''),
				gradeStructure: Array.isArray(parsed.gradeStructure)
					? parsed.gradeStructure.map((g: { item: string; weight: string }) => ({ item: g.item, weight: g.weight }))
					: [],
				recommendation: String(parsed.recommendation ?? ''),
				sources: Array.isArray(parsed.sources)
					? parsed.sources.map((s: { description: string; url?: string; found: boolean }) => ({
						description: s.description, url: s.url, found: s.found
					}))
					: [],
				researchedAt: new Date().toISOString()
			});
		} catch (e) {
			console.error('Failed to save brief to table:', e);
		}
	} catch (err) {
		console.error('Job processing failed:', err);
		await runner.failJob(jobId, 'PROCESSING_ERROR', String(err));
	}
}

export async function GET({ url, platform }: RequestEvent) {
	if (!platform) return json({ jobs: [] });
	const courseCode = url.searchParams.get('courseCode');
	if (!courseCode) return json({ jobs: [] });

	const runner = createBriefingRunner(platform.env.BRIEF_DB);
	const jobs = await runner.getJobs(courseCode);
	return json({ jobs });
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) {
		return json({ error: 'Platform not available' }, { status: 500 });
	}

	const body = (await request.json()) as { courseCode: string; professorName?: string; institution?: string };
	const courseCode = body.courseCode?.trim().toUpperCase();
	if (!courseCode) {
		return json({ error: 'Course code required' }, { status: 400 });
	}

	const professorName = body.professorName?.trim() || undefined;
	const institution = body.institution?.trim() || undefined;

	const runner = createBriefingRunner(platform.env.BRIEF_DB);

	const jobs = await runner.getJobs(courseCode);
	// If there's an active job, poll that instead of creating a new one
	const activeJob = jobs.find((j) => j.status === 'queued' || j.status === 'running');
	if (activeJob) return json({ job: activeJob });

	const job = await runner.createJob({ courseCode, professorName, institution });

	// Fire job processing — in production, waitUntil keeps the Worker alive.
	// In dev (pnpm dev), unawaited promises still complete because Node.js stays alive.
	const promise = processJob(platform.env.BRIEF_DB, job.id, courseCode);
	if (typeof platform.ctx?.waitUntil === 'function') {
		platform.ctx.waitUntil(promise);
	}

	return json({ job });
}
