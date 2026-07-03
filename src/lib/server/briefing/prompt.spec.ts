import { describe, expect, it } from 'vitest';
import {
	COURSE_BRIEFING_SYSTEM_PROMPT,
	COURSE_BRIEFING_WEB_PLUGIN,
	buildCourseBriefingUserPrompt
} from './prompt';

describe('course briefing prompt', () => {
	it('preserves supplied professor context and requires targeted professor searches', () => {
		const prompt = buildCourseBriefingUserPrompt({
			courseCode: 'CSIS 3560',
			courseName: 'Systems Analysis and Design',
			professorName: 'Gabriel Vitus',
			institution: 'Douglas College',
			additionalNotes: 'Looking for the Winter online section.'
		});

		expect(prompt).toContain('Course code: CSIS 3560');
		expect(prompt).toContain('Course name hint: Systems Analysis and Design');
		expect(prompt).toContain('Institution: Douglas College');
		expect(prompt).toContain('Professor: Gabriel Vitus');
		expect(prompt).toContain('Additional notes from user: Looking for the Winter online section.');
		expect(prompt).toContain('"CSIS 3560" "Douglas College"');
		expect(prompt).toContain('"CSIS 3560" "Systems Analysis and Design" "Douglas College"');
		expect(prompt).toContain('"CSIS 3560" "Douglas College" official course page OR catalog');
		expect(prompt).toContain('site:douglascollege.ca "CSIS 3560"');
		expect(prompt).toContain('site:douglascollege.ca/course "CSIS 3560"');
		expect(prompt).toContain('https://www.douglascollege.ca/course/csis-3560');
		expect(prompt).toContain('"Gabriel Vitus" "Douglas College"');
		expect(prompt).toContain('"Gabriel Vitus" "CSIS 3560"');
		expect(prompt).toContain('"Gabriel Vitus" "Rate My Professors"');
		expect(prompt).toContain('Use each numbered search target separately');
		expect(prompt).toContain(
			'course name hint and additional notes to improve search targeting only'
		);
		expect(prompt).toContain('without treating them as evidence');
		expect(prompt).toContain('did you actually attempt the matching exact search target');
		expect(prompt).toContain('Exact professor/course/institution search');
		expect(prompt).toContain('did you preserve the supplied name');
		expect(prompt).toContain('found=false entries for required professor/RMP attempts');
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain('Minimum effort gate');
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Do not finalize after only finding the official course catalog page'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Do not finalize after only finding a course list page'
		);
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain(
			'Do not conclude "not found" merely because one search result page omitted the fact'
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
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain('search hints, not evidence');
		expect(COURSE_BRIEFING_SYSTEM_PROMPT).toContain('do not claim you lack live search');
	});

	it('enables OpenRouter web search for course research', () => {
		expect(COURSE_BRIEFING_WEB_PLUGIN).toMatchObject({ id: 'web' });
	});
});
