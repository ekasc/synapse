import { getCourses, getGraphState, getSemesters, getStudySessions } from '$lib/server/store';
import { createDb } from '$lib/server/db/d1';
import { createPracticeSessionRepository } from '$lib/server/practice/sessions';
import { createMaterialIndexRepository } from '$lib/server/practice/material-index';
import { listMaterials, listMaterialsFallback } from '$lib/server/r2';
import { buildWeeklyDigest, type WeeklyDigest } from '$lib/dashboard/weekly';

export type WeeklyDigestBundle = {
	digest: WeeklyDigest;
	degraded: string[];
	hasCourses: boolean;
};

/**
 * Assembles the weekly digest from every live data source. Shared by the
 * `/app/weekly` page load and the scheduled push handler so both surfaces
 * plan from identical inputs. Each source degrades independently.
 */
export async function assembleWeeklyDigest(input: {
	now: Date;
	binding?: D1Database;
	bucket?: R2Bucket;
}): Promise<WeeklyDigestBundle> {
	const { binding, bucket } = input;
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
		now: input.now,
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
	return { digest, degraded, hasCourses: courses.length > 0 };
}
