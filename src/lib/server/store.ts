import fs from 'node:fs';
import path from 'node:path';

// ── D1 binding set by hooks on every request ──

let _d1: D1Database | null = null;

export function setStoreDb(d1: D1Database | null): void {
	_d1 = d1;
}

// ── Local filesystem fallback (dev) ──

const DATA_DIR = path.resolve('.data');

function ensureDir() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read<T>(name: string): T[] {
	ensureDir();
	const file = path.join(DATA_DIR, `${name}.json`);
	if (!fs.existsSync(file)) return [];
	return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function write<T>(name: string, data: T[]): void {
	ensureDir();
	fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, '\t'));
}

function writeManyAtomically(entries: { name: string; data: unknown[] }[]): void {
	ensureDir();
	const originals = new Map<string, string | null>();
	const temporary: string[] = [];
	try {
		for (const { name, data } of entries) {
			const file = path.join(DATA_DIR, `${name}.json`);
			originals.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null);
			const temp = `${file}.${crypto.randomUUID()}.tmp`;
			fs.writeFileSync(temp, JSON.stringify(data, null, '\t'));
			temporary.push(temp);
		}
		entries.forEach(({ name }, index) =>
			fs.renameSync(temporary[index], path.join(DATA_DIR, `${name}.json`))
		);
	} catch (error) {
		for (const [file, contents] of originals) {
			if (contents === null) fs.rmSync(file, { force: true });
			else fs.writeFileSync(file, contents);
		}
		throw error;
	} finally {
		for (const temp of temporary) fs.rmSync(temp, { force: true });
	}
}

// ── D1 helpers ──

function ok(v: unknown): string {
	if (v === null || v === undefined) return '';
	return String(v);
}

async function d1All<T>(sql: string, ...bind: unknown[]): Promise<T[]> {
	if (!_d1) return [];
	const { results } = await _d1
		.prepare(sql)
		.bind(...bind)
		.all<T>();
	return results ?? [];
}

async function d1First<T>(sql: string, ...bind: unknown[]): Promise<T | null> {
	if (!_d1) return null;
	const row = await _d1
		.prepare(sql)
		.bind(...bind)
		.first<T>();
	return row ?? null;
}

async function d1Run(sql: string, ...bind: unknown[]): Promise<void> {
	if (!_d1) return;
	await _d1
		.prepare(sql)
		.bind(...bind)
		.run();
}

// ── Types ──

export type Semester = {
	id: string;
	term: 'Fall' | 'Spring' | 'Summer' | string;
	year: number;
	order: number; // for sorting — Fall 2025 = 20251, Spring 2026 = 20262, etc.
};

export type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';

export type RequirementGroup =
	| 'core'
	| 'programming'
	| 'math'
	| 'systems'
	| 'ai'
	| 'writing'
	| 'elective'
	| 'general';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type CourseSignal = {
	status?: CourseStatus;
	credits?: number;
	currentGrade?: number;
	projectedGrade?: number;
	deadlinesThisWeek?: number;
	nextDeadline?: string;
	studyHours?: number;
	materialCount?: number;
	noteCount?: number;
	riskLevel?: RiskLevel;
	requirementGroup?: RequirementGroup;
	topics?: string[];
};

export type Course = {
	id: string;
	semesterId: string;
	code: string;
	name: string;
	instructor?: string;
	credits?: number;
	tag?: string;
	color?: string;
	signals?: CourseSignal;
};

type CourseRow = Omit<Course, 'signals'> & { signals: string | null };

export type GraphState = {
	positions: Record<string, { x: number; y: number }>;
	viewport?: { x: number; y: number; zoom: number };
	edges: {
		id?: string;
		source: string;
		target: string;
		label?: string;
		type?: string;
		directed?: boolean;
		createdBy?: 'user' | 'ai';
		confidence?: number;
		reason?: string;
		reviewStatus?: 'accepted' | 'pending' | 'rejected';
	}[];
};

