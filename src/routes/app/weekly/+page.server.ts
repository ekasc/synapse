import { assembleWeeklyDigest } from '$lib/server/weekly-digest-data';
import { composeWeeklyProse } from '$lib/server/weekly-prose';

export async function load(event) {
	const bundle = await assembleWeeklyDigest({
		now: new Date(),
		binding: event.platform?.env?.BRIEF_DB as D1Database | undefined,
		bucket: event.platform?.env?.MATERIALS as R2Bucket | undefined
	});
	let prose: { prose: string; model: string } | null;
	try {
		prose = await composeWeeklyProse(bundle.digest);
	} catch {
		prose = null;
	}
	return {
		...bundle,
		prose: prose?.prose ?? null,
		proseModel: prose?.model ?? null
	};
}
