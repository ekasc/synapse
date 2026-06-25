import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getBrief, saveBrief, type Briefing } from '$lib/server/store';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const FALLBACK_BRIEFINGS: Briefing[] = [
	{
		code: 'CSIS 3375',
		name: 'Database Systems',
		institution: 'Douglas College',
		professor: 'Dr. Anil Goel',
		rmpRating: '3.8 / 5.0',
		workload: 'Medium — 1 midterm, 1 final, 4 assignments, 1 group project',
		prereqReadiness: 'CSIS 2100 (Systems Analysis) recommended — strong overlap in data modeling',
		gradeStructure: [
			{ item: 'Midterm', weight: '25%' },
			{ item: 'Final', weight: '30%' },
			{ item: 'Assignments', weight: '20%' },
			{ item: 'Group Project', weight: '25%' }
		],
		recommendation:
			'Take it. Fits Spring 2027 alongside capstone. Moderate workload, Goel is well-organized.',
		sources: [
			{ description: 'Douglas College course catalogue', found: true },
			{ description: 'RateMyProfessor', found: true }
		],
		researchedAt: new Date().toISOString()
	},
	{
		code: 'CSIS 4495',
		name: 'Applied Research Project (Capstone)',
		institution: 'Douglas College',
		professor: 'Dr. Sarah Vitus',
		rmpRating: '4.2 / 5.0',
		workload: 'High — weekly deliverables, team meetings, final presentation + report',
		prereqReadiness: 'All core CSIS courses completed. Ready.',
		gradeStructure: [
			{ item: 'Project Proposal', weight: '10%' },
			{ item: 'Progress Report 1', weight: '15%' },
			{ item: 'Progress Report 2', weight: '15%' },
			{ item: 'Final Presentation', weight: '25%' },
			{ item: 'Final Report', weight: '35%' }
		],
		recommendation: 'Your capstone. Synapse IS this project. Know it well.',
		sources: [
			{ description: 'Douglas College course catalogue', found: true },
			{ description: 'Course syllabus', found: true }
		],
		researchedAt: new Date().toISOString()
	},
	{
		code: 'CSIS 3500',
		name: 'Network Security',
		institution: 'Douglas College',
		professor: 'Dr. Marcus Chen',
		rmpRating: '2.4 / 5.0',
		workload: 'Heavy — weekly labs, 2 midterms, comprehensive final, group pentest project',
		prereqReadiness: 'CSIS 2200 (Networking) required — check your grade; below B- will be rough',
		gradeStructure: [
			{ item: 'Labs', weight: '20%' },
			{ item: 'Midterm 1', weight: '20%' },
			{ item: 'Midterm 2', weight: '20%' },
			{ item: 'Pentest Project', weight: '15%' },
			{ item: 'Final Exam', weight: '25%' }
		],
		recommendation:
			'Skip this semester if you can. Heavy courseload and Chen is known for low averages.',
		sources: [
			{ description: 'Douglas College course catalogue', found: true },
			{ description: 'RateMyProfessor', found: true }
		],
		researchedAt: new Date().toISOString()
	}
];

function loadPromptTemplate(): string {
	try {
		return readFileSync(resolve('course-brief-prompt.md'), 'utf-8');
	} catch {
		return 'You are a course research agent. Given a course code, research it and produce a structured briefing.';
	}
}

async function researchViaLLM(
	code: string,
	institution: string,
	professorName: string
): Promise<Briefing | null> {
	const apiKey = process.env['OPENROUTER_API_KEY'];
	if (!apiKey) return null;

	const systemPrompt = loadPromptTemplate();
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
				model: 'openai/gpt-4o-mini',
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt }
				],
				response_format: { type: 'json_object' },
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

		const parsed = JSON.parse(content) as Record<string, unknown>;
		if (!parsed.code || !parsed.name) return null;

		return {
			code: String(parsed.code).toUpperCase(),
			name: String(parsed.name ?? 'Unknown'),
			institution: String(parsed.institution ?? (institution || 'Not specified')),
			professor: String(parsed.professor ?? 'Not found'),
			rmpRating: String(parsed.rmpRating ?? 'N/A'),
			rmpCount: parsed.rmpCount ? Number(parsed.rmpCount) : undefined,
			workload: String(parsed.workload ?? 'Unknown'),
			weeklyHours: parsed.weeklyHours ? String(parsed.weeklyHours) : undefined,
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

function getMockBrief(code: string, professorName: string): Briefing | undefined {
	const upper = code.toUpperCase();
	const byCode = FALLBACK_BRIEFINGS.find((b) => b.code.toUpperCase() === upper);
	if (byCode) return byCode;
	if (professorName) {
		const lower = professorName.toLowerCase();
		return FALLBACK_BRIEFINGS.find((b) => b.professor.toLowerCase().includes(lower));
	}
	return undefined;
}

export async function POST({ request }: RequestEvent) {
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
	const normalizedProf = professorName.trim();
	const normalizedInst = institution.trim();

	const cached = getBrief(normalizedCode);
	if (cached) {
		return json({ brief: cached, cached: true });
	}

	const llmResult = await researchViaLLM(normalizedCode, normalizedInst, normalizedProf);
	if (llmResult) {
		saveBrief(llmResult);
		return json({ brief: llmResult, cached: false, source: 'llm' });
	}

	const mock = getMockBrief(normalizedCode, normalizedProf);
	if (mock) {
		saveBrief(mock);
		return json({ brief: mock, cached: false, source: 'mock' });
	}

	return json({
		brief: null,
		error: 'Course not found',
		hint: 'Try a different code or add an LLM API key for live research'
	});
}
