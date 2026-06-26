import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getGoogleToken, getGoogleSyncedEvents } from '$lib/server/store';

export function GET(event: RequestEvent) {
	const stored = getGoogleToken();
	const synced = getGoogleSyncedEvents();

	if (!stored) {
		return json({ connected: false, syncedCount: 0 });
	}

	const expiresIn = Math.max(0, Math.floor((stored.token.expiry_date - Date.now()) / 1000));
	const needsReauth = expiresIn <= 0 && !stored.token.refresh_token;

	return json({
		connected: true,
		connectedAt: stored.connectedAt,
		updatedAt: stored.updatedAt,
		calendarId: stored.calendarId,
		calendarSummary: stored.calendarSummary,
		expiresIn, // seconds until access token expires
		needsReauth,
		syncedCount: synced.length,
	});
}
