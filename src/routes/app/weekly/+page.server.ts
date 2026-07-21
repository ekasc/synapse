import { getCourses, getGraphState, getSemesters, getStudySessions } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import { createPracticeSessionRepository } from '$lib/server/practice/sessions';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import { buildWeeklyDigest } from '$lib/dashboard/weekly';
import { composeWeeklyProse } from '$lib/server/weekly-prose';

export async function load(event) {
	const degraded: string[] = [];
	const safe = async <T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> => {
		try {
			return await fn();
		} catch {
			if (!degraded.includes(label)) degraded.push(label);
			return fallback;
		}
	};
	const semesters = await safe('semesters', [], () => getSemesters());
	const courses = await safe('courses', [], () => getCourses());
	const graph = await safe('course map', { positions: {}, edges: [] }, () => getGraphState());
	const studySessions = await safe('study sessions', [], () => getStudySessions(100));
	const binding = event.platform?.env?.BRIEF_DB as D1Database | undefined;
	const calendarEvents = binding
		? await safe('calendar', [], () => createDb(binding).getCalendarEvents())
		: [];
	const briefings = binding
		? await safe('course briefs', [], () => createDb(binding).getBriefs())
		: [];
	const practiceResult = binding
		? await safe('practice sessions', { outcome: 'ok' as const, value: [] }, () =>
				createPracticeSessionRepository(binding).list()
			)
		: { outcome: 'ok' as const, value: [] };
	const practiceSessions = practiceResult.outcome === 'ok' ? practiceResult.value : [];
	const bucket = event.platform?.env?.MATERIALS as R2Bucket | undefined;
	const materials = bucket
		? await safe('materials', [], () => listMaterials(bucket))
		: await safe('materials', [], async () => listMaterialsFallback());
	const materialIndexes = binding
		? (
				await Promise.all(
					courses.map((course) =>
						safe('material indexes', [], () =>
							createMaterialIndexRepository(binding).list(course.id)
						)
					)
				)
			).flat()
		: [];
	const digest = buildWeeklyDigest({
		now: new Date(),
		courses,
		semesters,
		courseGraph: graph,
		calendarEvents,
		practiceSessions,
		studySessions,
		materials,
		materialIndexes,
		briefings
	});
	const prose = await safe('ai summary', null, () => composeWeeklyProse(digest));
	return {
		digest,
		degraded,
		hasCourses: courses.length > 0,
		prose: prose?.prose ?? null,
		proseModel: prose?.model ?? null
	};
}
