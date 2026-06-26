import { env } from '$env/dynamic/private';

// ── Types ──

export type GoogleToken = {
	access_token: string;
	refresh_token: string;
	expiry_date: number; // Unix ms
	scope: string;
};

export type GoogleCalendarEvent = {
	id: string;
	summary: string;
	description?: string;
	start: { date?: string; dateTime?: string; timeZone?: string };
	end: { date?: string; dateTime?: string; timeZone?: string };
	htmlLink?: string;
	status?: string;
	colorId?: string;
	extendedProperties?: Record<string, Record<string, string>>;
};

export type SyncedEvent = {
	id: string; // internal deadline id
	googleEventId: string;
	calendarId: string; // 'primary' or calendar id
	lastSyncedAt: string;
};

type TokenResponse = {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	scope: string;
};

type CalendarResponse<T> = {
	items?: T[];
	error?: { message: string };
};

const SCOPES = [
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events',
].join(' ');

// ── OAuth URLs ──

export function getAuthUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID,
		redirect_uri: env.GOOGLE_REDIRECT_URI,
		response_type: 'code',
		scope: SCOPES,
		access_type: 'offline',
		prompt: 'consent',
		state,
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Token Operations ──

export async function exchangeCodeForToken(code: string): Promise<GoogleToken> {
	const resp = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			redirect_uri: env.GOOGLE_REDIRECT_URI,
			grant_type: 'authorization_code',
		}).toString(),
	});

	if (!resp.ok) {
		const err = await resp.text();
		throw new Error(`Token exchange failed: ${resp.status} ${err}`);
	}

	const data = (await resp.json()) as TokenResponse;
	if (!data.refresh_token) {
		throw new Error('No refresh_token returned. Ensure "access_type: offline" and "prompt: consent" are set.');
	}

	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expiry_date: Date.now() + data.expires_in * 1000,
		scope: data.scope,
	};
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleToken> {
	const resp = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			refresh_token: refreshToken,
			grant_type: 'refresh_token',
		}).toString(),
	});

	if (!resp.ok) {
		const err = await resp.text();
		throw new Error(`Token refresh failed: ${resp.status} ${err}`);
	}

	const data = (await resp.json()) as TokenResponse;
	return {
		access_token: data.access_token,
		refresh_token: refreshToken, // keep original refresh token
		expiry_date: Date.now() + data.expires_in * 1000,
		scope: data.scope ?? '',
	};
}

export async function getValidAccessToken(token: GoogleToken): Promise<string> {
	if (Date.now() < token.expiry_date - 60_000) {
		return token.access_token;
	}
	const refreshed = await refreshAccessToken(token.refresh_token);
	return refreshed.access_token;
}

// ── Calendar API ──

export type CalendarListEntry = {
	id: string;
	summary: string;
	primary?: boolean;
	accessRole?: string;
};

export async function listCalendars(accessToken: string): Promise<CalendarListEntry[]> {
	const resp = await fetch(
		'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!resp.ok) throw new Error(`Failed to list calendars: ${resp.status}`);
	const data = (await resp.json()) as CalendarResponse<CalendarListEntry>;
	return data.items ?? [];
}

export async function listEvents(
	accessToken: string,
	calendarId = 'primary',
	opts: { timeMin?: string; timeMax?: string; maxResults?: number } = {},
): Promise<GoogleCalendarEvent[]> {
	const params = new URLSearchParams({
		singleEvents: 'true',
		orderBy: 'startTime',
		...(opts.maxResults ? { maxResults: String(opts.maxResults) } : {}),
		...(opts.timeMin ? { timeMin: opts.timeMin } : {}),
		...(opts.timeMax ? { timeMax: opts.timeMax } : {}),
	});

	const resp = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!resp.ok) throw new Error(`Failed to list events: ${resp.status}`);
	const data = (await resp.json()) as CalendarResponse<GoogleCalendarEvent>;
	return data.items ?? [];
}

export async function createEvent(
	accessToken: string,
	event: Omit<GoogleCalendarEvent, 'id' | 'htmlLink' | 'status'>,
	calendarId = 'primary',
): Promise<GoogleCalendarEvent> {
	const resp = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(event),
		},
	);

	if (!resp.ok) {
		const err = await resp.text();
		throw new Error(`Failed to create event: ${resp.status} ${err}`);
	}

	return resp.json() as Promise<GoogleCalendarEvent>;
}

export async function updateEvent(
	accessToken: string,
	eventId: string,
	event: Partial<Omit<GoogleCalendarEvent, 'id' | 'htmlLink' | 'status'>>,
	calendarId = 'primary',
): Promise<GoogleCalendarEvent> {
	const resp = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
		{
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(event),
		},
	);

	if (!resp.ok) {
		const err = await resp.text();
		throw new Error(`Failed to update event: ${resp.status} ${err}`);
	}

	return resp.json() as Promise<GoogleCalendarEvent>;
}

export async function deleteEvent(
	accessToken: string,
	eventId: string,
	calendarId = 'primary',
): Promise<void> {
	const resp = await fetch(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
		{ method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
	);

	if (!resp.ok && resp.status !== 410) {
		const err = await resp.text();
		throw new Error(`Failed to delete event: ${resp.status} ${err}`);
	}
}

// ── Revoke ──

export async function revokeToken(refreshToken: string): Promise<void> {
	await fetch('https://oauth2.googleapis.com/revoke', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ token: refreshToken }).toString(),
	});
}
