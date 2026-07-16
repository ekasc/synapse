import { createDb } from '$lib/server/db/d1';
import type { RequestEvent } from './$types';
import { toDetailViewModel, type BriefingDetailViewModel } from '$lib/server/briefing/view-model';

export async function load(event: RequestEvent) {
	event.setHeaders({ 'cache-control': 'private, max-age=60' });

	if (!event.platform) {
		return { briefs: [] as BriefingDetailViewModel[] };
	}

	const db = createDb(event.platform.env.BRIEF_DB);
	const rows = await db.getBriefs();
	rows.sort((a, b) => b.researchedAt.localeCompare(a.researchedAt));
	const briefs = rows.map(toDetailViewModel);

	return { briefs };
}
