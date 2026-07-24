/**
 * Source classification and admissibility rules.
 * Extracted from accuracy-gate.ts — keep in sync with the facade re-exports.
 */

import type { EvidenceSource } from './schema';

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

export const FACULTY_PAGE_CANNOT_VERIFY =
	'official_faculty sources do not confirm course assignment';
export const RMP_CANNOT_VERIFY =
	'student_review sources do not verify course assignment or teaching history';

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

export function extractTermScope(source: EvidenceSource): string | null {
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
