import type { Handle } from '@sveltejs/kit';
import { setStoreDb } from '$lib/server/store';
import { setAuthDb, getActiveSession, getUserById } from '$lib/server/auth/store';
import { decrypt } from '$lib/server/auth/session';

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Frame-Options': 'DENY',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
};

export const handle: Handle = async ({ event, resolve }) => {
	if (event.platform?.env?.BRIEF_DB) {
		const db = event.platform.env.BRIEF_DB as D1Database;
		setStoreDb(db);
		setAuthDb(db);
	}

	// ── Session validation ──
	const platformEnv = event.platform?.env as unknown as Record<string, string | undefined>;
	const encryptionKey = platformEnv?.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? '';

	if (encryptionKey) {
		const cookie = event.cookies.get('synapse_session');
		if (cookie) {
			const payload = decrypt(cookie, encryptionKey);
			if (payload) {
				const active = await getActiveSession(payload.sessionId, payload.userId);
				if (active) {
					const user = await getUserById(payload.userId);
					if (user && user.id) {
						event.locals.user = { id: user.id, email: user.email, name: user.name };
						event.locals.sessionId = payload.sessionId;
					}
				}
			}
			if (!event.locals.user) {
				event.cookies.delete('synapse_session', { path: '/' });
			}
		}
	}

	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};
