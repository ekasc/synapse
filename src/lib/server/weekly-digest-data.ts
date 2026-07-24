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

export type CachedWeeklyDigestBundle = WeeklyDigestBundle & {
	cached: boolean;
	isSunday: boolean;
	/** Cache key (Monday of the week as YYYY-MM-DD) — used to update with prose later. */
	weekStart: string;
	/** Cached AI prose (only present when serving from cache). */
	cachedProse?: string | null;
	cachedProseModel?: string | null;
};

/** Cache payload stored in D1 — bundle + optional prose. */
interface CachePayload {
	bundle: WeeklyDigestBundle;
	prose?: string | null;
	proseModel?: string | null;
}

const dateKey = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Returns the local Sunday that starts the week containing `date`. */
export function startOfWeeklyPlan(date: Date): Date {
	const sunday = new Date(date);
	sunday.setHours(0, 0, 0, 0);
	sunday.setDate(sunday.getDate() - sunday.getDay());
	return sunday;
}

export function weeklyPlanKey(date: Date): string {
	return dateKey(startOfWeeklyPlan(date));
}

/**
 * Assembles or retrieves a cached weekly digest. Regenerates on Sunday,
 * on cache miss, or when `forceRegenerate` is true. Writes through to
 * D1 when a binding is available (without prose — callers should call
 * `updateDigestCacheProse` after generating prose separately).
 */
export async function getOrAssembleWeeklyDigest(input: {
	now: Date;
	binding?: D1Database;
	bucket?: R2Bucket;
	forceRegenerate?: boolean;
}): Promise<CachedWeeklyDigestBundle> {
	const weekStart = weeklyPlanKey(input.now);
	const isSunday = input.now.getDay() === 0;
	const shouldUseCache = !input.forceRegenerate && !!input.binding;

	if (shouldUseCache) {
		try {
			const db = createDb(input.binding!);
			const cached = await db.getWeeklyDigestCache(weekStart);
			if (cached) {
				const payload = JSON.parse(cached) as CachePayload;
				return {
					...payload.bundle,
					cached: true,
					isSunday,
					weekStart,
					cachedProse: payload.prose ?? null,
					cachedProseModel: payload.proseModel ?? null
				};
			}
		} catch {
			// Cache read failed — fall through to fresh generation.
		}
	}

	const bundle = await assembleWeeklyDigest({
		now: input.now,
		binding: input.binding,
		bucket: input.bucket
	});

	// Write through to cache (without prose — caller adds prose later).
	if (input.binding) {
		try {
			const db = createDb(input.binding);
			const payload: CachePayload = { bundle };
			await db.setWeeklyDigestCache(weekStart, JSON.stringify(payload));
		} catch {
			// Cache write failed — non-fatal, just serve fresh.
		}
	}

	return { ...bundle, cached: false, isSunday, weekStart };
}

/**
 * Updates an existing cache entry with AI prose. No-op if the binding is
 * unavailable. Failures are silently ignored (prose is optional).
 */
export async function updateDigestCacheProse(input: {
	weekStart: string;
	binding?: D1Database;
	prose: string | null;
	proseModel: string | null;
}): Promise<void> {
	if (!input.binding) return;
	try {
		const db = createDb(input.binding);
		const cached = await db.getWeeklyDigestCache(input.weekStart);
		if (!cached) return;
		const payload = JSON.parse(cached) as CachePayload;
		payload.prose = input.prose;
		payload.proseModel = input.proseModel;
		await db.setWeeklyDigestCache(input.weekStart, JSON.stringify(payload));
	} catch {
		// Non-fatal.
	}
}

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
