import type { BriefingRequest, EvidenceSource, Claim, CourseOffering } from './schema';

// ── Domain contracts ──

export type InstitutionalDomain = {
	name: string;
	domain: string;
	aliases: string[];
	catalogPathTemplates?: string[];
};

export type CourseIdentityFailureCode =
	| 'UNSUPPORTED_INSTITUTION'
	| 'NO_ADMISSIBLE_OFFICIAL_SOURCE'
	| 'EXACT_COURSE_CODE_NOT_FOUND'
	| 'CANONICAL_TITLE_NOT_FOUND'
	| 'CONFLICTING_CANONICAL_TITLES';

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

export type EvidenceValue<T> = {
	value: T;
	provenance: 'official' | 'user_confirmed' | 'student_reported' | 'inferred' | 'unverified';
	sourceIds: string[];
	term?: string;
};

export type OfferingRecord = {
	term: string;
	relationship: 'current' | 'upcoming' | 'historical';
	instructor: EvidenceValue<string> | null;
	crn: EvidenceValue<string> | null;
	section: EvidenceValue<string> | null;
	schedule: EvidenceValue<string> | null;
	campus: EvidenceValue<string> | null;
	modality: EvidenceValue<string> | null;
	sourceIds: string[];
};

export type AdmissibleSourceType =
	| 'official_course'
	| 'official_offering'
	| 'official_timetable'
	| 'official_outline'
	| 'official_faculty'
	| 'student_review'
	| 'other';

export type AdmissibleSource = {
	id: string;
	url: string;
	type: AdmissibleSourceType;
	domain: string;
	excerpt: string;
	retrievedAt: string | null;
	termScope: string | null;
};

export type MissingEvidence = {
	field: string;
	reason: string;
};

export type EvidenceConflict = {
	field: string;
	left: string;
	right: string;
	detail: string;
};

export type ValidationFailure = {
	field: string;
	rule: string;
	detail: string;
};

export type BriefingAdmissionResult =
	| { status: 'accepted'; course: ResolvedCourse; offerings: OfferingRecord[]; sourceIds: string[] }
	| {
			status: 'partial';
			course: ResolvedCourse;
			offerings: OfferingRecord[];
			sourceIds: string[];
			missingEvidence: MissingEvidence[];
	  }
	| { status: 'conflict'; course: ResolvedCourse; conflicts: EvidenceConflict[] }
	| { status: 'not_found'; reason: string }
	| { status: 'rejected'; reasons: ValidationFailure[] };

// ── Instances of the institutional-domain configuration ──

// Currently only one supported, but the structure is generic.
// Register additional institutions in this array as the application supports them.
const REGISTERED_INSTITUTIONS: InstitutionalDomain[] = [
	{
		name: 'Douglas College',
		domain: 'douglascollege.ca',
		aliases: ['www.douglascollege.ca'],
		catalogPathTemplates: ['/course/{courseCodeSlug}']
	}
];

// ── Course-code normalisation ──

export function normalizeCourseCode(raw: string): string {
	return raw.toUpperCase().replace(/\s+/g, ' ').trim();
}

// ── Institution resolution ──

export function resolveInstitution(name?: string): InstitutionalDomain | null {
	if (!name) return null;
	const lower = name.toLowerCase();
	return (
		REGISTERED_INSTITUTIONS.find(
			(inst) =>
				inst.name.toLowerCase() === lower ||
				inst.domain === lower ||
				inst.aliases.some((alias) => alias.toLowerCase() === lower)
		) ?? null
	);
}

export function matchInstitutionDomain(hostname: string): InstitutionalDomain | null {
	return (
		REGISTERED_INSTITUTIONS.find(
			(inst) =>
				hostname === inst.domain ||
				hostname.endsWith('.' + inst.domain) ||
				inst.aliases.includes(hostname)
		) ?? null
	);
}

// ── Course identity resolution ──