export type SyllabusExtractedData = {
	professor: {
		name: string;
		email: string;
		office: string;
		officeHours: string;
	};
	logistics: {
		classTime: string;
		room: string;
		attendance: string;
	};
	dates: {
		label: string;
		date: string;
		type: 'quiz' | 'exam' | 'deadline';
		needsReview?: boolean;
	}[];
	grading: {
		label: string;
		weight: number;
	}[];
	requiredMaterials: {
		textbookTitle?: string;
		textbookPdfUploaded: boolean;
		textbookPdfUrl?: string;
	};
	keyKnowledge: {
		source: string;
		topics: string[];
		highlightedTopic: string;
		outline: {
			range: string;
			topic: string;
		}[];
	};
};

export type SyllabusImport = {
	id: string;
	courseId: string;
	fileName: string;
	rawText: string;
	extractedData: SyllabusExtractedData;
	status: 'mocked' | 'ready' | 'error';
	createdAt: string;
	updatedAt: string;
};

export type AcademicDigest = {
	id: string;
	source: 'sample' | 'setup-import' | 'transcript-upload';
	fileName?: string;
	summary: string;
	totalGpa: number;
	projectedGpa: number;
	currentCourseCount: number;
	finishedCourseCount: number;
	currentCredits: number;
	finishedCredits: number;
	courses: AcademicTranscriptCourse[];
	trend: AcademicDigestTrend[];
	insights: string[];
	extractionSource: 'openrouter' | 'fallback';
	updatedAt: string;
};

export type AcademicTranscriptCourse = {
	id: string;
	code: string;
	name: string;
	term: string;
	credits: number;
	currentPercent: number;
	projectedPercent: number;
	status: 'current' | 'finished';
	letter: string;
};

export type AcademicDigestTrend = {
	label: string;
	term: string;
	gpa: number;
	credits: number;
	note: string;
};

export type AcademicDigestAnalysis = {
	totalGpa: number;
	projectedGpa: number;
	currentCourseCount: number;
	finishedCourseCount: number;
	currentCredits: number;
	finishedCredits: number;
	courses: AcademicTranscriptCourse[];
	trend: AcademicDigestTrend[];
	insights: string[];
	extractionSource: AcademicDigest['extractionSource'];
};

const MOCK_SYLLABUS_DATA: SyllabusExtractedData = {
	professor: {
		name: 'Prof. Anika Sharma',
		email: 'anika.sharma@college.edu',
		office: 'Room 312, Tech Building',
		officeHours: 'Tue 2:00-4:00'
	},
	logistics: {
		classTime: 'Tue/Thu 10:00-11:20',
		room: 'A214',
		attendance: 'Expected'
	},
	dates: [
		{ label: 'Quiz 1', date: 'Sep 19', type: 'quiz', needsReview: true },
		{ label: 'Project proposal', date: 'Sep 27', type: 'deadline' },
		{ label: 'Midterm exam', date: 'Oct 18', type: 'exam' },
		{ label: 'Final exam', date: 'Dec 12', type: 'exam' }
	],
	grading: [
		{ label: 'Quizzes', weight: 15 },
		{ label: 'Assignments', weight: 30 },
		{ label: 'Project', weight: 20 },
		{ label: 'Final', weight: 35 }
	],
	requiredMaterials: {
		textbookPdfUploaded: false
	},
	keyKnowledge: {
		source: 'summary + syllabus outline',
		topics: [
			'Relational database design',
			'SQL queries',
			'Normalization',
			'ER diagrams',
			'Transactions',
			'Indexing',
			'Query optimization',
			'Database security'
		],
		highlightedTopic: 'Normalization',
		outline: [
			{ range: 'Week 1-2', topic: 'Data models' },
			{ range: 'Week 3-4', topic: 'SQL + joins' },
			{ range: 'Week 5-6', topic: 'Normalization' },
			{ range: 'Week 7-8', topic: 'Transactions' }
		]
	}
};

// ── Semesters ──

export async function getSemesters(): Promise<Semester[]> {
	if (_d1) {
		return d1All<Semester>('SELECT id, term, year, "order" FROM semesters ORDER BY "order"');
	}
	return read<Semester>('semesters');
}

