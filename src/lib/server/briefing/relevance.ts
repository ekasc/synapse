import { normalizeCourseCode, resolveInstitution } from './accuracy-gate';
import type { BriefingRequest, EvidenceCategory, EvidenceSource } from './schema';

export type ResearchTarget =
	| 'course_identity'
	| 'professor_assignment'
	| 'rmp_profile'
	| 'student_sentiment'
	| 'course_outline'
	| 'current_offering'
	| 'upcoming_offering';

function coursePattern(courseCode: string): RegExp {
	const [subject, number] = normalizeCourseCode(courseCode).split(' ');
	return new RegExp(`\\b${subject}\\s*[- ]?\\s*${number}\\b`, 'i');
}

function isOfficialInstitutionSource(source: EvidenceSource, request: BriefingRequest): boolean {
	const institution = resolveInstitution(request.institution);
	if (source.sourceType !== 'official') return false;
	if (!institution) return true;
	return source.domain === institution.domain || source.domain.endsWith(`.${institution.domain}`);
}

function mentionsCourse(source: EvidenceSource, request: BriefingRequest): boolean {
	return coursePattern(request.courseCode).test(`${source.title} ${source.excerpt}`);
}

function mentionsProfessor(source: EvidenceSource, request: BriefingRequest): boolean {
	const name = request.professorName?.trim().toLowerCase();
	return Boolean(name && `${source.title} ${source.excerpt}`.toLowerCase().includes(name));
}

export function isRelevantEvidence(
	source: EvidenceSource,
	request: BriefingRequest,
	target: ResearchTarget
): boolean {
	if (target === 'rmp_profile' || target === 'student_sentiment') {
		return (
			source.sourceType === 'rmp' &&
			(target === 'student_sentiment' || mentionsProfessor(source, request))
		);
	}
	if (!isOfficialInstitutionSource(source, request)) return false;
	if (target === 'course_identity')
		return source.category === 'catalog' && mentionsCourse(source, request);
	if (target === 'course_outline')
		return (
			['catalog', 'prerequisites', 'outline'].includes(source.category) &&
			mentionsCourse(source, request)
		);
	if (target === 'professor_assignment')
		return (
			source.category === 'schedule' &&
			mentionsCourse(source, request) &&
			mentionsProfessor(source, request)
		);
	return source.category === 'schedule' && mentionsCourse(source, request);
}

export function filterRelevantEvidence(
	sources: EvidenceSource[],
	request: BriefingRequest,
	target: ResearchTarget
): EvidenceSource[] {
	return sources.filter((source) => isRelevantEvidence(source, request, target));
}

export function targetForCategory(category: EvidenceCategory): ResearchTarget {
	if (category === 'catalog') return 'course_identity';
	if (category === 'outline' || category === 'prerequisites') return 'course_outline';
	if (category === 'rate-my-professors') return 'rmp_profile';
	if (category === 'schedule') return 'current_offering';
	return 'professor_assignment';
}
