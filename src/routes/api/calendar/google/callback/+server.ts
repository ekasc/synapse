import { redirect, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { exchangeCodeForToken } from '$lib/server/google/calendar';
import { getGoogleToken, saveGoogleToken } from '$lib/server/store';
import type { GoogleTokenStore } from '$lib/server/store';

export async function GET(event: RequestEvent) {
	const code = event.url.searchParams.get('code');
	const error = event.url.searchParams.get('error');
	const state = event.url.searchParams.get('state');
	const savedState = event.cookies.get('google_oauth_state');

	// Clear the state cookie
	event.cookies.delete('google_oauth_state', { path: '/' });

	if (error) {
		redirect(302, '/app/calendar?google=denied');
	}

	if (!code) {
		redirect(302, '/app/calendar?google=error');
	}

	// Verify state to prevent CSRF
	if (state && savedState && state !== savedState) {
		redirect(302, '/app/calendar?google=error');
	}

	try {
		const token = await exchangeCodeForToken(code);

		const existing = getGoogleToken();
		const now = new Date().toISOString();

		const store: GoogleTokenStore = {
			id: 'google-token',
			token: {
				access_token: token.access_token,
				refresh_token: token.refresh_token,
				expiry_date: token.expiry_date,
				scope: token.scope,
			},
			connectedAt: existing?.connectedAt ?? now,
			updatedAt: now,
			calendarId: 'primary',
			calendarSummary: existing?.calendarSummary ?? 'Synapse Deadlines',
		};

		saveGoogleToken(store);
		redirect(302, '/app/calendar?google=connected');
	} catch (err) {
		console.error('Google OAuth callback error:', err);
		redirect(302, '/app/calendar?google=error');
	}
}
