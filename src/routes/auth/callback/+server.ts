import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { exchangeCode } from '$lib/server/auth/workos';
import { encrypt } from '$lib/server/auth/session';
import { findOrCreateUser, createSession } from '$lib/server/auth/store';

function safeRedirectPath(value: string | undefined, fallback: string): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return fallback;
	}
	return value;
}

export async function GET(event: RequestEvent) {
	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const error = event.url.searchParams.get('error');

	// WorkOS returned an error (user cancelled, etc.)
	if (error || !code) {
		const reason = error ?? 'missing_code';
		redirect(302, `/auth/error?reason=${reason}`);
	}

	// Validate OAuth state (CSRF protection)
	const expectedState = event.cookies.get('synapse_oauth_state');
	const redirectTo = safeRedirectPath(event.cookies.get('synapse_oauth_redirect'), '/app');
	event.cookies.delete('synapse_oauth_state', { path: '/' });
	event.cookies.delete('synapse_oauth_redirect', { path: '/' });

	if (!state || !expectedState || state !== expectedState) {
		redirect(302, '/auth/error?reason=invalid_state');
	}

	// Exchange code for WorkOS user profile
	let profile;
	try {
		profile = await exchangeCode(event, code);
	} catch (err) {
		console.error('WorkOS code exchange failed:', err);
		redirect(302, '/auth/error?reason=exchange_failed');
	}

	// Upsert local user
	const user = await findOrCreateUser({
		id: profile.id,
		email: profile.email,
		firstName: profile.firstName,
		lastName: profile.lastName
	});

	// Create session record
	const encryptionKey =
		(event.platform?.env as unknown as Record<string, string>)?.ENCRYPTION_KEY ??
		process.env.ENCRYPTION_KEY ??
		'';

	if (!encryptionKey) {
		redirect(302, '/auth/error?reason=config_error');
	}

	const session = await createSession(user.id, profile.sid);

	// Set encrypted session cookie
	const payload = encrypt(
		{ userId: user.id, sessionId: session.id, workosSessionId: profile.sid },
		encryptionKey
	);

	event.cookies.set('synapse_session', payload, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30,
		secure: !dev
	});

	redirect(302, redirectTo);
}
