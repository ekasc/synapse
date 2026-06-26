import { createDb } from '$lib/server/db/d1';
import type { RequestEvent } from './$types';

export async function load(event: RequestEvent) {
	const platform = event.platform;
	if (!platform) return { briefs: [] };
	const db = createDb(platform.env.BRIEF_DB);
	const briefs = await db.getBriefs();
	briefs.sort((a, b) => a.code.localeCompare(b.code));
	return { briefs };
}
