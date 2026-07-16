import { createDb } from '$lib/server/db/d1';
import type { RequestEvent } from './$types';
import { toDetailViewModel, type BriefingDetailViewModel } from '$lib/server/briefing/view-model';

export type DetailState = 'found' | 'not_found' | 'error';

export async function load(event: RequestEvent) {
	const code = event.params.code;
	event.setHeaders({ 'cache-control': 'private, max-age=60' });

	if (!event.platform) {
		return {
			code,
			detail: null as BriefingDetailViewModel | null,
			state: 'not_found' as DetailState
		};
	}

	try {
		const db = createDb(event.platform.env.BRIEF_DB);
		const rows = await db.getBriefs();
		const upper = code.toUpperCase();
		const match = rows.find((r) => r.code.toUpperCase() === upper);
		if (!match) {
			return { code, detail: null, state: 'not_found' as DetailState };
		}
		return { code, detail: toDetailViewModel(match), state: 'found' as DetailState };
	} catch {
		return { code, detail: null, state: 'error' as DetailState };
	}
}
