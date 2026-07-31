import { redirect } from '@sveltejs/kit';
import { getOrAssembleWeeklyDigest, updateDigestCacheProse } from '$lib/server/weekly-digest-data';
import { composeWeeklyProse } from '$lib/server/weekly-prose';
import {
	getMaterialBytes,
	getMaterialBytesFallback,
	getMaterialRecord,
	getMaterialRecordFallback
} from '$lib/server/r2';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { runBackgroundIndexing } from '$lib/server/practice/background-index';
import { createSemanticPipeline } from '$lib/server/practice/embeddings';

async function getWeeklyPlan(event: {
	platform?: App.Platform;
	forceRegenerate?: boolean;
	userId?: string;
}) {
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	const bundle = await getOrAssembleWeeklyDigest({
		userId: event.userId ?? '',
		now: new Date(),
		binding,
		bucket,
		forceRegenerate: event.forceRegenerate
	});

	if (bundle.cached) {
		return {
			...bundle,
			prose: bundle.cachedProse ?? null,
			proseModel: bundle.cachedProseModel ?? null
		};
	}

	let proseResult: { prose: string; model: string } | null = null;
	try {
		proseResult = await composeWeeklyProse(bundle.digest);
	} catch {
		// Prose is optional — digest is still valid without it.
	}

	await updateDigestCacheProse({
		userId: event.userId ?? '',
		weekStart: bundle.weekStart,
		binding,
		prose: proseResult?.prose ?? null,
		proseModel: proseResult?.model ?? null
	});

	return {
		...bundle,
		prose: proseResult?.prose ?? null,
		proseModel: proseResult?.model ?? null
	};
}

export async function load(event) {
	const userId = event.locals.user?.id ?? '';
	return getWeeklyPlan({ ...event, userId });
}

export const actions = {
	regenerate: async (event) => {
		const userId = event.locals.user?.id ?? '';
		await getWeeklyPlan({ platform: event.platform, forceRegenerate: true, userId });
		redirect(303, '/app/weekly');
	},
	indexMaterials: async (event) => {
		const userId = event.locals.user?.id;
		if (!userId) return { indexMaterials: { error: 'unauthorized' as const } };
		const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
		if (!binding) {
			return { indexMaterials: { error: 'database unavailable' as const } };
		}
		const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
		const repository = createMaterialIndexRepository(binding);
		const summary = await runBackgroundIndexing({
			repository,
			pipeline: createSemanticPipeline((event.platform?.env ?? {}) as Record<string, unknown>),
			load: async (materialId) => {
				const material = bucket
					? await getMaterialRecord(bucket, materialId)
					: getMaterialRecordFallback(materialId);
				if (!material) return null;
				const bytes = bucket
					? await getMaterialBytes(bucket, material)
					: await getMaterialBytesFallback(material);
				if (!bytes) return null;
				return { material, bytes };
			}
		});
		return { indexMaterials: { ok: true as const, ...summary } };
	}
};