export async function addSemester(s: Semester): Promise<void> {
	if (_d1) {
		await d1Run(
			'INSERT INTO semesters (id, term, year, "order") VALUES (?, ?, ?, ?)',
			s.id,
			s.term,
			s.year,
			s.order
		);
		return;
	}
	const all = read<Semester>('semesters');
	all.push(s);
	write('semesters', all);
}

export async function updateSemester(
	id: string,
	updates: Partial<Omit<Semester, 'id'>>
): Promise<void> {
	if (_d1) {
		const sets: string[] = [];
		const bind: unknown[] = [];
		if (updates.term !== undefined) {
			sets.push('term = ?');
			bind.push(updates.term);
		}
		if (updates.year !== undefined) {
			sets.push('year = ?');
			bind.push(updates.year);
		}
		if (updates.order !== undefined) {
			sets.push('"order" = ?');
			bind.push(updates.order);
		}
		if (sets.length === 0) return;
		bind.push(id);
		await d1Run(`UPDATE semesters SET ${sets.join(', ')} WHERE id = ?`, ...bind);
		return;
	}
	const all = read<Semester>('semesters');
	const idx = all.findIndex((s) => s.id === id);
	if (idx !== -1) {
		all[idx] = { ...all[idx], ...updates };
		write('semesters', all);
	}
}

export async function deleteSemester(id: string): Promise<void> {
	if (_d1) {
		const removed = await getCourses(id);
		const graph = removeCoursesFromGraph(
			await getGraphState(),
			new Set(removed.map((course) => course.id))
		);
		await _d1.batch([
			_d1.prepare('DELETE FROM courses WHERE semester_id = ?').bind(id),
			_d1.prepare('DELETE FROM semesters WHERE id = ?').bind(id),
			graphStatement(graph)
		]);
		return;
	}
	const semesters = read<Semester>('semesters').filter((s) => s.id !== id);
	const allCourses = getCoursesFsSync();
	const removedIds = new Set(allCourses.filter((c) => c.semesterId === id).map((c) => c.id));
	const courses = allCourses.filter((c) => c.semesterId !== id);
	const graph = removeCoursesFromGraph(getGraphStateFsSync(), removedIds);
	writeManyAtomically([
		{ name: 'semesters', data: semesters },
		{ name: 'courses', data: courses },
		{ name: 'graph', data: [graph] }
	]);
}

// ── Courses ──

export async function getCourses(semesterId?: string): Promise<Course[]> {
	if (_d1) {
		if (semesterId) {
			return (
				await d1All<CourseRow>(
					'SELECT id, semester_id AS semesterId, code, name, instructor, credits, tag, color, signals FROM courses WHERE semester_id = ?',
					semesterId
				)
			).map(rowToCourse);
		}
		return (
			await d1All<CourseRow>(
				'SELECT id, semester_id AS semesterId, code, name, instructor, credits, tag, color, signals FROM courses'
			)
		).map(rowToCourse);
	}
	const all = read<Course>('courses');
	return semesterId ? all.filter((c) => c.semesterId === semesterId) : all;
}

// CSS color allowlist. Hex-only keeps `;`, `(`, `)`, and other CSS-meaningful
// characters out of values that get injected into a `style="..."` attribute,
// so user-supplied colors cannot append extra CSS rules.
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function sanitizeCourseColor(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return HEX_COLOR.test(trimmed) ? trimmed : undefined;
}

function sanitizeCourse(c: Course): Course {
	if (c.color === undefined) return c;
	const color = sanitizeCourseColor(c.color);
	return color ? { ...c, color } : { ...c, color: undefined };
}

function serializeSignals(c: Course): string | null {
	return c.signals ? JSON.stringify(c.signals) : null;
}

function parseSignals(raw: string | null): CourseSignal | undefined {
	if (!raw || typeof raw !== 'string') return undefined;
	try {
		const value: unknown = JSON.parse(raw);
		if (!isCourseSignal(value)) return undefined;
		return value;
	} catch {
		return undefined;
	}
}

