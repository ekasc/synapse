import { getSemesters, getCourses, getGraphState } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import { createPracticeSessionRepository } from '$lib/server/practice/sessions';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import { buildPriorityDashboard } from '$lib/dashboard/priority';
import { completePastCalendarEvents } from '$lib/server/calendar/complete-past-events';

export async function load(event) {
	const userId = event.locals.user?.id;
	if (!userId)
		return {
			semesters: [],
			courses: [],
			graph: { positions: {}, edges: [] },
			dashboardDataAvailable: false,
			...buildPriorityDashboard({
				now: new Date(),
				semesters: [],
				courses: [],
				events: [],
				practice: [],
				briefs: [],
				materials: []
			})
		};
	type ReadResult<T> = { value: T; available: boolean };
	const safe = async <T>(fallback: T, fn: () => Promise<T>): Promise<ReadResult<T>> => {
		try {
			return { value: await fn(), available: true };
		} catch {
			return { value: fallback, available: false };
		}
	};
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	// All seven reads are independent (buildPriorityDashboard is the only
	// consumer), so fetch them concurrently instead of sequentially.
	const [
		semestersRead,
		coursesRead,
		graphRead,
		eventsRead,
		briefsRead,
		practiceRead,
		materialsRead
	] = await Promise.all([
		safe([], () => getSemesters(userId)),
		safe([], () => getCourses(userId)),
		safe({ positions: {}, edges: [] }, () => getGraphState(userId)),
		binding
			? safe([], async () => {
					await completePastCalendarEvents(binding, userId);
					return createDb(binding).getCalendarEvents(userId);
				})
			: Promise.resolve({ value: [], available: false }),
		binding
			? safe([], () => createDb(binding).getBriefs())
			: Promise.resolve({ value: [], available: false }),
		binding
			? safe({ outcome: 'ok' as const, value: [] }, () =>
					createPracticeSessionRepository(binding).list(userId)
				)
			: Promise.resolve({
					value: { outcome: 'ok' as const, value: [] },
					available: false
				}),
		bucket ? safe([], () => listMaterials(bucket)) : safe([], async () => listMaterialsFallback())
	]);
	const semesters = semestersRead.value;
	const courses = coursesRead.value;
	const events = eventsRead.value;
	const briefs = briefsRead.value;
	const materials = materialsRead.value;
	const practiceResult = practiceRead.value;
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
		graph: graphRead.value,
		dashboardDataAvailable:
			semestersRead.available && coursesRead.available && eventsRead.available,
		...priority
	};
}
