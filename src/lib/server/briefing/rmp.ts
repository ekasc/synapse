export type RmpCandidate = {
	profileUrl: string;
	displayedName: string;
	institution: string;
	department: string | null;
	overallRating: number | null;
	ratingCount: number | null;
	wouldTakeAgainPercent: number | null;
	difficulty: number | null;
	themes: string[];
};

export type RmpMatch =
	| { status: 'matched'; profile: RmpCandidate }
	| { status: 'unavailable'; reason: 'none' | 'ambiguous' };

function normalized(value: string | null | undefined): string {
	return (value ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Exact public-profile match only. A tie is intentionally unavailable. */
export function matchRmpProfile(input: {
	professorName: string;
	institution: string;
	department?: string;
	candidates: RmpCandidate[];
}): RmpMatch {
	const professor = normalized(input.professorName);
	const institution = normalized(input.institution);
	const department = normalized(input.department);
	const matches = input.candidates.filter(
		(candidate) =>
			normalized(candidate.displayedName) === professor &&
			normalized(candidate.institution) === institution &&
			(!department || normalized(candidate.department) === department)
	);
	if (matches.length === 1) return { status: 'matched', profile: matches[0] };
	return { status: 'unavailable', reason: matches.length ? 'ambiguous' : 'none' };
}

export function rmpProfileExcerpt(profile: RmpCandidate): string {
	const fields = [
		`Profile: ${profile.displayedName}`,
		`Institution: ${profile.institution}`,
		profile.department ? `Department: ${profile.department}` : null,
		profile.overallRating != null ? `Rating: ${profile.overallRating}/5` : null,
		profile.ratingCount != null ? `Ratings: ${profile.ratingCount}` : null,
		profile.wouldTakeAgainPercent != null
			? `Would take again: ${profile.wouldTakeAgainPercent}%`
			: null,
		profile.difficulty != null ? `Difficulty: ${profile.difficulty}/5` : null,
		profile.themes.length ? `Themes: ${profile.themes.join(', ')}` : null
	].filter(Boolean);
	return fields.join('. ');
}
