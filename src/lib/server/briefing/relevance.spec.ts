import { describe, expect, it } from 'vitest';
import { filterRelevantEvidence, isRelevantEvidence } from './relevance';
import type { EvidenceSource } from './schema';

const request = {
	courseCode: 'CSIS 4495',
	institution: 'Douglas College',
	professorName: 'Ada Lovelace'
};
function source(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
	return {
		id: 's1',
		category: 'catalog',
		title: 'CSIS 4495 Applied Research Project',
		url: 'https://www.douglascollege.ca/course/csis-4495',
		canonicalUrl: 'https://www.douglascollege.ca/course/csis-4495',
		domain: 'www.douglascollege.ca',
		publisher: 'Douglas College',
		excerpt: 'CSIS 4495 details',
		sourceType: 'official',
		publishedAt: null,
		updatedAt: null,
		retrievedAt: '2026-01-01',
		currentness: 'current',
		retrievalStatus: 'retrieved',
		contentFingerprint: 'f',
		claimsSupported: [],
		...overrides
	};
}

describe('deterministic source relevance', () => {
	it('admits an exact official course page for course identity', () => {
		expect(isRelevantEvidence(source(), request, 'course_identity')).toBe(true);
	});

	it('rejects unrelated course and generic program evidence', () => {
		const unrelated = source({ title: 'CSIS 1175 Introduction', excerpt: 'CSIS 1175 details' });
		const generic = source({
			title: 'Computing programs',
			excerpt: 'Explore our programs',
			url: 'https://www.douglascollege.ca/programs'
		});
		expect(filterRelevantEvidence([unrelated, generic], request, 'course_identity')).toEqual([]);
	});

	it('does not let RMP evidence establish an offering', () => {
		const rmp = source({
			category: 'rate-my-professors',
			sourceType: 'rmp',
			domain: 'www.ratemyprofessors.com',
			url: 'https://www.ratemyprofessors.com/professor/1'
		});
		expect(isRelevantEvidence(rmp, request, 'current_offering')).toBe(false);
		expect(isRelevantEvidence(rmp, request, 'rmp_profile')).toBe(false);
	});
});