function isCourseSignal(value: unknown): value is CourseSignal {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const signal = value as Record<string, unknown>;
	const allowed = new Set([
		'status',
		'credits',
		'currentGrade',
		'projectedGrade',
		'deadlinesThisWeek',
		'nextDeadline',
		'studyHours',
		'materialCount',
		'noteCount',
		'riskLevel',
		'requirementGroup',
		'topics'
	]);
	if (Object.keys(signal).some((key) => !allowed.has(key))) return false;
	if (
		signal.status !== undefined &&
		!['planned', 'active', 'completed', 'at-risk'].includes(String(signal.status))
	)
		return false;
	if (
		signal.riskLevel !== undefined &&
		!['none', 'low', 'medium', 'high'].includes(String(signal.riskLevel))
	)
		return false;
	if (
		signal.requirementGroup !== undefined &&
		!['core', 'programming', 'math', 'systems', 'ai', 'writing', 'elective', 'general'].includes(
			String(signal.requirementGroup)
		)
	)
		return false;
	for (const key of [
		'credits',
		'currentGrade',
		'projectedGrade',
		'deadlinesThisWeek',
		'studyHours',
		'materialCount',
		'noteCount'
	]) {
		if (
			signal[key] !== undefined &&
			(typeof signal[key] !== 'number' || !Number.isFinite(signal[key]))
		)
			return false;
	}
	if (signal.nextDeadline !== undefined && typeof signal.nextDeadline !== 'string') return false;
	if (
		signal.topics !== undefined &&
		(!Array.isArray(signal.topics) || signal.topics.some((topic) => typeof topic !== 'string'))
	)
		return false;
	return true;
}

function rowToCourse(row: CourseRow): Course {
	const { signals: rawSignals, ...course } = row;
	const signals = parseSignals(rawSignals);
	return signals ? { ...course, signals } : course;
}

// Sync variant for local fs (used by deleteSemester cascade internally)
function getCoursesFsSync(semesterId?: string): Course[] {
	const all = read<Course>('courses');
	return semesterId ? all.filter((c) => c.semesterId === semesterId) : all;
}

export async function addCourse(c: Course): Promise<void> {
	const sanitized = sanitizeCourse(c);
	if (_d1) {
		await d1Run(
			'INSERT INTO courses (id, semester_id, code, name, instructor, credits, tag, color, signals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			sanitized.id,
			sanitized.semesterId,
			sanitized.code,
			sanitized.name,
			ok(sanitized.instructor),
			sanitized.credits ?? null,
			ok(sanitized.tag),
			ok(sanitized.color),
			serializeSignals(sanitized)
		);
		return;
	}
	const all = read<Course>('courses');
	all.push(sanitized);
	write('courses', all);
}

export async function updateCourse(id: string, updates: Partial<Course>): Promise<void> {
	if (_d1) {
		const sets: string[] = [];
		const bind: unknown[] = [];
		if (updates.semesterId !== undefined) {
			sets.push('semester_id = ?');
			bind.push(updates.semesterId);
		}
		if (updates.code !== undefined) {
			sets.push('code = ?');
			bind.push(updates.code);
		}
		if (updates.name !== undefined) {
			sets.push('name = ?');
			bind.push(updates.name);
		}
		if (updates.instructor !== undefined) {
			sets.push('instructor = ?');
			bind.push(updates.instructor);
		}
		if (updates.credits !== undefined) {
			sets.push('credits = ?');
			bind.push(updates.credits);
		}
		if (updates.tag !== undefined) {
			sets.push('tag = ?');
			bind.push(updates.tag);
		}
		if ('color' in updates && updates.color !== undefined) {
			const c = sanitizeCourseColor(updates.color);
			sets.push('color = ?');
			bind.push(c ?? null);
		}
		if (updates.signals !== undefined) {
			sets.push('signals = ?');
			bind.push(JSON.stringify(updates.signals));
		}
		if (sets.length === 0) return;
		bind.push(id);
		await d1Run(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, ...bind);
		return;
	}
	const all = read<Course>('courses');
	const idx = all.findIndex((c) => c.id === id);
	if (idx !== -1) {
		const next: Partial<Course> = { ...updates };
		if ('color' in updates) {
			const color = sanitizeCourseColor(updates.color);
			if (color) next.color = color;
			else next.color = undefined;
		}
		const merged: Course = { ...all[idx], ...next };
		if ('color' in updates && !next.color) delete merged.color;
		all[idx] = merged;
		write('courses', all);
	}
}

