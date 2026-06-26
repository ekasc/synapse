import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import * as schema from './d1-schema';

export type Briefing = {
	code: string;
	name: string;
	institution: string;
	professor: string;
	rmpRating: string;
	rmpCount?: number;
	workload: string;
	weeklyHours?: string | null;
	prereqReadiness: string;
	gradeStructure: { item: string; weight: string }[];
	recommendation: string;
	sources: { description: string; url?: string; found: boolean }[];
	researchedAt: string;
};

export type CalendarEventRow = {
	id: string;
	courseCode: string;
	title: string;
	type: string;
	date: number;
	month: number;
	year: number;
	time: string | null;
	gradeWeight: number | null;
	status: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
};

function rowToBriefing(row: { [key: string]: unknown }): Briefing {
	let gradeStructure: { item: string; weight: string }[] = [];
	let sources: { description: string; url?: string; found: boolean }[] = [];

	try { gradeStructure = JSON.parse(row.gradeStructure as string); } catch {}
	try { sources = JSON.parse(row.sources as string); } catch {}

	return {
		code: String(row.code),
		name: String(row.name),
		institution: String(row.institution),
		professor: String(row.professor),
		rmpRating: String(row.rmpRating ?? 'N/A'),
		rmpCount: row.rmpCount != null ? Number(row.rmpCount) : undefined,
		workload: String(row.workload),
		weeklyHours: row.weeklyHours ? String(row.weeklyHours) : null,
		prereqReadiness: String(row.prereqReadiness ?? ''),
		gradeStructure,
		recommendation: String(row.recommendation ?? ''),
		sources,
		researchedAt: String(row.researchedAt)
	};
}

export function createDb(binding: D1Database) {
	const db = drizzle(binding, { schema });
	const ce = schema.calendarEvents;

	return {
		getBriefs: async (): Promise<Briefing[]> => {
			const rows = await db.select().from(schema.briefings).all();
			return rows.map(rowToBriefing);
		},

		getBrief: async (code: string): Promise<Briefing | undefined> => {
			const row = await db.select().from(schema.briefings)
				.where(sql`upper(${schema.briefings.code}) = upper(${code})`)
				.get();
			return row ? rowToBriefing(row) : undefined;
		},

		saveBrief: async (brief: Briefing): Promise<void> => {
			await db.insert(schema.briefings).values({
				code: brief.code, name: brief.name, institution: brief.institution,
				professor: brief.professor, rmpRating: brief.rmpRating,
				rmpCount: brief.rmpCount ?? null, workload: brief.workload,
				weeklyHours: brief.weeklyHours ?? null, prereqReadiness: brief.prereqReadiness,
				gradeStructure: JSON.stringify(brief.gradeStructure),
				recommendation: brief.recommendation, sources: JSON.stringify(brief.sources),
				researchedAt: brief.researchedAt
			}).onConflictDoUpdate({
				target: schema.briefings.code,
				set: {
					name: brief.name, institution: brief.institution, professor: brief.professor,
					rmpRating: brief.rmpRating, rmpCount: brief.rmpCount ?? null,
					workload: brief.workload, weeklyHours: brief.weeklyHours ?? null,
					prereqReadiness: brief.prereqReadiness,
					gradeStructure: JSON.stringify(brief.gradeStructure),
					recommendation: brief.recommendation, sources: JSON.stringify(brief.sources),
					researchedAt: brief.researchedAt
				}
			});
		},

		deleteBrief: async (code: string): Promise<void> => {
			await db.delete(schema.briefings).where(sql`upper(${schema.briefings.code}) = upper(${code})`);
			const jobs = await binding.prepare('SELECT cache_key FROM briefing_jobs WHERE course_code = ?').bind(code).all<{ cache_key: string }>();
			const cacheKeys = jobs.results?.map(r => r.cache_key) ?? [];
			await binding.prepare('DELETE FROM briefing_jobs WHERE course_code = ?').bind(code).run();
			for (const key of cacheKeys) {
				await binding.prepare('DELETE FROM prompt_cache WHERE cache_key = ?').bind(key).run();
			}
		},

		// ── Calendar Events CRUD ──

		getCalendarEvents: async (): Promise<CalendarEventRow[]> => {
			const rows = await db.select().from(ce).all();
			return rows.map((r: Record<string, unknown>) => ({
				id: String(r.id),
				courseCode: String(r.courseCode),
				title: String(r.title),
				type: String(r.type),
				date: Number(r.date),
				month: Number(r.month),
				year: Number(r.year),
				time: r.time ? String(r.time) : null,
				gradeWeight: r.gradeWeight != null ? Number(r.gradeWeight) : null,
				status: r.status ? String(r.status) : null,
				notes: r.notes ? String(r.notes) : null,
				createdAt: String(r.createdAt),
				updatedAt: String(r.updatedAt),
			}));
		},

		createCalendarEvent: async (ev: Omit<CalendarEventRow, 'createdAt' | 'updatedAt'>): Promise<void> => {
			const now = new Date().toISOString();
			await db.insert(ce).values({
				id: ev.id, courseCode: ev.courseCode, title: ev.title,
				type: ev.type, date: ev.date, month: ev.month, year: ev.year,
				time: ev.time ?? null, gradeWeight: ev.gradeWeight ?? null,
				status: ev.status ?? null, notes: ev.notes ?? null,
				createdAt: now, updatedAt: now,
			});
		},

		updateCalendarEvent: async (id: string, ev: Partial<Omit<CalendarEventRow, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
			const now = new Date().toISOString();
			await binding.prepare(
				'UPDATE calendar_events SET title = ?, type = ?, date = ?, month = ?, year = ?, time = ?, course_code = ?, grade_weight = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?'
			).bind(ev.title ?? '', ev.type ?? 'assignment', ev.date ?? 1, ev.month ?? 0, ev.year ?? 2026, ev.time ?? null, ev.courseCode ?? '', ev.gradeWeight ?? null, ev.status ?? null, ev.notes ?? null, now, id).run();
		},

		deleteCalendarEvent: async (id: string): Promise<void> => {
			await db.delete(ce).where(sql`${ce.id} = ${id}`);
		},
	};
}
