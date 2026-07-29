import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { getFocusPreferences, saveFocusPreferences } from '$lib/server/store';
import { parseFocusPreferences } from '$lib/server/study-timer';

export async function GET({ locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	return json(await getFocusPreferences(userId));
}

export async function PUT({ request, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	const preferences = parseFocusPreferences(await request.json());
	if (!preferences) return json({ error: 'Invalid focus preferences' }, { status: 400 });
	return json(await saveFocusPreferences(userId, preferences));
}
