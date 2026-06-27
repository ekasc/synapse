import type { Handle } from '@sveltejs/kit';
import { setStoreDb } from '$lib/server/store';

// Security response headers. Set as the first setHeaders() call so it applies
// to every response produced by the Worker, including API errors and 404s.
const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Frame-Options': 'DENY',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
	'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
};

export const handle: Handle = async ({ event, resolve }) => {
	// In production (Cloudflare Workers), make D1 available to the store.
	// In dev (no platform binding), falls back to local JSON files.
	if (event.platform?.env?.BRIEF_DB) {
		setStoreDb(event.platform.env.BRIEF_DB as D1Database);
	}
	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		// Don't overwrite headers a route explicitly set.
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};
