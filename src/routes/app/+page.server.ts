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
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	// All seven reads are independent (buildPriorityDashboard is the only
	// consumer), so fetch them concurrently instead of sequentially.
	const [semesters, courses, graph, events, briefs, practiceResult, materials] = await Promise.all([
		safe([], () => getSemesters()),
		safe([], () => getCourses()),
		safe({ positions: {}, edges: [] }, () => getGraphState()),
		binding ? safe([], () => createDb(binding).getCalendarEvents()) : Promise.resolve([]),
		binding ? safe([], () => createDb(binding).getBriefs()) : Promise.resolve([]),
		binding
			? safe({ outcome: 'ok' as const, value: [] }, () =>
					createPracticeSessionRepository(binding).list()
				)
			: Promise.resolve({ outcome: 'ok' as const, value: [] }),
		bucket ? safe([], () => listMaterials(bucket)) : safe([], async () => listMaterialsFallback())
	]);
	const practice = practiceResult.outcome === 'ok' ? practiceResult.value : [];
	const priority = buildPriorityDashboard({
		now: new Date(),
		semesters,
		courses,
		events,
		practice,
		briefs,
		materials
	});
	return {
		semesters: semesters.slice().sort((a, b) => b.order - a.order),
		courses,
		graph,
		...priority
	};
}
