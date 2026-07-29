/**
 * Course code normalization and canonical title helpers.
 * Extracted from accuracy-gate.ts — keep in sync with the facade re-exports.
 */

import { REGISTERED_INSTITUTIONS } from './institution';

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeCourseCode(raw: string): string {
	return raw.toUpperCase().replace(/\s+/g, ' ').trim();
}

export function courseCodePattern(courseCode: string): RegExp {
	const parts = normalizeCourseCode(courseCode).match(/^([A-Z]+)\s*(\d+[A-Z]?)$/);
	if (!parts) return new RegExp(courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
	return new RegExp(`\\b${parts[1]}\\s*[- ]?\\s*${parts[2]}\\b`, 'i');
}

export function cleanCanonicalTitle(value: string): string {
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
