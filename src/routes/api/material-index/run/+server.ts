import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	getMaterialBytes,
	getMaterialBytesFallback,
	getMaterialRecord,
	getMaterialRecordFallback
} from '$lib/server/r2';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { runBackgroundIndexing } from '$lib/server/practice/background-index';
import { createSemanticPipeline } from '$lib/server/practice/embeddings';

// Resumes pending/indexing material indexes for the calling user. Triggered
// ad hoc from the weekly plan page (no longer a cron) so the user doesn't
// need to keep the browser tab open after uploading a PDF.
export async function POST(event: RequestEvent) {
	const userId = event.locals.user?.id;
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	if (!binding) {
		return json({ error: 'database unavailable' }, { status: 503 });
	}
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	const repository = createMaterialIndexRepository(binding);
	const summary = await runBackgroundIndexing({
		repository,
		pipeline: createSemanticPipeline(event.platform?.env ?? {}),
		load: async (materialId) => {
			const material = bucket
				? await getMaterialRecord(bucket, materialId)
				: getMaterialRecordFallback(materialId);
			if (!material) return null;
			const bytes = bucket
				? await getMaterialBytes(bucket, material)
				: getMaterialBytesFallback(material);
			if (!bytes) return null;
			return { material, bytes };
		}
	});
	return json({ ok: true, ...summary });
}
