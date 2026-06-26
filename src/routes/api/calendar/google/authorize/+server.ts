import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getAuthUrl } from '$lib/server/google/calendar';

export function GET(event: RequestEvent) {
	// Use a simple state param to prevent CSRF
	const state = crypto.randomUUID();
	// Store state in a cookie for verification
	event.cookies.set('google_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 10, // 10 minutes
	});

	const url = getAuthUrl(state);
	redirect(302, url);
}
