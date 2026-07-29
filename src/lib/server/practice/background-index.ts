import type { MaterialRecord } from '$lib/server/r2';
import type { MaterialIndexRecord, MaterialIndexRepository } from './material-index';
import { runMaterialIndexBatch, safeExtractionError } from './indexing';
import type { SemanticPipeline } from './embeddings';

export type BackgroundIndexSummary = {
	attempted: number;
	batches: number;
	ready: number;
	failed: number;
	skipped: number;
};

export type BackgroundIndexInput = {
	repository: MaterialIndexRepository;
	load: (materialId: string) => Promise<{ material: MaterialRecord; bytes: Uint8Array } | null>;
	pipeline?: SemanticPipeline | null;
	maxMaterials?: number;
	maxBatchesPerMaterial?: number;
};

// Resumes pending/indexing materials without a browser tab. Bounded per run:
// at most maxMaterials documents, each advanced by at most maxBatchesPerMaterial
// batches, so a scheduled invocation stays well within Worker CPU limits.
export async function runBackgroundIndexing(
	input: BackgroundIndexInput
): Promise<BackgroundIndexSummary> {
	const maxMaterials = input.maxMaterials ?? 4;
	const maxBatches = input.maxBatchesPerMaterial ?? 3;
	const queued = await input.repository.listIndexable(maxMaterials);
	const summary: BackgroundIndexSummary = {
		attempted: queued.length,
		batches: 0,
		ready: 0,
		failed: 0,
		skipped: 0
	};

	for (const record of queued) {
		const loaded = await input.load(record.materialId);
		if (!loaded) {
			summary.skipped += 1;
			continue;
		}
		let current: MaterialIndexRecord = record;
		try {
			for (let batch = 0; batch < maxBatches; batch += 1) {
				current = await runMaterialIndexBatch({
					repository: input.repository,
					userId: record.userId,
					material: loaded.material,
					bytes: loaded.bytes,
					pipeline: input.pipeline ?? null
				});
				summary.batches += 1;
				if (current.status !== 'indexing') break;
			}
			if (current.status === 'ready') summary.ready += 1;
			else if (current.status === 'failed') summary.failed += 1;
		} catch (cause) {
			summary.failed += 1;
			try {
				await input.repository.setStatus(
					record.userId,
					record.materialId,
					record.courseId,
					'failed',
					{ errorMessage: safeExtractionError(cause) }
				);
			} catch {
				// Keep the last successful checkpoint; the manual retry stays available.
			}
		}
	}

	return summary;
}
