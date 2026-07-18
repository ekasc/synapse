import type { StudySession } from './store';

const MAX_SITES_PER_LIST = 100;
const MAX_SESSION_SECONDS = 8 * 60 * 60;

export function normalizeDomain(value: string): string | null {
	try {
		const trimmed = value.trim().toLowerCase();
		if (!trimmed) return null;
		const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
		if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
		return url.hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
}

function normalizeSiteList(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length > MAX_SITES_PER_LIST) return null;
	const domains = value.map((site) => (typeof site === 'string' ? normalizeDomain(site) : null));
	if (domains.some((domain) => domain === null)) return null;
	return [...new Set(domains as string[])];
}

export function parseFocusPreferences(value: unknown) {
	if (!value || typeof value !== 'object') return null;
	const body = value as { allowedSites?: unknown; blockedSites?: unknown };
	const allowedSites = normalizeSiteList(body.allowedSites);
	const blockedSites = normalizeSiteList(body.blockedSites);
	if (!allowedSites || !blockedSites) return null;
	if (allowedSites.some((site) => blockedSites.includes(site))) return null;
	return { allowedSites, blockedSites };
}

export function parseStudySession(value: unknown): Omit<StudySession, 'id' | 'completedAt'> | null {
	if (!value || typeof value !== 'object') return null;
	const body = value as Record<string, unknown>;
	const plannedSeconds = Number(body.plannedSeconds);
	const completedSeconds = Number(body.completedSeconds);
	const distractionCount = Number(body.distractionCount);
	const focusScore = Number(body.focusScore);
	const startedAt = typeof body.startedAt === 'string' ? body.startedAt : '';
	if (
		!Number.isInteger(plannedSeconds) ||
		plannedSeconds < 60 ||
		plannedSeconds > MAX_SESSION_SECONDS ||
		!Number.isInteger(completedSeconds) ||
		completedSeconds < 0 ||
		completedSeconds > plannedSeconds ||
		!Number.isInteger(distractionCount) ||
		distractionCount < 0 ||
		distractionCount > 10_000 ||
		!Number.isInteger(focusScore) ||
		focusScore < 0 ||
		focusScore > 100 ||
		!startedAt ||
		Number.isNaN(Date.parse(startedAt))
	)
		return null;

	return {
		courseId: typeof body.courseId === 'string' && body.courseId ? body.courseId : null,
		intention: typeof body.intention === 'string' ? body.intention.trim().slice(0, 300) : '',
		plannedSeconds,
		completedSeconds,
		distractionCount,
		focusScore,
		startedAt: new Date(startedAt).toISOString()
	};
}
