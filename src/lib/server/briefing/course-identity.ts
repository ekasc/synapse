/**
 * Course identity resolution — canonical title extraction, source selection,
 * and deterministic identity evaluation.
 * Extracted from accuracy-gate.ts — keep in sync with the facade re-exports.
 */

import type { BriefingRequest, EvidenceSource } from './schema';
import { resolveInstitution, matchInstitutionDomain, REGISTERED_INSTITUTIONS } from './institution';
import { normalizeCourseCode, courseCodePattern, cleanCanonicalTitle, normalizeCanonicalTitle } from './course-code';
import { classifySource, isSourceAdmissibleFor, extractTermScope } from './source-classification';

export type CourseIdentityFailureCode =
	| 'UNSUPPORTED_INSTITUTION'
	| 'NO_ADMISSIBLE_OFFICIAL_SOURCE'
	| 'EXACT_COURSE_CODE_NOT_FOUND'
	| 'CANONICAL_TITLE_NOT_FOUND'
	| 'CONFLICTING_CANONICAL_TITLES';

export type EvidenceValue<T> = {
	value: T;
	provenance: 'official' | 'user_confirmed' | 'student_reported' | 'inferred' | 'unverified';
	sourceIds: string[];
	term?: string;
};

export type ResolvedCourse = {
	institution: string;
	courseCode: string;
	canonicalTitle: string;
	canonicalUrl: string;
	sourceId: string;
	status: 'verified' | 'ambiguous' | 'not_found';
	candidates: Array<{
		sourceId: string;
		title: string;
		url: string;
		excerpt: string;
	}>;
};

export type CourseIdentityEvaluation =
	| { status: 'verified'; course: ResolvedCourse }
	| {
			status: 'rejected';
			code: CourseIdentityFailureCode;
			candidates: ResolvedCourse['candidates'];
	  };

// ── Internal helpers ──

function resolveRequestedInstitution(
	sources: EvidenceSource[],
	request: BriefingRequest
): ReturnType<typeof resolveInstitution> {
	if (request.institution) return resolveInstitution(request.institution);
	const inferred = new Map<string, ReturnType<typeof resolveInstitution>>();
	for (const source of sources) {
		if (source.sourceType !== 'official') continue;
		const institution = matchInstitutionDomain(source.domain);
		if (institution) inferred.set(institution.domain, institution);
	}
	return inferred.size === 1 ? [...inferred.values()][0] : null;
}

