import { createDb } from '$lib/server/db/d1';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from './$types';

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

export async function load(event: RequestEvent) {
	const platform = event.platform;
	if (!platform) {
		event.setHeaders({ 'cache-control': 'private, max-age=0, must-revalidate' });
		return { briefs: [], defaultModel: DEFAULT_MODEL };
	}
	event.setHeaders({ 'cache-control': 'private, max-age=60' });
	const db = createDb(platform.env.BRIEF_DB);
	const briefs = await db.getBriefs();
	briefs.sort((a, b) => a.code.localeCompare(b.code));
	return {
		briefs,
		defaultModel: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL
	};
}
