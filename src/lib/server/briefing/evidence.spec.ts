import { describe, expect, it } from 'vitest';
import { buildEvidenceBundle, canonicalizeHttpUrl, makeEvidenceSources } from './evidence';
import { evidenceCategories, normalizeBriefingRequest } from './normalize';
import { rejectClientModelFields } from './policy';

describe('evidence-first briefing invariants', () => {
	it('normalizes requests and assigns deterministic categories', () => {
		const request = normalizeBriefingRequest({
			courseCode: ' csis   3375 ',
			professorName: ' Ada '
		});
		expect(request.courseCode).toBe('CSIS 3375');
		expect(evidenceCategories(request)).toEqual([
			'catalog',
			'prerequisites',
			'outline',
			'schedule',
			'professor-course',
			'professor-profile',
			'rate-my-professors'
		]);
	});

	it('rejects every client model selector', () => {
		expect(() => rejectClientModelFields({ courseCode: 'CSIS 3375', model: 'free' })).toThrow(
			'MODEL_SELECTION_NOT_ALLOWED'
		);
	});

	it('canonicalizes safe URLs and rejects unsafe schemes', () => {
		expect(canonicalizeHttpUrl('HTTPS://Example.edu/a/?utm_source=x#frag')).toBe(
			'https://example.edu/a'
		);
		expect(canonicalizeHttpUrl('javascript:alert(1)')).toBeNull();
		expect(canonicalizeHttpUrl('https://user:pass@example.edu/a')).toBeNull();
	});

	it('reserves synthesis space for schedule and RMP when official pages repeat across categories', () => {
		const request = normalizeBriefingRequest({
			courseCode: 'CSIS 4280',
			institution: 'Douglas College',
			professorName: 'Xing Liu'
		});
		const officialUrl = 'https://www.douglascollege.ca/course/csis-4280';
		const longPage = `${'Course description and learning outcomes. '.repeat(90)} CRN 24750. Instructor Xing Liu. Summer 2026. Means of assessment: labs 10%, project 25%, midterm 30%, final 35%. Prerequisites: CSIS 1280 and CSIS 3175.`;
		const source = (category: Parameters<typeof makeEvidenceSources>[0]) =>
			makeEvidenceSources(
				category,
				[{ title: 'CSIS 4280', url: officialUrl, excerpt: longPage }],
				[officialUrl],
				request,
				'2026-07-16T00:00:00.000Z'
			);
		const rmpUrl = 'https://www.ratemyprofessors.com/professor/2337757';
		const rmp = makeEvidenceSources(
			'rate-my-professors',
			[
				{
					title: 'Liu Xing at Douglas College',
					url: rmpUrl,
					excerpt: `${'Student review. '.repeat(200)} Overall Quality based on 20 ratings. 65% would take again.`
				}
			],
			[rmpUrl],
			request,
			'2026-07-16T00:00:00.000Z'
		);
		const bundle = buildEvidenceBundle(
			request,
			{
				catalog: source('catalog'),
				outline: source('outline'),
				prerequisites: source('prerequisites'),
				schedule: source('schedule'),
				'professor-course': source('professor-course'),
				'rate-my-professors': rmp
			},
			{ inputTokens: 1, outputTokens: 1, searchRequests: 1, costMicrodollars: 1 }
		);
		expect(bundle.sources.map((entry) => entry.category)).toEqual([
			'catalog',
			'outline',
			'prerequisites',
			'schedule',
			'professor-course',
			'rate-my-professors'
		]);
		expect(
			bundle.sources.reduce((total, entry) => total + entry.excerpt.length, 0)
		).toBeLessThanOrEqual(18_000);
		expect(bundle.missingCategories).not.toContain('schedule');
		expect(bundle.missingCategories).not.toContain('rate-my-professors');
	});

	it('accepts only URLs present in url_citation annotations and assigns server IDs', () => {
		const request = normalizeBriefingRequest({
			courseCode: 'CSIS 3375',
			institution: 'Example University'
		});
		const sources = makeEvidenceSources(
			'catalog',
			[
				{ title: 'Official', url: 'https://example.edu/course#x', excerpt: 'Course details' },
				{ title: 'Invented', url: 'https://evil.test/course', excerpt: 'No citation' }
			],
			['https://example.edu/course'],
			request,
			'2026-07-13T00:00:00.000Z'
		);
		const bundle = buildEvidenceBundle(
			request,
			{ catalog: sources },
			{ inputTokens: 1, outputTokens: 1, searchRequests: 1, costMicrodollars: 1 }
		);
		expect(bundle.sources).toHaveLength(1);
		expect(bundle.sources[0].id).toBe('src_01');
		expect(bundle.sources[0].url).toBe('https://example.edu/course');
	});
});
