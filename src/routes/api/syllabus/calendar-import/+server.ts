import { json, type RequestEvent } from '@sveltejs/kit';
import { getCourses, getSemesters, getSyllabusImport } from '$lib/server/store';
import { prepareSyllabusEvents } from '$lib/calendar/syllabus-sync';

async function sha256(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toCalendarType(type: string, label: string): string {
	if (type === 'quiz') return 'quiz';
	if (type === 'exam') {
		const lower = label.toLowerCase();
		return lower.includes('final') ? 'final' : 'midterm';
	}
	return 'assignment';
}

export async function POST({ request, platform, locals }: RequestEvent) {
	if (!platform) return json({ ok: false, error: 'Platform unavailable' }, { status: 500 });
	const userId = locals.user?.id;
	if (!userId) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : '';
	const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
	if (!courseId || !idempotencyKey || idempotencyKey.length > 160) {
		return json({ ok: false, error: 'courseId and idempotencyKey are required' }, { status: 400 });
	}

	const [course, semesters, syllabus] = await Promise.all([
		getCourses(userId).then((courses) => courses.find((candidate) => candidate.id === courseId)),
		getSemesters(userId),
		getSyllabusImport(userId, courseId)
	]);
	if (!course) return json({ ok: false, error: 'Course not found' }, { status: 404 });
	const courseSemester = semesters.find((candidate) => candidate.id === course.semesterId);
	if (!courseSemester)
		return json({ ok: false, error: 'Course semester not found' }, { status: 422 });
	if (!syllabus) return json({ ok: false, error: 'No syllabus extraction found' }, { status: 404 });

	const sourceHash = await sha256(syllabus.rawText);
	const db = platform.env.BRIEF_DB;
	const importId = crypto.randomUUID();
	const now = new Date().toISOString();
	const claim = await db
		.prepare(
			`INSERT OR IGNORE INTO syllabus_calendar_imports
		(id, user_id, course_id, syllabus_import_id, idempotency_key, source_hash, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`
		)
		.bind(importId, userId, courseId, syllabus.id, idempotencyKey, sourceHash, now, now)
		.run();
	if (!claim.meta.changes) {
		const prior = await db
			.prepare(
				`SELECT id, source_hash, result_json FROM syllabus_calendar_imports
			 WHERE course_id = ? AND idempotency_key = ?`
			)
			.bind(courseId, idempotencyKey)
			.first<{ id: string; source_hash: string; result_json: string | null }>();
		if (prior?.source_hash !== sourceHash) {
			return json(
				{ ok: false, error: 'Idempotency key was already used for different syllabus data' },
				{ status: 409 }
			);
		}
		return json(
			prior?.result_json
				? { ...JSON.parse(prior.result_json), replayed: true }
				: { ok: true, importId: prior?.id, replayed: true }
		);
	}

	const prepared = prepareSyllabusEvents({
		courseId,
		semesterYear: courseSemester.year,
		rows: syllabus.extractedData.dates,
		toCalendarType
	});
	let inserted = 0;
	let duplicates = prepared.skippedDuplicate;
	for (const event of prepared.events) {
		const result = await db
			.prepare(
				`INSERT OR IGNORE INTO calendar_events
			(id, user_id, course_id, course_code, title, type, date, month, year, time,
			 grade_weight, status, notes, origin, source_key, source_import_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pending', NULL, 'syllabus', ?, ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				userId,
				courseId,
				course.code,
				event.title,
				event.type,
				event.date,
				event.month,
				event.year,
				null,
				event.fingerprint,
				syllabus.id,
				now,
				now
			)
			.run();
		if (result.meta.changes) inserted++;
		else duplicates++;
	}
	const result = {
		ok: true,
		importId,
		replayed: false,
		inserted,
		updated: 0,
		unchanged: duplicates,
		removed: 0,
		old: prepared.skippedOld,
		needsReview: syllabus.extractedData.dates.filter((date) => date.needsReview).length,
		invalid: prepared.invalid,
		inputDuplicates: prepared.skippedDuplicate
	};
	await db
		.prepare(`UPDATE syllabus_calendar_imports SET result_json = ?, updated_at = ? WHERE id = ?`)
		.bind(JSON.stringify(result), new Date().toISOString(), importId)
		.run();
	return json(result);
}