function canonicalTitleFromText(text: string, request: BriefingRequest): string | null {
	const codeMatch = text.match(courseCodePattern(request.courseCode));
	if (!codeMatch || codeMatch.index == null) return null;
	const institution = resolveInstitution(request.institution ?? '');
	const institutionNames = new Set(
		[institution?.name?.toLowerCase(), institution?.domain?.toLowerCase()].filter(Boolean)
	);
	function isInstitutionName(name: string): boolean {
		const lower = name.toLowerCase().trim();
		return institutionNames.has(lower) || /^(college|university)$/i.test(lower);
	}
	const candidates: string[] = [];
	const afterCode = text.slice(codeMatch.index + codeMatch[0].length).trim();
	const titleMatch = afterCode.match(
		/^(?:[-–—:]\s*)?([A-Z][A-Za-z0-9&/,()'’:\- ]{2,120}?)(?=\s+(?:is|covers|examines|introduces|provides|requires|credits?\b|course\b|at\b)|[.\n]|$)/
	);
	if (titleMatch && !isInstitutionName(titleMatch[1])) {
		candidates.push(titleMatch[1]);
	}
	const beforeCode = text
		.slice(0, codeMatch.index)
		.replace(/[|\s]+$/, '')
		.trim();
	if (beforeCode && /[A-Z]/.test(beforeCode.charAt(0)) && !isInstitutionName(beforeCode)) {
		candidates.push(beforeCode);
	}
	if (candidates.length) {
		const best = candidates.reduce((a, b) => (a.length >= b.length ? a : b));
		const title = cleanCanonicalTitle(`${normalizeCourseCode(request.courseCode)} ${best}`);
		if (title !== normalizeCourseCode(request.courseCode)) return title;
	}
	return null;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isGenericCoursePageTitle(title: string): boolean {
	const withoutInstitution = title
		.replace(
			new RegExp(
				`\\b(?:${REGISTERED_INSTITUTIONS.flatMap((inst) => [
					inst.name,
					inst.domain,
					...inst.aliases
				])
					.map(escapeRegex)
					.join('|')})\\b`,
				'gi'
			),
			' '
		)
		.replace(/\s+/g, ' ')
		.trim();
	return /^(course|course page|catalog|catalogue|course catalog|course catalogue|courses)$/i.test(
		withoutInstitution
	);
}

// ── Public API ──

export function extractCanonicalCourseTitle(
	source: Pick<EvidenceSource, 'title' | 'excerpt'>,
	request: BriefingRequest
): string | null {
	for (const text of [source.title, source.excerpt]) {
		const candidate = canonicalTitleFromText(text ?? '', request);
		if (candidate) return candidate;
	}
	const title = cleanCanonicalTitle(source.title ?? '');
	const hasCourseCode = courseCodePattern(request.courseCode).test(
		`${source.title} ${source.excerpt}`
	);
	if (hasCourseCode && title && !isGenericCoursePageTitle(title)) {
		const codePattern = courseCodePattern(request.courseCode);
		const codeMatch = title.match(codePattern);
		if (codeMatch && codeMatch.index != null) {
			const beforeCode = title
				.slice(0, codeMatch.index)
				.replace(/[|\s-]+$/, '')
				.trim();
			const afterCode = title
				.slice(codeMatch.index + codeMatch[0].length)
				.replace(/^[|\s-]+/, '')
				.trim();
			const descriptive = beforeCode.length >= afterCode.length ? beforeCode : afterCode;
			if (descriptive && descriptive.length >= 2) {
				return cleanCanonicalTitle(`${normalizeCourseCode(request.courseCode)} ${descriptive}`);
			}
		}
		return cleanCanonicalTitle(`${normalizeCourseCode(request.courseCode)} ${title}`);
	}
	return null;
}

export function selectIdentitySource(
	sources: EvidenceSource[],
	request: BriefingRequest
): EvidenceSource | null {
	const courseCodeNormalized = normalizeCourseCode(request.courseCode);
	const institution = resolveRequestedInstitution(sources, request);
	const official = sources.filter(
		(s) =>
			s.sourceType === 'official' &&
			institution != null &&
			(s.domain === institution.domain || s.domain.endsWith(`.${institution.domain}`))
	);
	if (!official.length) return null;
	const matching = official.filter((s) => extractCanonicalCourseTitle(s, request));
	if (!matching.length) return null;
	const codeSlug = courseCodeNormalized.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const slugMatch = matching.filter((s) => {
		try {
			return new URL(s.url).pathname.toLowerCase().includes(codeSlug);
		} catch {
			return false;
		}
	});
	return slugMatch.length > 0 ? slugMatch[0] : matching[0];
}

export function resolveCourseIdentity(
	sources: EvidenceSource[],
	request: BriefingRequest
): ResolvedCourse {
	const courseCodeNormalized = normalizeCourseCode(request.courseCode);
	const institution = resolveRequestedInstitution(sources, request);
	const identityDefaults = {
		institution: institution?.name ?? request.institution ?? '',
		courseCode: courseCodeNormalized,
		canonicalTitle: '',
		canonicalUrl: '',
		sourceId: ''
	};

	if (!institution) return { ...identityDefaults, status: 'not_found', candidates: [] };

	const officialCandidates = sources
		.filter(
			(s) =>
				s.sourceType === 'official' &&
				(s.domain === institution.domain || s.domain.endsWith(`.${institution.domain}`)) &&
				isSourceAdmissibleFor(classifySource(s), 'course_identity')
		)
		.map((s) => ({
			sourceId: s.id,
			title: s.title,
			url: s.url,
			excerpt: s.excerpt
		}));

	const matchingCandidates = officialCandidates
		.map((candidate) => ({
			...candidate,
			canonicalTitle: extractCanonicalCourseTitle(
				{ title: candidate.title, excerpt: candidate.excerpt },
				request
			)
		}))
		.filter((candidate) => candidate.canonicalTitle);

	if (!matchingCandidates.length) {
		return {
			...identityDefaults,
			status: 'not_found',
			candidates: officialCandidates.slice(0, 10)
		};
	}

	const catalogMatching = matchingCandidates.filter(
		(c) =>
			!/(timetable|schedule|faculty|instructor|section|crn)/i.test(c.title.toLowerCase()) &&
			!/(timetable|schedule|faculty)/i.test(
				(() => {
					try {
						return new URL(c.url).pathname.toLowerCase();
					} catch {
						return '';
					}
				})()
			)
	);
	const sourceById = new Map(sources.map((source) => [source.id, source]));
	const sourceFor = (candidate: (typeof catalogMatching)[number]) =>
		sourceById.get(candidate.sourceId)!;
	const normalizedTerm = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
	const requestedTerm = request.activeTerm ? normalizedTerm(request.activeTerm) : null;
	const termMatches = (candidate: (typeof catalogMatching)[number]) => {
		if (!requestedTerm) return false;
		const scope = extractTermScope(sourceFor(candidate));
		return scope ? normalizedTerm(scope) === requestedTerm : false;
	};

	let admissible = catalogMatching;
	if (requestedTerm) {
		const exactTerm = catalogMatching.filter(termMatches);
		if (exactTerm.length) admissible = exactTerm;
		else {
			const current = catalogMatching.filter(
				(candidate) => sourceFor(candidate).currentness !== 'historical'
			);
			if (current.length) admissible = current;
		}
	} else {
		const current = catalogMatching.filter(
			(candidate) => sourceFor(candidate).currentness !== 'historical'
		);
		if (current.length) admissible = current;
	}

	const requestedTitle = request.courseName
		? normalizeCanonicalTitle(request.courseName, courseCodeNormalized)
		: '';
	const requestedMatches = requestedTitle
		? admissible.filter(
				(candidate) =>
					normalizeCanonicalTitle(String(candidate.canonicalTitle), courseCodeNormalized) ===
					requestedTitle
			)
		: [];
	if (requestedMatches.length === 1) {
		const selected = requestedMatches[0];
		return {
			...identityDefaults,
			canonicalTitle: String(selected.canonicalTitle).trim(),
			canonicalUrl: selected.url,
			sourceId: selected.sourceId,
			status: 'verified',
			candidates: matchingCandidates.slice(0, 10)
		};
	}
	const distinctTitles = new Set(
		admissible.map((c) => normalizeCanonicalTitle(String(c.canonicalTitle), courseCodeNormalized))
	);
	if (distinctTitles.size > 1) {
		return {
			...identityDefaults,
			status: 'ambiguous',
			candidates: matchingCandidates.slice(0, 10)
		};
	}

	const selected = admissible[0] ?? matchingCandidates[0];
	const selectedTitle = String(selected.canonicalTitle).trim();
	const codeSlug = courseCodeNormalized.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const urlSlugMatch = (() => {
		try {
			return new URL(selected.url).pathname.toLowerCase().includes(codeSlug);
		} catch {
			return false;
		}
	})();

	if (!urlSlugMatch && !selected.excerpt.toUpperCase().includes(courseCodeNormalized)) {
		return {
			...identityDefaults,
			canonicalTitle: selectedTitle,
			canonicalUrl: selected.url,
			sourceId: selected.sourceId,
			status: 'not_found',
			candidates: matchingCandidates.slice(0, 10)
		};
	}

	return {
		...identityDefaults,
		canonicalTitle: selectedTitle,
		canonicalUrl: selected.url,
		sourceId: selected.sourceId,
		status: 'verified',
		candidates: matchingCandidates.slice(0, 10)
	};
}

/** The sole deterministic admission decision for a course identity. */
export function evaluateCourseIdentity(
	sources: EvidenceSource[],
	request: BriefingRequest
): CourseIdentityEvaluation {
	const institution = resolveRequestedInstitution(sources, request);
	if (!institution) return { status: 'rejected', code: 'UNSUPPORTED_INSTITUTION', candidates: [] };
	const official = sources.filter(
		(source) =>
			source.sourceType === 'official' &&
			(source.domain === institution.domain || source.domain.endsWith(`.${institution.domain}`)) &&
			isSourceAdmissibleFor(classifySource(source), 'course_identity')
	);
	if (!official.length)
		return { status: 'rejected', code: 'NO_ADMISSIBLE_OFFICIAL_SOURCE', candidates: [] };
	const resolved = resolveCourseIdentity(official, request);
	if (resolved.status === 'verified') return { status: 'verified', course: resolved };
	if (resolved.status === 'ambiguous')
		return {
			status: 'rejected',
			code: 'CONFLICTING_CANONICAL_TITLES',
			candidates: resolved.candidates
		};
	const codeSource = official.find((source) =>
		courseCodePattern(request.courseCode).test(`${source.title} ${source.excerpt}`)
	);
	if (codeSource) {
		const normalizedCode = normalizeCourseCode(request.courseCode);
		const requestedName = request.courseName?.trim();
		return {
			status: 'verified',
			course: {
				institution: institution.name,
				courseCode: normalizedCode,
				canonicalTitle: requestedName ? `${normalizedCode} ${requestedName}` : normalizedCode,
				canonicalUrl: codeSource.url,
				sourceId: codeSource.id,
				status: 'verified',
				candidates: resolved.candidates
			}
		};
	}
	return {
		status: 'rejected',
		code: codeSource ? 'CANONICAL_TITLE_NOT_FOUND' : 'EXACT_COURSE_CODE_NOT_FOUND',
		candidates: resolved.candidates
	};
}
