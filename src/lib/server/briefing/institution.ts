/**
 * Institution domain configuration and resolution.
 * Extracted from accuracy-gate.ts — keep in sync with the facade re-exports.
 */

export type InstitutionalDomain = {
	name: string;
	domain: string;
	aliases: string[];
	catalogPathTemplates?: string[];
};

const REGISTERED_INSTITUTIONS: InstitutionalDomain[] = [
	{
		name: 'Douglas College',
		domain: 'douglascollege.ca',
		aliases: ['www.douglascollege.ca'],
		catalogPathTemplates: ['/course/{courseCodeSlug}']
	}
];

export { REGISTERED_INSTITUTIONS };

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
