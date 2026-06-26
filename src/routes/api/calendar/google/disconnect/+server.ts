import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getGoogleToken, deleteGoogleToken, clearGoogleSyncedEvents } from '$lib/server/store';
import { revokeToken } from '$lib/server/google/calendar';

export async function POST(event: RequestEvent) {
	try {
		const stored = getGoogleToken();
		if (stored) {
			// Attempt to revoke — best-effort
			try {
				await revokeToken(stored.token.refresh_token);
			} catch {
				// Revocation is best-effort
			}
		}

		deleteGoogleToken();
		clearGoogleSyncedEvents();

		return json({ ok: true });
	} catch (err) {
		console.error('Google disconnect error:', err);
		return json({ ok: false, error: 'Failed to disconnect' }, { status: 500 });
	}
}
