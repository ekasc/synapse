import { createDb } from '$lib/server/db/d1';
import { env } from '$env/dynamic/private';
import type { RequestEvent } from './$types';
import { toDetailViewModel, type BriefingDetailViewModel } from '$lib/server/briefing/view-model';

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

export type SelectionState = 'none' | 'selected' | 'not_found' | 'error';

export async function load(event: RequestEvent) {
	const platform = event.platform;
	const selectedCode = event.url.searchParams.get('code') || null;

	if (!platform) {
		event.setHeaders({ 'cache-control': 'private, max-age=0, must-revalidate' });
		return {
			briefs: [] as BriefingDetailViewModel[],
			selectedCode: null,
			selectedDetail: null as BriefingDetailViewModel | null,
			selectionState: 'none' as SelectionState,
			defaultModel: DEFAULT_MODEL
		};
	}

	event.setHeaders({ 'cache-control': 'private, max-age=60' });
	const db = createDb(platform.env.BRIEF_DB);
	const rows = await db.getBriefs();
	rows.sort((a, b) => b.researchedAt.localeCompare(a.researchedAt));
	const briefs = rows.map(toDetailViewModel);

	let selectedDetail: BriefingDetailViewModel | null = null;
	let selectionState: SelectionState = 'none';

	if (selectedCode) {
		try {
			const upper = selectedCode.toUpperCase();
			const match = briefs.find((b) => b.courseCode.toUpperCase() === upper);
			if (match) {
				selectedDetail = match;
				selectionState = 'selected';
			} else {
				selectionState = 'not_found';
			}
		} catch {
			selectionState = 'error';
		}
	}

	return {
		briefs,
		selectedCode,
		selectedDetail,
		selectionState,
		defaultModel: env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL
	};
}
