import { getSemesters, getCourses, getGraphState } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import { createPracticeSessionRepository } from '$lib/server/practice/sessions';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import { buildPriorityDashboard } from '$lib/dashboard/priority';

export async function load(event) {
	const safe = async <T>(fallback: T, fn: () => Promise<T>): Promise<T> => {
		try {
			return await fn();
		} catch {
			return fallback;
		}
	};
	const semesters = await safe([], () => getSemesters());
	const courses = await safe([], () => getCourses());
	const graph = await safe({ positions: {}, edges: [] }, () => getGraphState());
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	const events = binding ? await safe([], () => createDb(binding).getCalendarEvents()) : [];
	const briefs = binding ? await safe([], () => createDb(binding).getBriefs()) : [];
	const practiceResult = binding
		? await safe({ outcome: 'ok' as const, value: [] }, () =>
				createPracticeSessionRepository(binding).list()
			)
		: { outcome: 'ok' as const, value: [] };
	const practice = practiceResult.outcome === 'ok' ? practiceResult.value : [];
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	const materials = bucket
		? await safe([], () => listMaterials(bucket))
		: safe([], async () => listMaterialsFallback());
	const priority = buildPriorityDashboard({
		now: new Date(),
		semesters,
		courses,
		events,
		practice,
		briefs,
		materials: await materials
	});
	return {
		semesters: semesters.slice().sort((a, b) => b.order - a.order),
		courses,
		graph,
		...priority
	};
}