export async function deleteCourse(id: string): Promise<void> {
	if (_d1) {
		const graph = removeCoursesFromGraph(await getGraphState(), new Set([id]));
		await _d1.batch([
			_d1.prepare('DELETE FROM courses WHERE id = ?').bind(id),
			graphStatement(graph)
		]);
		return;
	}
	const all = read<Course>('courses').filter((c) => c.id !== id);
	const graph = removeCoursesFromGraph(getGraphStateFsSync(), new Set([id]));
	writeManyAtomically([
		{ name: 'courses', data: all },
		{ name: 'graph', data: [graph] }
	]);
}

// ── Graph State ──

export async function getGraphState(): Promise<GraphState> {
	if (_d1) {
		const row = await d1First<{ positions: string; viewport: string | null; edges: string }>(
			'SELECT positions, viewport, edges FROM graph_state LIMIT 1'
		);
		if (!row) return { positions: {}, edges: [] };
		return {
			positions: JSON.parse(row.positions),
			viewport: row.viewport ? JSON.parse(row.viewport) : undefined,
			edges: JSON.parse(row.edges)
		};
	}
	const [state] = read<GraphState>('graph');
	return state ?? { positions: {}, edges: [] };
}

export async function saveGraphState(state: GraphState): Promise<void> {
	if (_d1) {
		await d1Run(
			'INSERT OR REPLACE INTO graph_state (id, positions, viewport, edges) VALUES (?, ?, ?, ?)',
			'graph-root',
			JSON.stringify(state.positions),
			state.viewport ? JSON.stringify(state.viewport) : null,
			JSON.stringify(state.edges)
		);
		return;
	}
	write('graph', [state]);
}

function getGraphStateFsSync(): GraphState {
	return read<GraphState>('graph')[0] ?? { positions: {}, edges: [] };
}

function removeCoursesFromGraph(state: GraphState, courseIds: Set<string>): GraphState {
	return {
		...state,
		positions: Object.fromEntries(
			Object.entries(state.positions).filter(([courseId]) => !courseIds.has(courseId))
		),
		edges: state.edges.filter((edge) => !courseIds.has(edge.source) && !courseIds.has(edge.target))
	};
}

function graphStatement(state: GraphState): D1PreparedStatement {
	if (!_d1) throw new Error('D1 is not configured');
	return _d1
		.prepare(
			'INSERT OR REPLACE INTO graph_state (id, positions, viewport, edges) VALUES (?, ?, ?, ?)'
		)
		.bind(
			'graph-root',
			JSON.stringify(state.positions),
			state.viewport ? JSON.stringify(state.viewport) : null,
			JSON.stringify(state.edges)
		);
}

export async function applyGraphImport(
	courses: { course: Course; existing: boolean }[],
	state: GraphState
): Promise<void> {
	if (_d1) {
		const statements = courses.map(({ course, existing }) => {
			const sanitized = sanitizeCourse(course);
			return existing
				? _d1!
						.prepare('UPDATE courses SET semester_id = ?, code = ?, name = ?, tag = ? WHERE id = ?')
						.bind(
							sanitized.semesterId,
							sanitized.code,
							sanitized.name,
							ok(sanitized.tag),
							sanitized.id
						)
				: _d1!
						.prepare(
							'INSERT INTO courses (id, semester_id, code, name, instructor, credits, tag, color, signals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
						)
						.bind(
							sanitized.id,
							sanitized.semesterId,
							sanitized.code,
							sanitized.name,
							ok(sanitized.instructor),
							sanitized.credits ?? null,
							ok(sanitized.tag),
							ok(sanitized.color),
							serializeSignals(sanitized)
						);
		});
		await _d1.batch([...statements, graphStatement(state)]);
		return;
	}

	const current = read<Course>('courses');
	const byId = new Map(current.map((course) => [course.id, course]));
	for (const { course } of courses) byId.set(course.id, sanitizeCourse(course));
	writeManyAtomically([
		{ name: 'courses', data: [...byId.values()] },
		{ name: 'graph', data: [state] }
	]);
}