function courseCodePattern(courseCode: string): RegExp {
	const parts = normalizeCourseCode(courseCode).match(/^([A-Z]+)\s*(\d+[A-Z]?)$/);
	if (!parts) return new RegExp(courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
	return new RegExp(`\\b${parts[1]}\\s*[- ]?\\s*${parts[2]}\\b`, 'i');
}

function cleanCanonicalTitle(value: string): string {
	return value
		.replace(/\s+/g, ' ')
		.replace(/\s+[-–—:]\s*$/, '')
		.replace(/[.;,]\s*$/, '')
		.trim();
}

/** Compares catalog title variants without treating presentation chrome as course identity. */
export function normalizeCanonicalTitle(value: string, courseCode: string): string {
	const institutionNames = REGISTERED_INSTITUTIONS.flatMap((institution) => [
		institution.name,
		institution.domain,
		...institution.aliases
	]);
	return value
		.replace(courseCodePattern(courseCode), ' ')
		.replace(new RegExp(`\\b(?:${institutionNames.map(escapeRegex).join('|')})\\b`, 'gi'), ' ')
		.replace(/\b(?:course\s*)?(?:catalog|catalogue|course page|courses?)\b/gi, ' ')
		.replace(/[|–—:;,.()[\]{}_/\\-]+/g, ' ')
		.replace(/\b(spec)\b/gi, 'special')
		.replace(/\btech\b/gi, 'technology')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveRequestedInstitution(
	sources: EvidenceSource[],
	request: BriefingRequest
): InstitutionalDomain | null {
	if (request.institution) return resolveInstitution(request.institution);
	const inferred = new Map<string, InstitutionalDomain>();
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
	// Collect candidate titles from before and after the course code
	const candidates: string[] = [];
	// Try title AFTER the course code (e.g. "CSIS 4495 Applied Research Project")
	const afterCode = text.slice(codeMatch.index + codeMatch[0].length).trim();
	const titleMatch = afterCode.match(
		/^(?:[-–—:]\s*)?([A-Z][A-Za-z0-9&/,()'’:\- ]{2,120}?)(?=\s+(?:is|covers|examines|introduces|provides|requires|credits?\b|course\b|at\b)|[.\n]|$)/
	);
	if (titleMatch && !isInstitutionName(titleMatch[1])) {
		candidates.push(titleMatch[1]);
	}
	// Try title BEFORE the course code when separated by | (e.g. "Applied Research Project | CSIS 4495")
	const beforeCode = text
		.slice(0, codeMatch.index)
		.replace(/[|\s]+$/, '')
		.trim();
	if (beforeCode && /[A-Z]/.test(beforeCode.charAt(0)) && !isInstitutionName(beforeCode)) {
		candidates.push(beforeCode);
	}
	// Prefer the longer candidate
	if (candidates.length) {
		const best = candidates.reduce((a, b) => (a.length >= b.length ? a : b));
		const title = cleanCanonicalTitle(`${normalizeCourseCode(request.courseCode)} ${best}`);
		if (title !== normalizeCourseCode(request.courseCode)) return title;
	}
	return null;
}

function isGenericCoursePageTitle(title: string): boolean {
	const withoutInstitution = title
		.replace(
			new RegExp(
				`\\b(?:${REGISTERED_INSTITUTIONS.flatMap((institution) => [
					institution.name,
					institution.domain,
					...institution.aliases
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
		// If the title already contains the course code (e.g. "Applied Research Project | CSIS 4495 | Douglas College"),
		// try extracting just the descriptive portion before or after the code.
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
			// Prefer the longer descriptive portion
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

	// Step 2: Require the exact course code and canonical title to appear in official evidence.
	const matching = official.filter((s) => extractCanonicalCourseTitle(s, request));

	if (!matching.length) return null;

	// Step 3: Among matching sources, prefer the one whose URL slug matches
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

	// An identity source must belong to the exact requested institution, not merely any
	// registered institution.
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

	// Check if course code and canonical title appear in any candidate.
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

	// Check for conflicting titles among catalog-like sources only
	// (timetables, schedules etc. mention course codes but aren't identity sources)
	const catalogMatching = matchingCandidates.filter(
		(c) =>
			// Exclude sources that are clearly timetable/schedule/faculty pages
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

	// A requested term scopes special-topics identity. Otherwise current official evidence
	// outranks historical catalog variants; historical records remain in candidates as context.
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

	// For a single admissible candidate, title must NOT be completely unrelated
	// (generic titles pass, completely wrong course names fail)
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

export type CourseIdentityEvaluation =
	| { status: 'verified'; course: ResolvedCourse }
	| {
			status: 'rejected';
			code: CourseIdentityFailureCode;
			candidates: ResolvedCourse['candidates'];
	  };

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
	// A search result from the verified institution that names the exact course code is enough
	// to publish a sparse briefing when page hydration or title extraction fails. We keep all
	// optional fields missing and use the requested name only as a display fallback.
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

// ── Source admissibility ──

export function classifySource(original: EvidenceSource): AdmissibleSource {
	const host = original.domain.toLowerCase();
	const url = original.url.toLowerCase();
	const title = original.title.toLowerCase();
	const excerpt = original.excerpt.toLowerCase();

	let type: AdmissibleSourceType = 'other';
	if (host.includes('ratemyprofessors') || host.includes('ratemyprofessor')) {
		type = 'student_review';
	} else if (host.includes('douglascollege.ca') || host.includes('douglascollege')) {
		if (url.includes('/faculty') || url.includes('/people') || title.includes('faculty')) {
			type = 'official_faculty';
		} else if (/20[12]\d[0-3]\d/.test(url) || /\d[46]$/.test(url)) {
			if (url.includes('schedule') || url.includes('timetable') || excerpt.includes('crn')) {
				type = 'official_timetable';
			} else {
				type = 'official_outline';
			}
		} else if (url.includes('schedule') || url.includes('timetable')) {
			type = 'official_timetable';
		} else if (
			excerpt.includes('offering') ||
			excerpt.includes('crn') ||
			excerpt.includes('section')
		) {
			type = 'official_offering';
		} else {
			type = 'official_course';
		}
	}

	const termScope = extractTermScope(original);

	return {
		id: original.id,
		url: original.url,
		type,
		domain: original.domain,
		excerpt: original.excerpt,
		retrievedAt: original.retrievedAt,
		termScope
	};
}

function extractTermScope(source: EvidenceSource): string | null {
	try {
		const m = new URL(source.url).pathname.match(/(\d{4}[0-3]\d|\d{6})/);
		if (m) return m[1];
	} catch {
		/* ignore */
	}
	const text = (source.excerpt + ' ' + source.title).toLowerCase();
	const termMatch = text.match(/(fall|spring|summer|winter)\s*(20\d{2})/i);
	if (termMatch) {
		return `${termMatch[1].charAt(0).toUpperCase() + termMatch[1].slice(1)} ${termMatch[2]}`;
	}
	return null;
}

export function isSourceAdmissibleFor(source: AdmissibleSource, field: string): boolean {
	switch (field) {
		case 'course_identity':
		case 'title':
		case 'description':
		case 'credits':
		case 'prerequisites':
			return (
				source.type === 'official_course' ||
				source.type === 'official_offering' ||
				source.type === 'official_outline'
			);
		case 'offering_instructor':
			return source.type === 'official_timetable' || source.type === 'official_offering';
		case 'offering_crn':
		case 'offering_section':
		case 'offering_schedule':
		case 'offering_campus':
		case 'offering_modality':
			return source.type === 'official_timetable' || source.type === 'official_offering';
		case 'assessment':
			return (
				source.type === 'official_outline' ||
				source.type === 'official_course' ||
				source.type === 'official_offering'
			);
		case 'student_review':
			return source.type === 'student_review';
		case 'faculty_directory':
			return source.type === 'official_faculty';
		case 'instructor_assignment':
			return source.type === 'official_timetable' || source.type === 'official_offering';
		default:
			return source.type !== 'student_review';
	}
}

export const FACULTY_PAGE_CANNOT_VERIFY =
	'official_faculty sources do not confirm course assignment';
export const RMP_CANNOT_VERIFY =
	'student_review sources do not verify course assignment or teaching history';

// ── Offering validation ──

export function validateOfferingInstructor(
	offering: CourseOffering | undefined,
	allSources: EvidenceSource[]
): EvidenceValue<string> | null {
	if (!offering?.instructor?.name) return null;

	// User-confirmed: no source check needed, just accept
	if (offering.instructor.verification === 'user_confirmed') {
		return {
			value: offering.instructor.name,
			provenance: 'user_confirmed',
			sourceIds: [],
			term: offering.term.label
		};
	}

	// Official verification: must cite qualifying sources
	if (offering.instructor.verification === 'official') {
		const sourceIds = offering.instructor.sourceIds ?? [];
		const classified = sourceIds
			.map((sid) => allSources.find((s) => s.id === sid))
			.filter(Boolean) as EvidenceSource[];

		// Must have at least one admissible instructor source
		const hasAdmissible = classified.some((cs) => {
			const ads = classifySource(cs);
			return isSourceAdmissibleFor(ads, 'instructor_assignment');
		});

		if (!hasAdmissible) {
			return {
				value: offering.instructor.name,
				provenance: 'unverified',
				sourceIds,
				term: offering.term.label
			};
		}

		// Must have at least one source with matching term scope
		const hasTermMatch = classified.some((cs) => {
			const ads = classifySource(cs);
			return (
				isSourceAdmissibleFor(ads, 'instructor_assignment') &&
				(!ads.termScope || ads.termScope.includes(offering.term.label))
			);
		});

		const finalProvenance = hasTermMatch ? 'official' : 'unverified';

		return {
			value: offering.instructor.name,
			provenance: finalProvenance,
			sourceIds,
			term: offering.term.label
		};
	}

	// Student-reported: downgrade to unverified since RMP cannot verify
	if (offering.instructor.verification === 'student_reported') {
		return {
			value: offering.instructor.name,
			provenance: 'unverified',
			sourceIds: [],
			term: offering.term.label
		};
	}

	return {
		value: offering.instructor.name,
		provenance: 'unverified',
		sourceIds: [],
		term: offering.term.label
	};
}

// ── Admission gate ──

export function admitBriefing(
	sources: EvidenceSource[],
	resolvedCourse: ResolvedCourse,
	offerings: (CourseOffering | undefined)[],
	claims: Claim[],
	request: BriefingRequest
): BriefingAdmissionResult {
	const failures: ValidationFailure[] = [];
	const classifiedSources = sources.map(classifySource);

	// ── Identity gate ──
	if (resolvedCourse.status === 'not_found') {
		return {
			status: 'not_found',
			reason: `Course identity not found for ${resolvedCourse.courseCode} at ${resolvedCourse.institution}`
		};
	}

	if (resolvedCourse.status === 'ambiguous') {
		return {
			status: 'conflict',
			course: resolvedCourse,
			conflicts: [
				{
					field: 'course_identity',
					left: 'Multiple official identity sources conflict',
					right: resolvedCourse.candidates.map((c) => c.title).join(', '),
					detail: `${resolvedCourse.candidates.length} conflicting official sources for ${resolvedCourse.courseCode}`
				}
			]
		};
	}

	// ── Source admissibility gate ──
	const admittedSources: string[] = [];
	for (const cs of classifiedSources) {
		if (cs.type !== 'student_review' && cs.type !== 'other') {
			admittedSources.push(cs.id);
		}
	}

	if (!admittedSources.length) {
		failures.push({
			field: 'sources',
			rule: 'minimum_official_source',
			detail: 'No admissible source found for briefing admission'
		});
	}

	// ── Offering gate ──
	const validatedOfferings: OfferingRecord[] = [];
	const missingEvidence: MissingEvidence[] = [];

	for (const offering of offerings) {
		if (!offering) continue;

		// Check for duplicate term/relationship pairs
		const duplicate = validatedOfferings.find(
			(vo) => vo.term === offering.term.label && vo.relationship === offering.relationship
		);
		if (duplicate) {
			failures.push({
				field: 'offerings',
				rule: 'duplicate_offering',
				detail: `Duplicate ${offering.relationship} offering for term ${offering.term.label}`
			});
			continue;
		}

		// Validate instructor
		const validatedInstructor = validateOfferingInstructor(offering, sources);

		// Faculty pages cannot verify assignment — enforce
		if (validatedInstructor?.provenance === 'official') {
			const instructorSources = (offering.instructor?.sourceIds ?? [])
				.map((sid) => sources.find((s) => s.id === sid))
				.filter(Boolean) as EvidenceSource[];

			const hasOnlyFaculty =
				instructorSources.length > 0 &&
				instructorSources.every((s) => classifySource(s).type === 'official_faculty');

			if (hasOnlyFaculty) {
				validatedInstructor.provenance = 'unverified';
				missingEvidence.push({
					field: `offering.${offering.term.label}.instructor`,
					reason: FACULTY_PAGE_CANNOT_VERIFY
				});
			}

			const hasRMP = instructorSources.some((s) => classifySource(s).type === 'student_review');
			if (hasRMP && instructorSources.length === 1) {
				validatedInstructor.provenance = 'unverified';
				missingEvidence.push({
					field: `offering.${offering.term.label}.instructor`,
					reason: RMP_CANNOT_VERIFY
				});
			}
		}

		// Check for missing official verification — use validated provenance
		if (!offering.instructor) {
			missingEvidence.push({
				field: `offering.${offering.term.label}.instructor`,
				reason: 'No instructor information available for this term'
			});
		} else if (
			validatedInstructor &&
			validatedInstructor.provenance !== 'official' &&
			validatedInstructor.provenance !== 'user_confirmed'
		) {
			missingEvidence.push({
				field: `offering.${offering.term.label}.instructor`,
				reason: `Instructor not officially verified for ${offering.term.label}`
			});
		}

		validatedOfferings.push({
			term: offering.term.label,
			relationship: offering.relationship,
			instructor: validatedInstructor,
			crn: offering.crn
				? {
						value: String(offering.crn),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			section: offering.section
				? {
						value: String(offering.section),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			schedule: offering.schedule
				? {
						value: String(offering.schedule),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			campus: offering.campus
				? {
						value: String(offering.campus),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			modality: offering.modality
				? {
						value: String(offering.modality),
						provenance: 'official',
						sourceIds: offering.sourceIds,
						term: offering.term.label
					}
				: null,
			sourceIds: offering.sourceIds
		});
	}

	// ── Claim gate ──
	for (const claim of claims) {
		// Every claim must cite existing source IDs
		const sourceIds = claim.sourceIds ?? [];
		const nonExistentSources = sourceIds.filter((sid) => !sources.some((s) => s.id === sid));
		if (nonExistentSources.length > 0) {
			failures.push({
				field: `claim.${claim.id}`,
				rule: 'nonexistent_source',
				detail: `Claim cites nonexistent source(s): ${nonExistentSources.join(', ')}`
			});
		}

		// Official claims must cite official admissible sources
		if (claim.status === 'verified_current' || claim.status === 'verified_historical') {
			const hasOfficialSource = sourceIds.some((sid) => {
				const cs = classifiedSources.find((c) => c.id === sid);
				return cs && cs.type !== 'student_review' && cs.type !== 'other';
			});
			if (!hasOfficialSource && sourceIds.length > 0) {
				failures.push({
					field: `claim.${claim.id}`,
					rule: 'non_official_claim',
					detail: `Claim marked as ${claim.status} but cites only non-official sources`
				});
			}
		}
	}

	// ── Determine outcome ──
	if (failures.length > 0) {
		return { status: 'rejected', reasons: failures };
	}

	if (missingEvidence.length > 0) {
		return {
			status: 'partial',
			course: resolvedCourse,
			offerings: validatedOfferings,
			sourceIds: admittedSources,
			missingEvidence
		};
	}

	return {
		status: 'accepted',
		course: resolvedCourse,
		offerings: validatedOfferings,
		sourceIds: admittedSources
	};
}

// ── Retry policy ──

export type RetryDecision = {
	shouldRetry: boolean;
	reason: string;
	changedStrategy: string | null;
	maxAttempts: number;
};

export function decideRetry(
	error: { code?: string; name?: string; status?: number },
	attempt: number,
	previousStrategies: string[]
): RetryDecision {
	const MAX_ATTEMPTS = 2;

	if (attempt >= MAX_ATTEMPTS) {
		return {
			shouldRetry: false,
			reason: 'Exceeded maximum attempts',
			changedStrategy: null,
			maxAttempts: MAX_ATTEMPTS
		};
	}

	const isRetryable =
		error.name === 'TimeoutError' ||
		error.code === 'ETIMEDOUT' ||
		(error.status != null && (error.status >= 500 || error.status === 429));

	if (!isRetryable) {
		return {
			shouldRetry: false,
			reason: 'Non-retryable error',
			changedStrategy: null,
			maxAttempts: MAX_ATTEMPTS
		};
	}

	// Check if same strategy was already tried
	const currentStrategy = error.code ?? error.name ?? 'unknown';
	if (previousStrategies.includes(currentStrategy)) {
		return {
			shouldRetry: false,
			reason: 'Same strategy repeated without change',
			changedStrategy: null,
			maxAttempts: MAX_ATTEMPTS
		};
	}

	return {
		shouldRetry: true,
		reason: 'Retryable failure with new strategy',
		changedStrategy: currentStrategy,
		maxAttempts: MAX_ATTEMPTS
	};
}
