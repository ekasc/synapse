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
	userId: string;
	term: 'Fall' | 'Spring' | 'Summer' | string;
	year: number;
	order: number;
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
	userId: string;
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

export type FocusPreferences = {
	userId: string;
	allowedSites: string[];
	blockedSites: string[];
	updatedAt: string;
};

export type StudySession = {
	id: string;
	userId: string;
	courseId: string | null;
	intention: string;
	plannedSeconds: number;
	completedSeconds: number;
	distractionCount: number;
	focusScore: number;
	startedAt: string;
	completedAt: string;
};

const DEFAULT_FOCUS_PREFERENCES: FocusPreferences = {
	allowedSites: ['notebooklm.google.com', 'blackboard.douglascollege.ca'],
	blockedSites: ['instagram.com', 'tiktok.com', 'reddit.com'],
	updatedAt: ''
};

export type GraphState = {
	userId?: string;
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
	userId: string;
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
	userId: string;
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

export type AcademicDigestJob = {
	id: string;
	userId: string;
	fileName: string;
	status: 'queued' | 'processing' | 'completed' | 'failed';
	error: string | null;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
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

export async function getSemesters(userId: string): Promise<Semester[]> {
	if (_d1) {
		return d1All<Semester>(
			'SELECT id, user_id, term, year, "order" FROM semesters WHERE user_id = ? ORDER BY "order"',
			userId
		);
	}
	const all = read<Semester>('semesters');
	return all.filter((s) => s.userId === userId);
}

export async function addSemester(userId: string, s: Semester): Promise<void> {
	if (_d1) {
		await d1Run(
			'INSERT INTO semesters (id, user_id, term, year, "order") VALUES (?, ?, ?, ?, ?)',
			s.id,
			userId,
			s.term,
			s.year,
			s.order
		);
		return;
	}
	const all = read<Semester>('semesters');
	all.push({ ...s, userId });
	write('semesters', all);
}

export async function updateSemester(
	userId: string,
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
		bind.push(id, userId);
		await d1Run(`UPDATE semesters SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, ...bind);
		return;
	}
	const all = read<Semester>('semesters');
	const idx = all.findIndex((s) => s.id === id && s.userId === userId);
	if (idx !== -1) {
		all[idx] = { ...all[idx], ...updates };
		write('semesters', all);
	}
}

export async function deleteSemester(userId: string, id: string): Promise<void> {
	if (_d1) {
		const removed = await getCourses(userId, id);
		const graph = removeCoursesFromGraph(
			await getGraphState(userId),
			new Set(removed.map((course) => course.id))
		);
		await _d1.batch([
			_d1.prepare('DELETE FROM courses WHERE semester_id = ? AND user_id = ?').bind(id, userId),
			_d1.prepare('DELETE FROM semesters WHERE id = ? AND user_id = ?').bind(id, userId),
			graphStatement(userId, graph)
		]);
		return;
	}
	const semesters = read<Semester>('semesters').filter(
		(s) => !(s.id === id && s.userId === userId)
	);
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

export async function getCourses(userId: string, semesterId?: string): Promise<Course[]> {
	if (_d1) {
		if (semesterId) {
			return (
				await d1All<CourseRow>(
					'SELECT id, user_id AS userId, semester_id AS semesterId, code, name, instructor, credits, tag, color, signals FROM courses WHERE user_id = ? AND semester_id = ?',
					userId,
					semesterId
				)
			).map(rowToCourse);
		}
		return (
			await d1All<CourseRow>(
				'SELECT id, user_id AS userId, semester_id AS semesterId, code, name, instructor, credits, tag, color, signals FROM courses WHERE user_id = ?',
				userId
			)
		).map(rowToCourse);
	}
	const all = read<Course>('courses');
	const filtered = all.filter((c) => c.userId === userId);
	return semesterId ? filtered.filter((c) => c.semesterId === semesterId) : filtered;
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

export async function addCourse(userId: string, c: Course): Promise<void> {
	const sanitized = sanitizeCourse(c);
	if (_d1) {
		await d1Run(
			'INSERT INTO courses (id, user_id, semester_id, code, name, instructor, credits, tag, color, signals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			sanitized.id,
			userId,
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
	all.push({ ...sanitized, userId });
	write('courses', all);
}

export async function updateCourse(
	userId: string,
	id: string,
	updates: Partial<Course>
): Promise<void> {
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
		bind.push(id, userId);
		await d1Run(`UPDATE courses SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, ...bind);
		return;
	}
	const all = read<Course>('courses');
	const idx = all.findIndex((c) => c.id === id && c.userId === userId);
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

export async function deleteCourse(userId: string, id: string): Promise<void> {
	if (_d1) {
		const graph = removeCoursesFromGraph(await getGraphState(userId), new Set([id]));
		await _d1.batch([
			_d1.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').bind(id, userId),
			graphStatement(userId, graph)
		]);
		return;
	}
	const all = read<Course>('courses').filter((c) => !(c.id === id && c.userId === userId));
	const graph = removeCoursesFromGraph(getGraphStateFsSync(), new Set([id]));
	writeManyAtomically([
		{ name: 'courses', data: all },
		{ name: 'graph', data: [graph] }
	]);
}

// ── Graph State ──

export async function getGraphState(userId: string): Promise<GraphState> {
	if (_d1) {
		const row = await d1First<{ positions: string; viewport: string | null; edges: string }>(
			'SELECT positions, viewport, edges FROM graph_state WHERE id = ? AND user_id = ?',
			'graph-root',
			userId
		);
		if (!row) return { positions: {}, edges: [] };
		return {
			positions: JSON.parse(row.positions),
			viewport: row.viewport ? JSON.parse(row.viewport) : undefined,
			edges: JSON.parse(row.edges)
		};
	}
	const all = read<GraphState>('graph');
	const found = all.find((g) => g.userId === userId);
	if (!found) return { positions: {}, edges: [] };
	const { userId: _userId, ...rest } = found;
	return rest;
}

export async function saveGraphState(userId: string, state: GraphState): Promise<void> {
	if (_d1) {
		await d1Run(
			'INSERT OR REPLACE INTO graph_state (id, user_id, positions, viewport, edges) VALUES (?, ?, ?, ?, ?)',
			'graph-root',
			userId,
			JSON.stringify(state.positions),
			state.viewport ? JSON.stringify(state.viewport) : null,
			JSON.stringify(state.edges)
		);
		return;
	}
	const all = read<GraphState>('graph').filter((g) => g.userId !== userId);
	write('graph', [...all, { ...state, userId }]);
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

function graphStatement(userId: string, state: GraphState): D1PreparedStatement {
	if (!_d1) throw new Error('D1 is not configured');
	return _d1
		.prepare(
			'INSERT OR REPLACE INTO graph_state (id, user_id, positions, viewport, edges) VALUES (?, ?, ?, ?, ?)'
		)
		.bind(
			'graph-root',
			userId,
			JSON.stringify(state.positions),
			state.viewport ? JSON.stringify(state.viewport) : null,
			JSON.stringify(state.edges)
		);
}

export async function applyGraphImport(
	userId: string,
	courses: { course: Course; existing: boolean }[],
	state: GraphState
): Promise<void> {
	if (_d1) {
		const statements = courses.map(({ course, existing }) => {
			const sanitized = sanitizeCourse(course);
			return existing
				? _d1!
						.prepare(
							'UPDATE courses SET semester_id = ?, code = ?, name = ?, tag = ? WHERE id = ? AND user_id = ?'
						)
						.bind(
							sanitized.semesterId,
							sanitized.code,
							sanitized.name,
							ok(sanitized.tag),
							sanitized.id,
							userId
						)
				: _d1!
						.prepare(
							'INSERT INTO courses (id, user_id, semester_id, code, name, instructor, credits, tag, color, signals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
						)
						.bind(
							sanitized.id,
							userId,
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
		await _d1.batch([...statements, graphStatement(userId, state)]);
		return;
	}

	const current = read<Course>('courses');
	const byId = new Map(current.map((course) => [course.id, course]));
	for (const { course } of courses) {
		const sanitized = sanitizeCourse(course);
		byId.set(course.id, { ...sanitized, userId });
	}
	writeManyAtomically([
		{ name: 'courses', data: [...byId.values()] },
		{ name: 'graph', data: [{ ...state, userId }] }
	]);
}

// ── Academic Progress Digest ──

function currentCourseCredits(crs: Course[]): number {
	return crs.reduce((sum, cr) => sum + (cr.credits ?? 3), 0);
}

export async function getAcademicDigest(userId: string): Promise<AcademicDigest | null> {
	if (_d1) {
		const row = await d1First<Record<string, unknown>>(
			'SELECT * FROM academic_digest WHERE user_id = ?',
			userId
		);
		if (!row) return null;
		return rowToDigest(row);
	}
	const all = read<AcademicDigest>('academic-digest');
	return all.find((d) => d.userId === userId) ?? null;
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

export async function saveAcademicDigest(
	userId: string,
	input?: {
		fileName?: string;
		source?: AcademicDigest['source'];
		analysis?: AcademicDigestAnalysis;
	}
): Promise<AcademicDigest> {
	const record = buildAcademicDigest(input);
	record.userId = userId;
	if (_d1) {
		await d1Run(
			`INSERT OR REPLACE INTO academic_digest
			 (id, user_id, source, file_name, summary, total_gpa, projected_gpa, current_course_count, finished_course_count, current_credits, finished_credits, courses, trend, insights, extraction_source, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			record.id,
			userId,
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

export async function clearAcademicDigest(userId: string): Promise<AcademicDigest> {
	if (_d1) {
		await d1Run('DELETE FROM academic_digest WHERE user_id = ?', userId);
		const fresh = buildAcademicDigest();
		fresh.userId = userId;
		await d1Run(
			`INSERT INTO academic_digest
			 (id, user_id, source, file_name, summary, total_gpa, projected_gpa, current_course_count, finished_course_count, current_credits, finished_credits, courses, trend, insights, extraction_source, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			fresh.id,
			userId,
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

export async function createAcademicDigestJob(
	userId: string,
	fileName: string
): Promise<AcademicDigestJob> {
	const now = new Date().toISOString();
	const job: AcademicDigestJob = {
		id: crypto.randomUUID(),
		userId,
		fileName,
		status: 'queued',
		error: null,
		createdAt: now,
		updatedAt: now,
		completedAt: null
	};
	if (_d1) {
		await d1Run(
			`INSERT INTO academic_digest_jobs
			 (id, user_id, file_name, status, error, created_at, updated_at, completed_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			job.id,
			userId,
			job.fileName,
			job.status,
			job.error,
			job.createdAt,
			job.updatedAt,
			job.completedAt
		);
		return job;
	}
	const jobs = read<AcademicDigestJob>('academic-digest-jobs');
	write('academic-digest-jobs', [...jobs, job].slice(-20));
	return job;
}

export async function updateAcademicDigestJob(
	userId: string,
	id: string,
	update: Pick<AcademicDigestJob, 'status'> & { error?: string | null }
): Promise<AcademicDigestJob | null> {
	const now = new Date().toISOString();
	const completedAt = update.status === 'completed' || update.status === 'failed' ? now : null;
	if (_d1) {
		await d1Run(
			`UPDATE academic_digest_jobs
			 SET status = ?, error = ?, updated_at = ?, completed_at = ?
			 WHERE id = ? AND user_id = ?`,
			update.status,
			update.error ?? null,
			now,
			completedAt,
			id,
			userId
		);
		const row = await d1First<Record<string, unknown>>(
			'SELECT * FROM academic_digest_jobs WHERE id = ? AND user_id = ?',
			id,
			userId
		);
		return row ? rowToAcademicDigestJob(row) : null;
	}
	const jobs = read<AcademicDigestJob>('academic-digest-jobs');
	const index = jobs.findIndex((job) => job.id === id && job.userId === userId);
	if (index < 0) return null;
	jobs[index] = {
		...jobs[index],
		status: update.status,
		error: update.error ?? null,
		updatedAt: now,
		completedAt
	};
	write('academic-digest-jobs', jobs);
	return jobs[index];
}

export async function getLatestAcademicDigestJob(
	userId: string
): Promise<AcademicDigestJob | null> {
	if (_d1) {
		const row = await d1First<Record<string, unknown>>(
			'SELECT * FROM academic_digest_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
			userId
		);
		return row ? rowToAcademicDigestJob(row) : null;
	}
	const all = read<AcademicDigestJob>('academic-digest-jobs');
	return all.filter((j) => j.userId === userId).at(-1) ?? null;
}

function rowToAcademicDigestJob(row: Record<string, unknown>): AcademicDigestJob {
	return {
		id: String(row.id),
		fileName: String(row.file_name),
		status: String(row.status) as AcademicDigestJob['status'],
		error: row.error ? String(row.error) : null,
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		completedAt: row.completed_at ? String(row.completed_at) : null
	};
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

export async function getSyllabusImports(userId: string): Promise<SyllabusImport[]> {
	if (_d1) {
		const rows = await d1All<Record<string, unknown>>(
			'SELECT * FROM syllabus_imports WHERE user_id = ? ORDER BY created_at',
			userId
		);
		return rows.map(rowToSyllabusImport);
	}
	const all = read<SyllabusImport>('syllabus-imports');
	return all.filter((s) => s.userId === userId);
}

export async function getSyllabusImport(
	userId: string,
	courseId?: string
): Promise<SyllabusImport | null> {
	if (_d1) {
		if (courseId) {
			const row = await d1First<Record<string, unknown>>(
				'SELECT * FROM syllabus_imports WHERE user_id = ? AND course_id = ?',
				userId,
				courseId
			);
			return row ? rowToSyllabusImport(row) : null;
		}
		const row = await d1First<Record<string, unknown>>(
			'SELECT * FROM syllabus_imports WHERE user_id = ? ORDER BY created_at DESC',
			userId
		);
		return row ? rowToSyllabusImport(row) : null;
	}
	const all = read<SyllabusImport>('syllabus-imports').filter((s) => s.userId === userId);
	if (courseId) return all.find((item) => item.courseId === courseId) ?? null;
	return all.at(-1) ?? null;
}

export async function clearSyllabusImport(userId: string, courseId?: string): Promise<null> {
	if (_d1) {
		if (courseId) {
			await d1Run(
				'DELETE FROM syllabus_imports WHERE user_id = ? AND course_id = ?',
				userId,
				courseId
			);
		} else {
			await d1Run('DELETE FROM syllabus_imports WHERE user_id = ?', userId);
		}
		return null;
	}
	if (courseId) {
		write(
			'syllabus-imports',
			read<SyllabusImport>('syllabus-imports').filter(
				(item) => !(item.userId === userId && item.courseId === courseId)
			)
		);
		return null;
	}
	write(
		'syllabus-imports',
		read<SyllabusImport>('syllabus-imports').filter((item) => item.userId !== userId)
	);
	return null;
}

export async function mockExtractSyllabus(
	userId: string,
	fileName = 'CSIS 4495 Syllabus.pdf',
	courseId = 'csis-4495'
): Promise<SyllabusImport> {
	return saveSyllabusImport(userId, {
		courseId,
		fileName,
		rawText:
			'Mock raw syllabus text. Replace this with PDF extraction before calling an AI parser.',
		extractedData: MOCK_SYLLABUS_DATA,
		status: 'mocked'
	});
}

function usableSyllabusText(value: string | undefined): string | undefined {
	const text = value?.trim();
	return text && !/^not found$/i.test(text) ? text : undefined;
}

async function applySyllabusDetailsToCourse(
	userId: string,
	courseId: string,
	extractedData: SyllabusExtractedData
): Promise<void> {
	const course = (await getCourses(userId)).find((candidate) => candidate.id === courseId);
	if (!course) return;
	const instructor = usableSyllabusText(extractedData.professor.name);
	const currentInstructor = usableSyllabusText(course.instructor);
	const topics = extractedData.keyKnowledge.topics.map((topic) => topic.trim()).filter(Boolean);
	const firstDate = extractedData.dates.find((date) => !date.needsReview);
	const signals: CourseSignal = { ...(course.signals ?? {}) };
	if (!signals.topics?.length && topics.length) signals.topics = topics;
	if (!signals.nextDeadline && firstDate)
		signals.nextDeadline = `${firstDate.label} · ${firstDate.date}`;
	await updateCourse(userId, courseId, {
		...(instructor && !currentInstructor ? { instructor } : {}),
		...(Object.keys(signals).length ? { signals } : {})
	});
}

export async function saveSyllabusImport(
	userId: string,
	input: {
		courseId?: string;
		fileName: string;
		rawText: string;
		extractedData: SyllabusExtractedData;
		status: SyllabusImport['status'];
	}
): Promise<SyllabusImport> {
	const courseId = input.courseId?.trim() || 'csis-4495';
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		id: crypto.randomUUID(),
		userId,
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
		await d1Run(
			'DELETE FROM syllabus_imports WHERE user_id = ? AND course_id = ?',
			userId,
			courseId
		);
		await d1Run(
			'INSERT INTO syllabus_imports (id, user_id, course_id, file_name, raw_text, extracted_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			record.id,
			userId,
			record.courseId,
			record.fileName,
			record.rawText,
			JSON.stringify(record.extractedData),
			record.status,
			record.createdAt,
			record.updatedAt
		);
		await applySyllabusDetailsToCourse(userId, courseId, record.extractedData);
		return record;
	}

	const all = read<SyllabusImport>('syllabus-imports');
	const existing = all.find((item) => item.userId === userId && item.courseId === courseId);
	if (existing) {
		record.id = existing.id;
		record.createdAt = existing.createdAt;
		record.extractedData = {
			...input.extractedData,
			requiredMaterials:
				existing.extractedData.requiredMaterials ?? input.extractedData.requiredMaterials
		};
	}
	write('syllabus-imports', [
		...all.filter((item) => !(item.userId === userId && item.courseId === courseId)),
		record
	]);
	await applySyllabusDetailsToCourse(userId, courseId, record.extractedData);
	return record;
}

export async function updateSyllabusTextbook(
	userId: string,
	fileName: string,
	courseId?: string
): Promise<SyllabusImport> {
	if (_d1) {
		const existing = await getSyllabusImport(userId, courseId);
		const now = new Date().toISOString();
		const record: SyllabusImport = {
			...(existing ?? {
				id: crypto.randomUUID(),
				userId,
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
			'INSERT OR REPLACE INTO syllabus_imports (id, user_id, course_id, file_name, raw_text, extracted_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			record.id,
			userId,
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
		(await getSyllabusImport(userId, courseId)) ??
		(await mockExtractSyllabus(userId, undefined, courseId));
	const all = _d1 ? [] : read<SyllabusImport>('syllabus-imports');
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		...existing,
		userId,
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

// — Study Timer —

function parseSiteList(value: unknown): string[] {
	try {
		const parsed = JSON.parse(String(value ?? '[]')) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((site): site is string => typeof site === 'string')
			: [];
	} catch {
		return [];
	}
}

function rowToStudySession(row: Record<string, unknown>): StudySession {
	return {
		id: String(row.id),
		courseId: row.course_id ? String(row.course_id) : null,
		intention: String(row.intention ?? ''),
		plannedSeconds: Number(row.planned_seconds),
		completedSeconds: Number(row.completed_seconds),
		distractionCount: Number(row.distraction_count),
		focusScore: Number(row.focus_score),
		startedAt: String(row.started_at),
		completedAt: String(row.completed_at)
	};
}

export async function getFocusPreferences(userId: string): Promise<FocusPreferences> {
	if (_d1) {
		const row = await d1First<Record<string, unknown>>(
			'SELECT allowed_sites, blocked_sites, updated_at FROM focus_preferences WHERE id = ? AND user_id = ?',
			'default',
			userId
		);
		if (!row) return { ...DEFAULT_FOCUS_PREFERENCES, userId };
		return {
			userId,
			allowedSites: parseSiteList(row.allowed_sites),
			blockedSites: parseSiteList(row.blocked_sites),
			updatedAt: String(row.updated_at)
		};
	}
	const all = read<FocusPreferences>('focus-preferences');
	return all.find((f) => f.userId === userId) ?? { ...DEFAULT_FOCUS_PREFERENCES, userId };
}

export async function saveFocusPreferences(
	userId: string,
	input: {
		allowedSites: string[];
		blockedSites: string[];
	}
): Promise<FocusPreferences> {
	const record: FocusPreferences = { ...input, userId, updatedAt: new Date().toISOString() };
	if (_d1) {
		await d1Run(
			`INSERT OR REPLACE INTO focus_preferences (id, user_id, allowed_sites, blocked_sites, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			'default',
			userId,
			JSON.stringify(record.allowedSites),
			JSON.stringify(record.blockedSites),
			record.updatedAt
		);
		return record;
	}
	const all = read<FocusPreferences>('focus-preferences').filter((f) => f.userId !== userId);
	write('focus-preferences', [...all, record]);
	return record;
}

export async function getStudySessions(userId: string, limit = 20): Promise<StudySession[]> {
	const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
	if (_d1) {
		const rows = await d1All<Record<string, unknown>>(
			`SELECT * FROM study_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT ${safeLimit}`,
			userId
		);
		return rows.map(rowToStudySession);
	}
	return read<StudySession>('study-sessions')
		.filter((s) => s.userId === userId)
		.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
		.slice(0, safeLimit);
}

export async function addStudySession(
	userId: string,
	input: Omit<StudySession, 'id' | 'completedAt'> & { id?: string; completedAt?: string }
): Promise<StudySession> {
	const record: StudySession = {
		...input,
		userId,
		id: input.id ?? crypto.randomUUID(),
		completedAt: input.completedAt ?? new Date().toISOString()
	};
	if (_d1) {
		await d1Run(
			`INSERT INTO study_sessions
			 (id, user_id, course_id, intention, planned_seconds, completed_seconds, distraction_count, focus_score, started_at, completed_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			record.id,
			userId,
			record.courseId,
			record.intention,
			record.plannedSeconds,
			record.completedSeconds,
			record.distractionCount,
			record.focusScore,
			record.startedAt,
			record.completedAt
		);
		return record;
	}
	const sessions = read<StudySession>('study-sessions');
	write('study-sessions', [...sessions, record]);
	return record;
}
