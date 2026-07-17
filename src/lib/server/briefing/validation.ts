import { BRIEFING_SCHEMA_VERSION } from './schema';
import {
	hasDuplicateCourseField,
	isCleanCourseField,
	type CourseOutlineField
} from './field-quality';
import type {
	Briefing,
	BriefingRequest,
	BriefingUsage,
	EvidenceSource,
	ReportSection
} from './schema';
import type { ResolvedCourse } from './accuracy-gate';
import { evaluateCourseIdentity, normalizeCourseCode, resolveInstitution } from './accuracy-gate';
export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}
const SECTIONS = [
	'description',
	'credits',
	'prerequisites',
	'corequisites',
	'delivery',
	'assessments',
	'workload',
	'rateMyProfessors',
	'contradictions',
	'missing',
	'summary'
] as const;
function officialDomainForRequest(request: BriefingRequest): string | null {
	return resolveInstitution(request.institution)?.domain ?? null;
}
function isOfficialInstitutionSource(source: EvidenceSource, request: BriefingRequest): boolean {
	const domain = officialDomainForRequest(request);
	return (
		source.sourceType === 'official' &&
		(!domain || source.domain === domain || source.domain.endsWith(`.${domain}`))
	);
}
function fail(message: string): never {
	throw new ValidationError(message);
}
function sourceMentionsCourse(source: EvidenceSource, courseCode: string): boolean {
	const [subject, number] = normalizeCourseCode(courseCode).split(' ');
	return new RegExp(`\\b${subject}\\s*[- ]?\\s*${number}\\b`, 'i').test(
		`${source.title} ${source.excerpt}`
	);
}
function ids(value: unknown, known: Set<string>, field: string): string[] {
	if (!Array.isArray(value)) fail(`${field} sourceIds must be an array`);
	const result = value.map(String);
	if (result.some((id) => !known.has(id))) fail(`${field} references an unknown source`);
	return result;
}
function optionalRmpFields(
	value: Record<string, unknown>,
	known: Set<string>,
	sourceById: Map<string, EvidenceSource>
): Pick<Briefing, 'rmpProfile' | 'studentSentiment'> {
	const out: Pick<Briefing, 'rmpProfile' | 'studentSentiment'> = {};
	const rmpProfile = value.rmpProfile;
	if (rmpProfile && typeof rmpProfile === 'object' && !Array.isArray(rmpProfile)) {
		const profile = rmpProfile as Record<string, unknown>;
		const sourceIds = ids(profile.sourceIds, known, 'rmpProfile');
		if (sourceIds.length || String(profile.profileUrl ?? '').trim()) {
			if (!sourceIds.length || sourceIds.some((id) => sourceById.get(id)?.sourceType !== 'rmp'))
				fail('rmpProfile requires RMP sources');
			out.rmpProfile = {
				profileUrl: String(profile.profileUrl ?? ''),
				displayedName: String(profile.displayedName ?? ''),
				institution: String(profile.institution ?? ''),
				department: typeof profile.department === 'string' ? profile.department : null,
				overallRating: typeof profile.overallRating === 'number' ? profile.overallRating : null,
				ratingCount: typeof profile.ratingCount === 'number' ? profile.ratingCount : null,
				wouldTakeAgainPercent:
					typeof profile.wouldTakeAgainPercent === 'number' ? profile.wouldTakeAgainPercent : null,
				difficulty: typeof profile.difficulty === 'number' ? profile.difficulty : null,
				themes: Array.isArray(profile.themes) ? profile.themes.map(String).slice(0, 8) : [],
				sourceIds
			};
		}
	}
	const studentSentiment = value.studentSentiment;
	if (
		studentSentiment &&
		typeof studentSentiment === 'object' &&
		!Array.isArray(studentSentiment)
	) {
		const sentiment = studentSentiment as Record<string, unknown>;
		const sourceIds = ids(sentiment.sourceIds, known, 'studentSentiment');
		const hasSentiment =
			(Array.isArray(sentiment.positives) && sentiment.positives.length > 0) ||
			(Array.isArray(sentiment.concerns) && sentiment.concerns.length > 0);
		if (sourceIds.length || hasSentiment) {
			if (!sourceIds.length || sourceIds.some((id) => sourceById.get(id)?.sourceType !== 'rmp'))
				fail('studentSentiment requires RMP sources');
			out.studentSentiment = {
				positives: Array.isArray(sentiment.positives)
					? sentiment.positives.map(String).slice(0, 4)
					: [],
				concerns: Array.isArray(sentiment.concerns)
					? sentiment.concerns.map(String).slice(0, 4)
					: [],
				sampleSize: typeof sentiment.sampleSize === 'number' ? sentiment.sampleSize : null,
				courseSpecific: sentiment.courseSpecific === true,
				sourceIds
			};
		}
	}
	return out;
}
export function validateStructuredBriefing(
	value: Record<string, unknown>,
	sources: EvidenceSource[],
	request: BriefingRequest,
	metadata: {
		researchedAt: string;
		modelUsed: string;
		searchModel: string;
		synthesisModel: string;
		usage: BriefingUsage;
	},
	expectedIdentity?: ResolvedCourse
): Briefing {
	const sourceById = new Map(sources.map((s) => [s.id, s]));
	const known = new Set(sourceById.keys());
	const identity = value.identity as Record<string, unknown>;
	if (!identity || typeof identity !== 'object') fail('identity is required');
	const catalogId = String(identity.catalogSourceId ?? '');
	const catalog = sourceById.get(catalogId);
	if (!catalog || catalog.category !== 'catalog' || !isOfficialInstitutionSource(catalog, request))
		fail('identity requires an official catalog source for the requested institution');
	if (
		expectedIdentity &&
		(String(identity.code ?? '') !== expectedIdentity.courseCode ||
			String(identity.name ?? '') !== expectedIdentity.canonicalTitle ||
			String(identity.institution ?? '') !== expectedIdentity.institution ||
			catalogId !== expectedIdentity.sourceId ||
			catalog.url !== expectedIdentity.canonicalUrl)
	)
		fail('identity does not match the verified official course source');
	const instructor = value.instructor as Record<string, unknown>;
	if (!instructor || typeof instructor !== 'object') fail('instructor is required');
	const instructorIds = ids(instructor.sourceIds, known, 'instructor');
	const status = String(instructor.status);
	if (
		![
			'requested_by_user',
			'verified_current_official',
			'supported_current_non_official',
			'verified_historical',
			'contradicted',
			'not_found',
			'not_requested'
		].includes(status)
	)
		fail('instructor status is invalid');
	if (
		status === 'verified_current_official' &&
		(!instructorIds.length ||
			instructorIds.some((id) => {
				const s = sourceById.get(id)!;
				return (
					!isOfficialInstitutionSource(s, request) ||
					s.category !== 'schedule' ||
					s.currentness !== 'current'
				);
			}))
	)
		fail('current instructor requires current official evidence');
	if (
		status === 'verified_historical' &&
		(!instructorIds.length ||
			instructorIds.some((id) => sourceById.get(id)!.currentness !== 'historical'))
	)
		fail('historical instructor status requires historical evidence');
	if (
		status === 'supported_current_non_official' &&
		(!instructorIds.length ||
			instructorIds.some((id) => {
				const source = sourceById.get(id)!;
				return source.currentness !== 'current' || source.sourceType === 'official';
			}))
	)
		fail('non-official instructor support requires current non-official evidence');
	const claims = Array.isArray(value.claims)
		? (value.claims as Array<Record<string, unknown>>)
		: fail('claims must be an array');
	const claimIds = new Set<string>();
	for (const claim of claims) {
		const id = String(claim.id ?? '');
		if (!id || claimIds.has(id)) fail('claim IDs must be unique');
		claimIds.add(id);
		const status = String(claim.status);
		if (
			![
				'verified_current',
				'verified_historical',
				'supported_non_official',
				'inferred',
				'unknown',
				'contradicted'
			].includes(status)
		)
			fail('claim status is invalid');
		const claimSources = ids(claim.sourceIds, known, `claim ${id}`);
		if (
			status === 'inferred' &&
			(!claimSources.length || typeof claim.explanation !== 'string' || !claim.explanation.trim())
		)
			fail('inferred claims require sources and explanation');
		if (status !== 'unknown' && !claimSources.length) fail('factual claims require sources');
		if (
			status === 'verified_current' &&
			claimSources.some((sourceId) => sourceById.get(sourceId)!.currentness !== 'current')
		)
			fail('current claims require current evidence');
		if (
			status === 'verified_historical' &&
			claimSources.some((sourceId) => sourceById.get(sourceId)!.currentness !== 'historical')
		)
			fail('historical claims require historical evidence');
		if (
			status === 'supported_non_official' &&
			claimSources.some((sourceId) => sourceById.get(sourceId)!.sourceType === 'official')
		)
			fail('non-official claims require non-official evidence');
		if (status === 'contradicted' && claimSources.length < 2) {
			const isInstructorAssignmentConflict =
				status === 'contradicted' &&
				String(instructor.status) === 'contradicted' &&
				String(instructor.requestedName ?? '').trim() !== '' &&
				String(instructor.requestedName) === String(request.professorName ?? '') &&
				String(instructor.name ?? '').trim() !== '' &&
				instructorIds.length === 1 &&
				instructorIds[0] === claimSources[0] &&
				(() => {
					const source = sourceById.get(claimSources[0]);
					return !!source &&
						source.category === 'schedule' &&
						source.currentness === 'current' &&
						isOfficialInstitutionSource(source, request) &&
						`${source.title} ${source.excerpt}`
							.toLocaleLowerCase()
							.includes(String(instructor.name).toLocaleLowerCase());
				})();
			const linkedFromContradictions =
				Array.isArray((value.contradictions as Record<string, unknown> | undefined)?.claimIds) &&
					((value.contradictions as Record<string, unknown>).claimIds as unknown[]).map(String).includes(id);
			const describesConflict =
				String(claim.text ?? '').includes(String(instructor.requestedName)) &&
				String(claim.text ?? '').includes(String(instructor.name)) &&
				/assign|instructor|teach|schedule|official/i.test(String(claim.text ?? ''));
			if (!isInstructorAssignmentConflict || !linkedFromContradictions || !describesConflict)
				fail('contradicted claims require conflicting sources');
		}
	}
	const sections = {} as Record<string, ReportSection>;
	for (const name of SECTIONS) {
		const raw = value[name] as Record<string, unknown>;
		if (!raw || typeof raw !== 'object') fail(`${name} is required`);
		const sourceIds = ids(raw.sourceIds, known, name);
		const sectionClaimIds = Array.isArray(raw.claimIds)
			? raw.claimIds.map(String)
			: fail(`${name} claimIds must be an array`);
		if (sectionClaimIds.some((id) => !claimIds.has(id)))
			fail(`${name} references an unknown claim`);
		const text = typeof raw.text === 'string' ? raw.text : '';
		if (text.trim() && !sourceIds.length && name !== 'missing')
			fail(`${name} factual text requires sources`);
		sections[name] = { text, sourceIds, claimIds: sectionClaimIds };
	}
	const claimsById = new Map(claims.map((claim) => [String(claim.id), claim]));
	const officialOutlineFields: CourseOutlineField[] = [
		'description',
		'credits',
		'prerequisites',
		'corequisites',
		'delivery',
		'assessments'
	];
	for (const field of officialOutlineFields) {
		const section = sections[field];
		if (!section.text.trim()) continue;
		if (!isCleanCourseField(field, section.text, request.courseCode))
			fail(`${field} contains mixed evidence or is not field-specific`);
		if (!section.sourceIds.length) fail(`${field} requires official evidence`);
		for (const id of section.sourceIds) {
			const source = sourceById.get(id)!;
			if (!isOfficialInstitutionSource(source, request))
				fail(`${field} requires official evidence`);
			if (!sourceMentionsCourse(source, request.courseCode))
				fail(`${field} source does not match the requested course`);
			const allowed =
				field === 'delivery' || field === 'assessments'
					? ['catalog', 'outline', 'schedule'].includes(source.category)
					: ['catalog', 'prerequisites', 'outline'].includes(source.category);
			if (!allowed) fail(`${field} cites an inappropriate source type`);
		}
	}
	if (
		hasDuplicateCourseField(
			['description', 'prerequisites', 'delivery', 'assessments'].map(
				(field) => sections[field].text
			)
		)
	)
		fail('course outline fields must not duplicate one another');
	const assessments = sections.assessments.sourceIds.map((id) => sourceById.get(id)!);
	if (
		assessments.some((s) => s.currentness === 'historical') &&
		sections.assessments.claimIds.some(
			(id) => String(claimsById.get(id)?.status) !== 'verified_historical'
		)
	)
		fail('historical assessments must be explicitly historical');
	if (sections.rateMyProfessors.sourceIds.some((id) => sourceById.get(id)!.sourceType !== 'rmp'))
		fail('RMP section requires RMP sources');
	if (String(instructor.requestedName ?? '') !== (request.professorName ?? ''))
		fail('requested instructor name was not preserved');
	for (const claim of claims) {
		for (const sourceId of claim.sourceIds as string[]) {
			const source = sourceById.get(sourceId)!;
			if (!source.claimsSupported.includes(String(claim.id)))
				source.claimsSupported.push(String(claim.id));
		}
	}
	const rmpFields = optionalRmpFields(value, known, sourceById);
	return {
		schemaVersion: BRIEFING_SCHEMA_VERSION,
		identity: identity as Briefing['identity'],
		instructor: {
			...(instructor as Briefing['instructor']),
			requestedName: request.professorName ?? null
		},
		...(sections as Pick<Briefing, (typeof SECTIONS)[number]>),
		claims: claims as Briefing['claims'],
		...rmpFields,
		sources,
		researchedAt: metadata.researchedAt,
		modelUsed: metadata.modelUsed,
		searchModel: metadata.searchModel,
		synthesisModel: metadata.synthesisModel,
		usage: metadata.usage
	};
}
export function extractBriefingContent(raw: string | null | undefined): string {
	if (typeof raw !== 'string' || !raw.trim())
		throw new ValidationError('LLM returned no JSON content');
	return raw.trim();
}
export function validateCachedBriefingIdentity(briefing: Briefing, request: BriefingRequest): void {
	const institution = resolveInstitution(request.institution ?? briefing.identity.institution);
	const identity = briefing.identity;
	const catalog = briefing.sources.find((source) => source.id === identity.catalogSourceId);
	const evaluation = evaluateCourseIdentity(briefing.sources, request);
	if (
		!institution ||
		normalizeCourseCode(identity.code) !== normalizeCourseCode(request.courseCode) ||
		identity.institution !== institution.name ||
		(identity.officialDomain !== institution.domain &&
			!identity.officialDomain.endsWith(`.${institution.domain}`)) ||
		!catalog ||
		catalog.category !== 'catalog' ||
		evaluation.status !== 'verified' ||
		identity.name !== evaluation.course.canonicalTitle ||
		identity.catalogSourceId !== evaluation.course.sourceId
	)
		fail('Cached briefing identity is not verified for this request');
}

export function parseCachedBriefing(content: string): Briefing {
	let value: unknown;
	try {
		value = JSON.parse(content);
	} catch {
		throw new ValidationError('Cached briefing is not valid JSON');
	}
	if (
		!value ||
		typeof value !== 'object' ||
		typeof (value as { schemaVersion?: unknown }).schemaVersion !== 'number' ||
		(value as { schemaVersion: number }).schemaVersion < 4
	)
		throw new ValidationError('Cached briefing schema is stale');
	return value as Briefing;
}
export function parseBriefingContent(): never {
	throw new ValidationError('Legacy briefing format is unsupported');
}
export function validateBriefing(): never {
	throw new ValidationError('Legacy briefing format is unsupported');
}
