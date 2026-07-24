import { redirect } from '@sveltejs/kit';
import { getOrAssembleWeeklyDigest, updateDigestCacheProse } from '$lib/server/weekly-digest-data';
import { composeWeeklyProse } from '$lib/server/weekly-prose';

async function getWeeklyPlan(event: { platform?: App.Platform; forceRegenerate?: boolean }) {
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	const bundle = await getOrAssembleWeeklyDigest({
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
	return getWeeklyPlan(event);
}

export const actions = {
	regenerate: async (event) => {
		await getWeeklyPlan({ platform: event.platform, forceRegenerate: true });
		redirect(303, '/app/weekly');
	}
};
