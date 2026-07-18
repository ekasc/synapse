import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getFocusPreferences, saveFocusPreferences } from '$lib/server/store';
import { parseFocusPreferences } from '$lib/server/study-timer';

export async function GET() {
	return json(await getFocusPreferences());
}

export async function PUT({ request }: RequestEvent) {
	const preferences = parseFocusPreferences(await request.json());
	if (!preferences) return json({ error: 'Invalid focus preferences' }, { status: 400 });
	return json(await saveFocusPreferences(preferences));
}
