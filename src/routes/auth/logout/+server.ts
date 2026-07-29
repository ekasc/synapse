import { redirect, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { revokeSession } from '$lib/server/auth/store';
import { getLogoutUrl } from '$lib/server/auth/workos';

function safeRedirectPath(value: string | null, fallback: string): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return fallback;
	}
	return value;
}

// GET /auth/logout — safe clear (no revocation, for prefetch/crawlers)
export function GET(event: RequestEvent) {
	event.cookies.delete('synapse_session', { path: '/' });
	const returnTo = safeRedirectPath(event.url.searchParams.get('return_to'), '/');
	redirect(302, returnTo);
}

// POST /auth/logout — full logout with revocation + federated
export async function POST(event: RequestEvent) {
	const sessionId = event.locals.sessionId;

	// Read the session cookie before clearing so we can get workosSessionId
	const encryptionKey =
		(event.platform?.env as unknown as Record<string, string>)?.ENCRYPTION_KEY ??
		process.env.ENCRYPTION_KEY ??
		'';

	let workosSessionId: string | undefined;
	if (encryptionKey) {
		const { decrypt } = await import('$lib/server/auth/session');
		const cookie = event.cookies.get('synapse_session');
		if (cookie) {
			const payload = decrypt(cookie, encryptionKey);
			workosSessionId = payload?.workosSessionId;
		}
	}

	event.cookies.delete('synapse_session', { path: '/' });

	if (sessionId) {
		try {
			await revokeSession(sessionId);
		} catch (err) {
			console.error('Session revocation failed:', err);
		}
	}

	if (workosSessionId) {
		const origin = event.url.origin;
		const logoutUrl = getLogoutUrl(event, workosSessionId, `${origin}/`);
		return json({ logoutUrl });
	}

	return json({ logoutUrl: null });
}