// ── Academic Progress Digest ──

function currentCourseCredits(crs: Course[]): number {
	return crs.reduce((sum, cr) => sum + (cr.credits ?? 3), 0);
}

export async function getAcademicDigest(): Promise<AcademicDigest | null> {
	if (_d1) {
		const row = await d1First<Record<string, unknown>>('SELECT * FROM academic_digest LIMIT 1');
		if (!row) return null;
		return rowToDigest(row);
	}
	return read<AcademicDigest>('academic-digest').at(-1) ?? null;
}

export function buildAcademicDigest(input?: {
	fileName?: string;
	source?: AcademicDigest['source'];
	analysis?: AcademicDigestAnalysis;
}): AcademicDigest {
	// This is synchronous because it only constructs an object — no I/O needed
	// when called from saveAcademicDigest which handles both paths.
	// We use a sync read for the courses param for the local path.
	const crs = !_d1 ? read<Course>('courses') : [];
	const source = input?.source ?? (crs.length > 0 ? 'setup-import' : 'sample');
	const currentCourseCount = input?.analysis?.currentCourseCount ?? crs.length;
	const currentCredits =
		input?.analysis?.currentCredits ?? (crs.length > 0 ? currentCourseCredits(crs) : 0);
	const fileName = input?.fileName?.trim();
	const analyticsLabel =
		input?.analysis?.extractionSource === 'openrouter' ? 'OpenRouter' : 'backend';
	const summary = fileName
		? `${fileName} was uploaded and digested by the academic progress ${analyticsLabel} analytics.`
		: source === 'setup-import'
			? `${currentCourseCount} setup course${currentCourseCount === 1 ? '' : 's'} digested into the academic progress dashboard.`
			: 'No academic history has been imported yet.';

	return {
		id: 'academic-progress',
		source,
		fileName,
		summary,
		totalGpa: input?.analysis?.totalGpa ?? 0,
		projectedGpa: input?.analysis?.projectedGpa ?? 0,
		currentCourseCount,
		finishedCourseCount: input?.analysis?.finishedCourseCount ?? 0,
		currentCredits,
		finishedCredits: input?.analysis?.finishedCredits ?? 0,
		courses: input?.analysis?.courses ?? [],
		trend: input?.analysis?.trend ?? [],
		insights: input?.analysis?.insights ?? [],
		extractionSource: input?.analysis?.extractionSource ?? 'fallback',
		updatedAt: new Date().toISOString()
	};
}

