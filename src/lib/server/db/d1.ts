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
	sources: {
		description: string;
		url?: string;
		found: boolean;
		id?: string;
		title?: string;
		sourceType?: string;
		currentness?: string;
	}[];
	researchedAt: string;
	modelUsed: string;
	schemaVersion: number;
	currentOrHistorical?: string;
	officialPrerequisites?: string[];
	instructorVerification?: { status?: string; detail?: string } | string;
	assessmentBasis?: string;
	workloadBasis?: string;
	contradictions?: string[];
	missingEvidence?: string[];
	searches?: number | { query: string; status?: string }[];
	cost?: number | string;
	currency?: string;
	modelPolicy?: string;
	summary?: string;
	prerequisites?: string;
	usage?: {
		inputTokens: number;
		outputTokens: number;
		searchRequests: number;
		costMicrodollars: number;
	};
	identity?: {
		courseCode?: string;
		title?: string;
		institution?: string;
		officialDomain?: string;
		term?: string;
	};
	instructor?: {
		requestedName?: string;
		name?: string;
		status?: string;
		detail?: string;
	};
	sections?: { id?: string; title?: string; content?: string; claims?: string[] }[];
	claims?: {
		id?: string;
		text: string;
		sourceIds: string[];
		sourceType?: string;
		basis?: string;
		section?: string;
	}[];
	v4Report?: Record<string, unknown>;
};

