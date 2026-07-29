import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getAuthorizationUrl, randomState } from '$lib/server/auth/workos';

function safeRedirectPath(value: string | null, fallback: string): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return fallback;
	}
	return value;
}

export function GET(event: RequestEvent) {
	const redirectTo = safeRedirectPath(event.url.searchParams.get('redirect_url'), '/app');
	const state = randomState();

	event.cookies.set('synapse_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600,
		secure: !dev
	});

	if (redirectTo !== '/app') {
		event.cookies.set('synapse_oauth_redirect', redirectTo, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600,
			secure: !dev
		});
	}

	const authUrl = getAuthorizationUrl(event, state);
	redirect(302, authUrl);
}