export async function saveAcademicDigest(input?: {
	fileName?: string;
	source?: AcademicDigest['source'];
	analysis?: AcademicDigestAnalysis;
}): Promise<AcademicDigest> {
	const record = buildAcademicDigest(input);
	if (_d1) {
		await d1Run(
			`INSERT OR REPLACE INTO academic_digest
			 (id, source, file_name, summary, total_gpa, projected_gpa, current_course_count, finished_course_count, current_credits, finished_credits, courses, trend, insights, extraction_source, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			record.id,
			record.source,
			ok(record.fileName),
			record.summary,
			String(record.totalGpa),
			String(record.projectedGpa),
			record.currentCourseCount,
			record.finishedCourseCount,
			record.currentCredits,
			record.finishedCredits,
			JSON.stringify(record.courses),
			JSON.stringify(record.trend),
			JSON.stringify(record.insights),
			record.extractionSource,
			record.updatedAt
		);
		return record;
	}
	write('academic-digest', [record]);
	return record;
}

export async function clearAcademicDigest(): Promise<AcademicDigest> {
	if (_d1) {
		await d1Run('DELETE FROM academic_digest');
		const fresh = buildAcademicDigest();
		await d1Run(
			`INSERT INTO academic_digest
			 (id, source, file_name, summary, total_gpa, projected_gpa, current_course_count, finished_course_count, current_credits, finished_credits, courses, trend, insights, extraction_source, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			fresh.id,
			fresh.source,
			ok(fresh.fileName),
			fresh.summary,
			String(fresh.totalGpa),
			String(fresh.projectedGpa),
			fresh.currentCourseCount,
			fresh.finishedCourseCount,
			fresh.currentCredits,
			fresh.finishedCredits,
			JSON.stringify(fresh.courses),
			JSON.stringify(fresh.trend),
			JSON.stringify(fresh.insights),
			fresh.extractionSource,
			fresh.updatedAt
		);
		return fresh;
	}
	write('academic-digest', []);
	return buildAcademicDigest();
}

function rowToDigest(row: Record<string, unknown>): AcademicDigest {
	return {
		id: String(row.id),
		source: String(row.source) as AcademicDigest['source'],
		fileName: row.file_name ? String(row.file_name) : undefined,
		summary: String(row.summary),
		totalGpa: parseFloat(String(row.total_gpa)),
		projectedGpa: parseFloat(String(row.projected_gpa)),
		currentCourseCount: Number(row.current_course_count),
		finishedCourseCount: Number(row.finished_course_count),
		currentCredits: Number(row.current_credits),
		finishedCredits: Number(row.finished_credits),
		courses: parseJsonArr(row.courses),
		trend: parseJsonArr(row.trend),
		insights: JSON.parse(String(row.insights ?? '[]')),
		extractionSource: String(row.extraction_source) as AcademicDigest['extractionSource'],
		updatedAt: String(row.updated_at)
	};
}

function parseJsonArr<T>(v: unknown): T[] {
	try {
		return JSON.parse(String(v ?? '[]')) as T[];
	} catch {
		return [];
	}
}

// ── Syllabus Intelligence ──

export async function getSyllabusImports(): Promise<SyllabusImport[]> {
	if (_d1) {
		const rows = await d1All<Record<string, unknown>>(
			'SELECT * FROM syllabus_imports ORDER BY created_at'
		);
		return rows.map(rowToSyllabusImport);
	}
	return read<SyllabusImport>('syllabus-imports');
}

export async function getSyllabusImport(courseId?: string): Promise<SyllabusImport | null> {
	if (_d1) {
		if (courseId) {
			const row = await d1First<Record<string, unknown>>(
				'SELECT * FROM syllabus_imports WHERE course_id = ?',
				courseId
			);
			return row ? rowToSyllabusImport(row) : null;
		}
		const row = await d1First<Record<string, unknown>>(
			'SELECT * FROM syllabus_imports ORDER BY created_at DESC'
		);
		return row ? rowToSyllabusImport(row) : null;
	}
	const all = read<SyllabusImport>('syllabus-imports');
	if (courseId) return all.find((item) => item.courseId === courseId) ?? null;
	return all.at(-1) ?? null;
}

export async function clearSyllabusImport(courseId?: string): Promise<null> {
	if (_d1) {
		if (courseId) {
			await d1Run('DELETE FROM syllabus_imports WHERE course_id = ?', courseId);
		} else {
			await d1Run('DELETE FROM syllabus_imports');
		}
		return null;
	}
	if (courseId) {
		write(
			'syllabus-imports',
			read<SyllabusImport>('syllabus-imports').filter((item) => item.courseId !== courseId)
		);
		return null;
	}
	write('syllabus-imports', []);
	return null;
}

export async function mockExtractSyllabus(
	fileName = 'CSIS 4495 Syllabus.pdf',
	courseId = 'csis-4495'
): Promise<SyllabusImport> {
	return saveSyllabusImport({
		courseId,
		fileName,
		rawText:
			'Mock raw syllabus text. Replace this with PDF extraction before calling an AI parser.',
		extractedData: MOCK_SYLLABUS_DATA,
		status: 'mocked'
	});
}

export async function saveSyllabusImport(input: {
	courseId?: string;
	fileName: string;
	rawText: string;
	extractedData: SyllabusExtractedData;
	status: SyllabusImport['status'];
}): Promise<SyllabusImport> {
	const courseId = input.courseId?.trim() || 'csis-4495';
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		id: crypto.randomUUID(),
		courseId,
		fileName: input.fileName,
		rawText: input.rawText,
		extractedData: input.extractedData,
		status: input.status,
		createdAt: now,
		updatedAt: now
	};

	if (_d1) {
		// upsert: delete existing for this course then insert
		await d1Run('DELETE FROM syllabus_imports WHERE course_id = ?', courseId);
		await d1Run(
			'INSERT INTO syllabus_imports (id, course_id, file_name, raw_text, extracted_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			record.id,
			record.courseId,
			record.fileName,
			record.rawText,
			JSON.stringify(record.extractedData),
			record.status,
			record.createdAt,
			record.updatedAt
		);
		return record;
	}

	const all = read<SyllabusImport>('syllabus-imports');
	const existing = all.find((item) => item.courseId === courseId);
	if (existing) {
		record.id = existing.id;
		record.createdAt = existing.createdAt;
		record.extractedData = {
			...input.extractedData,
			requiredMaterials:
				existing.extractedData.requiredMaterials ?? input.extractedData.requiredMaterials
		};
	}
	write('syllabus-imports', [...all.filter((item) => item.courseId !== courseId), record]);
	return record;
}