export type CalendarEventRow = {
	id: string;
	courseId: string | null;
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

function parseJsonField<T>(value: unknown, fallback: T): T {
	try {
		return JSON.parse(String(value)) as T;
	} catch {
		return fallback;
	}
}

function jsonObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function v4ReportSection(raw: unknown): { text: string; sourceIds: string[] } {
	const obj = jsonObject(raw);
	return {
		text: String(obj.text ?? ''),
		sourceIds: Array.isArray(obj.sourceIds) ? obj.sourceIds.map(String) : []
	};
}

function rowToBriefing(row: { [key: string]: unknown }): Briefing {
	if (row.briefingJson) {
		const parsed = parseJsonField<Record<string, unknown> | null>(row.briefingJson, null);
		if (parsed?.schemaVersion != null && Number(parsed.schemaVersion) >= 4 && parsed.identity) {
			const identity = jsonObject(parsed.identity);
			const instructor = jsonObject(parsed.instructor);
			const v4Sources = Array.isArray(parsed.sources) ? parsed.sources.map(jsonObject) : [];
			const claims = Array.isArray(parsed.claims) ? parsed.claims.map(jsonObject) : [];
			const v4Usage = jsonObject(parsed.usage ?? parsed.usage);
			const v4Summary = v4ReportSection(parsed.summary);
			const v4Prereqs = v4ReportSection(parsed.prerequisites);
			const v4Workload = v4ReportSection(parsed.workload);
			const v4Rmp = v4ReportSection(parsed.rateMyProfessors);
			const v4Contradictions = v4ReportSection(parsed.contradictions);
			const v4Missing = v4ReportSection(parsed.missing);
			const sectionNames = [
				'description',
				'credits',
				'prerequisites',
				'corequisites',
				'delivery',
				'assessments',
				'workload',
				'rateMyProfessors',
				'contradictions',
				'missing',
				'summary'
			];
			return {
				code: String(identity.code ?? ''),
				name: String(identity.name ?? ''),
				institution: String(identity.institution ?? ''),
				professor: String(instructor.requestedName ?? 'Not requested'),
				rmpRating: v4Rmp.text || 'N/A',
				rmpCount: instructor.rmpCount != null ? Number(instructor.rmpCount) : undefined,
				workload: v4Workload.text || 'Not verified',
				weeklyHours: parsed.weeklyHours ? String(parsed.weeklyHours) : null,
				prereqReadiness: '',
				gradeStructure: [],
				recommendation: v4Summary.text || 'No verified summary available',
				sources: v4Sources.map((s) => ({
					id: String(s.id ?? ''),
					description: String(s.title ?? s.excerpt ?? ''),
					title: String(s.title ?? ''),
					url: String(s.url ?? ''),
					found: s.retrievalStatus !== 'unavailable',
					sourceType: String(s.sourceType ?? 'other'),
					currentness: String(s.currentness ?? 'unknown')
				})),
				researchedAt: String(parsed.researchedAt ?? ''),
				modelUsed: String(parsed.modelUsed ?? ''),
				schemaVersion: 4,
				currentOrHistorical: v4Sources.some((s) => s.currentness === 'historical')
					? v4Sources.some((s) => s.currentness === 'current')
						? 'mixed'
						: 'historical'
					: 'current',
				officialPrerequisites: [],
				instructorVerification: undefined,
				instructor: {
					requestedName: String(instructor.requestedName ?? ''),
					name: String(instructor.name ?? ''),
					status: String(instructor.status ?? 'not_verified'),
					detail: String(instructor.detail ?? '')
				},
				assessmentBasis: undefined,
				workloadBasis: undefined,
				contradictions: v4Contradictions.text ? [v4Contradictions.text] : [],
				missingEvidence: v4Missing.text ? [v4Missing.text] : [],
				searches: Number(v4Usage.searchRequests ?? 0),
				cost: String((Number(v4Usage.costMicrodollars ?? 0) / 1_000_000).toFixed(4)),
				currency: 'USD',
				modelPolicy: String(parsed.synthesisModel ?? parsed.modelUsed ?? ''),
				summary: v4Summary.text || undefined,
				prerequisites: v4Prereqs.text || undefined,
				usage: {
					inputTokens: Number(v4Usage.inputTokens ?? 0),
					outputTokens: Number(v4Usage.outputTokens ?? 0),
					searchRequests: Number(v4Usage.searchRequests ?? 0),
					costMicrodollars: Number(v4Usage.costMicrodollars ?? 0)
				},
				identity: {
					courseCode: String(identity.code ?? ''),
					title: String(identity.name ?? ''),
					institution: String(identity.institution ?? ''),
					officialDomain: String(identity.officialDomain ?? ''),
					term: String(identity.term ?? '')
				},
				claims: claims.map((claim) => ({
					id: String(claim.id ?? ''),
					text: String(claim.text ?? ''),
					sourceIds: Array.isArray(claim.sourceIds) ? claim.sourceIds.map(String) : [],
					sourceType: String(claim.sourceType ?? ''),
					basis: String(claim.status ?? '').replace('verified_', ''),
					section: String(claim.section ?? '')
				})),
				sections: sectionNames
					.map((name) => {
						const sec = v4ReportSection(parsed[name]);
						return {
							id: name,
							title: name === 'rateMyProfessors' ? 'Professor reviews' : name,
							content: sec.text,
							claims: []
						};
					})
					.filter((section) => section.content || section.claims.length),
				v4Report: parsed
			};
		}
		if (parsed) return parsed as unknown as Briefing;
	}
	const gradeStructure = parseJsonField<{ item: string; weight: string }[]>(row.gradeStructure, []);
	const sources = parseJsonField<{ description: string; url?: string; found: boolean }[]>(
		row.sources,
		[]
	);

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
		researchedAt: String(row.researchedAt),
		modelUsed: String(row.modelUsed ?? 'deepseek/deepseek-v4-flash'),
		schemaVersion: Number(row.schemaVersion ?? 1)
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
			const row = await db
				.select()
				.from(schema.briefings)
				.where(sql`upper(${schema.briefings.code}) = upper(${code})`)
				.get();
			return row ? rowToBriefing(row) : undefined;
		},

		saveBrief: async (brief: Briefing): Promise<void> => {
			await db
				.insert(schema.briefings)
				.values({
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
					researchedAt: brief.researchedAt,
					modelUsed: brief.modelUsed,
					schemaVersion: brief.schemaVersion
				})
				.onConflictDoUpdate({
					target: schema.briefings.code,
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
						researchedAt: brief.researchedAt,
						modelUsed: brief.modelUsed,
						schemaVersion: brief.schemaVersion
					}
				});
		},

		deleteBrief: async (code: string): Promise<void> => {
			await db
				.delete(schema.briefings)
				.where(sql`upper(${schema.briefings.code}) = upper(${code})`);
			const jobs = await binding
				.prepare('SELECT cache_key FROM briefing_jobs WHERE course_code = ?')
				.bind(code)
				.all<{ cache_key: string }>();
			const cacheKeys = jobs.results?.map((r) => r.cache_key) ?? [];
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
				courseId: r.courseId ? String(r.courseId) : null,
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
				updatedAt: String(r.updatedAt)
			}));
		},

		createCalendarEvent: async (
			ev: Omit<CalendarEventRow, 'createdAt' | 'updatedAt'>
		): Promise<void> => {
			const now = new Date().toISOString();
			await db.insert(ce).values({
				id: ev.id,
				courseId: ev.courseId ?? null,
				courseCode: ev.courseCode,
				title: ev.title,
				type: ev.type,
				date: ev.date,
				month: ev.month,
				year: ev.year,
				time: ev.time ?? null,
				gradeWeight: ev.gradeWeight ?? null,
				status: ev.status ?? null,
				notes: ev.notes ?? null,
				createdAt: now,
				updatedAt: now
			});
		},

		updateCalendarEvent: async (
			id: string,
			ev: Partial<Omit<CalendarEventRow, 'id' | 'createdAt' | 'updatedAt'>>
		): Promise<void> => {
			const now = new Date().toISOString();
			await binding
				.prepare(
					'UPDATE calendar_events SET title = ?, type = ?, date = ?, month = ?, year = ?, time = ?, course_code = ?, grade_weight = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?'
				)
				.bind(
					ev.title ?? '',
					ev.type ?? 'assignment',
					ev.date ?? 1,
					ev.month ?? 0,
					ev.year ?? 2026,
					ev.time ?? null,
					ev.courseCode ?? '',
					ev.gradeWeight ?? null,
					ev.status ?? null,
					ev.notes ?? null,
					now,
					id
				)
				.run();
		},

		deleteCalendarEvent: async (id: string): Promise<void> => {
			await db.delete(ce).where(sql`${ce.id} = ${id}`);
		}
	};
}
