import { describe, expect, it } from 'vitest';
import { matchRmpProfile } from './rmp';

describe('RMP identity matching', () => {
	const base = {
		profileUrl: 'https://www.ratemyprofessors.com/professor/1',
		displayedName: 'Ada Lovelace',
		institution: 'Example University',
		department: 'Computing',
		overallRating: 4.2,
		ratingCount: 18,
		wouldTakeAgainPercent: 80,
		difficulty: 2.8,
		themes: ['Helpful']
	};

	it('matches exact public name, institution, and requested department', () => {
		expect(
			matchRmpProfile({
				professorName: 'Ada Lovelace',
				institution: 'Example University',
				department: 'Computing',
				candidates: [base]
			})
		).toMatchObject({ status: 'matched', profile: { displayedName: 'Ada Lovelace' } });
	});

	it('returns unavailable for ambiguous profiles rather than picking one', () => {
		expect(
			matchRmpProfile({
				professorName: 'Ada Lovelace',
				institution: 'Example University',
				candidates: [base, { ...base, profileUrl: 'https://www.ratemyprofessors.com/professor/2' }]
			})
		).toEqual({ status: 'unavailable', reason: 'ambiguous' });
	});
});
