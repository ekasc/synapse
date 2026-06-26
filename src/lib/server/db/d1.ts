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

/**
 * Drizzle D1 maps query results through its ORM field definitions.
 * The result object keys are the *JS property names* from the schema
 * (e.g. `gradeStructure`, `rmpRating`), not the SQL column names.
 */
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

	const briefings = schema.briefings;

	return {
		getBriefs: async (): Promise<Briefing[]> => {
			const rows = await db.select().from(briefings).all();
			return rows.map(rowToBriefing);
		},

		getBrief: async (code: string): Promise<Briefing | undefined> => {
			const row = await db.select().from(briefings)
				.where(sql`upper(${briefings.code}) = upper(${code})`)
				.get();
			return row ? rowToBriefing(row) : undefined;
		},

		saveBrief: async (brief: Briefing): Promise<void> => {
			await db.insert(briefings).values({
				code: brief.code,
				name: brief.name,
				institution: brief.institution,
				professor: brief.professor,
				rmpRating: brief.rmpRating,
				rmpCount: brief.rmpCount ?? null,
				workload: brief.workload,
				weeklyHours: brief.weeklyHours ?? null,
				prereqReadiness: brief.prereqReadiness,
				gradeStructure: JSON.stringify(brief.gradeStructure),
				recommendation: brief.recommendation,
				sources: JSON.stringify(brief.sources),
				researchedAt: brief.researchedAt
			}).onConflictDoUpdate({
				target: briefings.code,
				set: {
					name: brief.name,
					institution: brief.institution,
					professor: brief.professor,
					rmpRating: brief.rmpRating,
					rmpCount: brief.rmpCount ?? null,
					workload: brief.workload,
					weeklyHours: brief.weeklyHours ?? null,
					prereqReadiness: brief.prereqReadiness,
					gradeStructure: JSON.stringify(brief.gradeStructure),
					recommendation: brief.recommendation,
					sources: JSON.stringify(brief.sources),
					researchedAt: brief.researchedAt
				}
			});
		},

		deleteBrief: async (code: string): Promise<void> => {
			await db.delete(briefings)
				.where(sql`upper(${briefings.code}) = upper(${code})`);
			// Clean up associated jobs and cache entries
			const jobs = await binding.prepare(
				'SELECT cache_key FROM briefing_jobs WHERE course_code = ?'
			).bind(code).all<{ cache_key: string }>();
			const cacheKeys = jobs.results?.map(r => r.cache_key) ?? [];
			await binding.prepare('DELETE FROM briefing_jobs WHERE course_code = ?').bind(code).run();
			for (const key of cacheKeys) {
				await binding.prepare('DELETE FROM prompt_cache WHERE cache_key = ?').bind(key).run();
			}
		}
	};
}