export async function updateSyllabusTextbook(
	fileName: string,
	courseId?: string
): Promise<SyllabusImport> {
	if (_d1) {
		const existing = await getSyllabusImport(courseId);
		const now = new Date().toISOString();
		const record: SyllabusImport = {
			...(existing ?? {
				id: crypto.randomUUID(),
				courseId: courseId ?? 'csis-4495',
				fileName: 'CSIS 4495 Syllabus.pdf',
				rawText: '',
				extractedData: {
					professor: { name: '', email: '', office: '', officeHours: '' },
					logistics: { classTime: '', room: '', attendance: '' },
					dates: [],
					grading: [],
					requiredMaterials: { textbookPdfUploaded: false },
					keyKnowledge: { source: '', topics: [], highlightedTopic: '', outline: [] }
				},
				status: 'mocked' as const,
				createdAt: now,
				updatedAt: now
			}),
			extractedData: {
				...(existing?.extractedData ?? ({} as SyllabusExtractedData)),
				requiredMaterials: {
					textbookTitle: 'Database Systems, 7th ed.',
					textbookPdfUploaded: true,
					textbookPdfUrl: '/textbook.pdf'
				}
			},
			status: 'mocked' as const,
			updatedAt: now
		};

		await d1Run(
			'INSERT OR REPLACE INTO syllabus_imports (id, course_id, file_name, raw_text, extracted_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			record.id,
			record.courseId,
			record.fileName,
			record.rawText,
			JSON.stringify(record.extractedData),
			record.status,
			record.createdAt,
			record.updatedAt
		);
		void fileName;
		return record;
	}

	const existing =
		(await getSyllabusImport(courseId)) ?? (await mockExtractSyllabus(undefined, courseId));
	const all = _d1 ? [] : read<SyllabusImport>('syllabus-imports');
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		...existing,
		extractedData: {
			...existing.extractedData,
			requiredMaterials: {
				textbookTitle: 'Database Systems, 7th ed.',
				textbookPdfUploaded: true,
				textbookPdfUrl: '/textbook.pdf'
			}
		},
		rawText: existing.rawText,
		status: 'mocked',
		updatedAt: now
	};

	if (!_d1) {
		write('syllabus-imports', [...all.filter((item) => item.courseId !== record.courseId), record]);
	}
	void fileName;
	return record;
}

// ── Row helpers ──

function rowToSyllabusImport(row: Record<string, unknown>): SyllabusImport {
	return {
		id: String(row.id),
		courseId: String(row.course_id),
		fileName: String(row.file_name),
		rawText: String(row.raw_text),
		extractedData: JSON.parse(String(row.extracted_data)),
		status: String(row.status) as SyllabusImport['status'],
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at)
	};
}
