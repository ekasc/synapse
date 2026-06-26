import { describe, expect, it } from 'vitest';
import {
	COURSE_BRIEFING_SYSTEM_PROMPT,
	COURSE_BRIEFING_WEB_TOOL,
	buildCourseBriefingUserPrompt
} from './prompt';

describe('course briefing prompt', () => {
	it('preserves supplied professor context and requires targeted professor searches', () => {
		const prompt = buildCourseBriefingUserPrompt({
			courseCode: 'CSIS 3560',
			professorName: 'Gabriel Vitus',
			institution: 'Douglas College'
		});

		expect(prompt).toContain('Course code: CSIS 3560');
		expect(prompt).toContain('Institution: Douglas College');
		expect(prompt).toContain('Professor: Gabriel Vitus');
		expect(prompt).toContain('"CSIS 3560" "Douglas College"');
		expect(prompt).toContain('site:douglascollege.ca "CSIS 3560"');
		expect(prompt).toContain('"Gabriel Vitus" "Douglas College"');
		expect(prompt).toContain('"Gabriel Vitus" "CSIS 3560"');
		expect(prompt).toContain('"Gabriel Vitus" "Rate My Professors"');
		expect(prompt).toContain('Exact professor/course/institution search');
		expect(prompt).toContain('did you preserve the supplied name');
		expect(prompt).toContain('found=false entries for required professor/RMP attempts');
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain('Minimum effort gate');
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Do not finalize after only finding the official course catalog page'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Treat URLs containing old term codes or dated paths'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Do not use historical pages older than 24 months'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Professor Name (provided, not verified for this course)'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Treat those snippets as search results, not as user-provided context'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain('do not claim you lack live search');
	});

	it('uses a larger web search result set for course research', () => {
		expect(COURSE_BRIEFING_WEB_TOOL).toMatchObject({
			type: 'openrouter:web_search',
			parameters: {
				engine: 'exa',
				max_results: 10,
				max_total_results: 30,
				search_context_size: 'medium',
				excluded_domains: ['cliffsnotes.com']
			}
		});
	});
});
