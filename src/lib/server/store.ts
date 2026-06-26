import fs from 'node:fs';
import path from 'node:path';

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

export function getSemesters(): Semester[] {
	return read<Semester>('semesters');
}

export function addSemester(s: Semester): void {
	const all = getSemesters();
	all.push(s);
	write('semesters', all);
}

export function updateSemester(id: string, updates: Partial<Omit<Semester, 'id'>>): void {
	const all = getSemesters();
	const idx = all.findIndex((s) => s.id === id);
	if (idx !== -1) {
		all[idx] = { ...all[idx], ...updates };
		write('semesters', all);
	}
}

export function deleteSemester(id: string): void {
	const all = getSemesters().filter((s) => s.id !== id);
	write('semesters', all);
	// cascade: delete courses for this semester
	const courses = getCourses().filter((c) => c.semesterId !== id);
	write('courses', courses);
}

export function getCourses(semesterId?: string): Course[] {
	const all = read<Course>('courses');
	return semesterId ? all.filter((c) => c.semesterId === semesterId) : all;
}

export function addCourse(c: Course): void {
	const all = getCourses();
	all.push(c);
	write('courses', all);
}

export function updateCourse(id: string, updates: Partial<Course>): void {
	const all = getCourses();
	const idx = all.findIndex((c) => c.id === id);
	if (idx !== -1) {
		all[idx] = { ...all[idx], ...updates };
		write('courses', all);
	}
}

export function deleteCourse(id: string): void {
	const all = getCourses().filter((c) => c.id !== id);
	write('courses', all);
}

export function getGraphState(): GraphState {
	const [state] = read<GraphState>('graph');
	return state ?? { positions: {}, edges: [] };
}

export function saveGraphState(state: GraphState): void {
	write('graph', [state]);
}

// -- Academic Progress Digest --

function currentCourseCredits(courses: Course[]): number {
	return courses.reduce((sum, course) => sum + (course.credits ?? 3), 0);
}

export function getAcademicDigest(): AcademicDigest | null {
	return read<AcademicDigest>('academic-digest').at(-1) ?? null;
}

export function buildAcademicDigest(input?: {
	fileName?: string;
	source?: AcademicDigest['source'];
	analysis?: AcademicDigestAnalysis;
}): AcademicDigest {
	const courses = getCourses();
	const source = input?.source ?? (courses.length > 0 ? 'setup-import' : 'sample');
	const currentCourseCount = courses.length;
	const currentCredits = courses.length > 0 ? currentCourseCredits(courses) : 0;
	const fileName = input?.fileName?.trim();
	const analyticsLabel = input?.analysis?.extractionSource === 'openrouter' ? 'OpenRouter' : 'backend';
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
		currentCourseCount: input?.analysis?.currentCourseCount ?? currentCourseCount,
		finishedCourseCount: input?.analysis?.finishedCourseCount ?? 0,
		currentCredits: input?.analysis?.currentCredits ?? currentCredits,
		finishedCredits: input?.analysis?.finishedCredits ?? 0,
		courses: input?.analysis?.courses ?? [],
		trend: input?.analysis?.trend ?? [],
		insights: input?.analysis?.insights ?? [],
		extractionSource: input?.analysis?.extractionSource ?? 'fallback',
		updatedAt: new Date().toISOString()
	};
}

export function saveAcademicDigest(input?: {
	fileName?: string;
	source?: AcademicDigest['source'];
	analysis?: AcademicDigestAnalysis;
}): AcademicDigest {
	const record = buildAcademicDigest(input);
	write('academic-digest', [record]);
	return record;
}

export function clearAcademicDigest(): AcademicDigest {
	write('academic-digest', []);
	return buildAcademicDigest();
}

// ── Syllabus Intelligence ──

export function getSyllabusImports(): SyllabusImport[] {
	return read<SyllabusImport>('syllabus-imports');
}

export function getSyllabusImport(courseId?: string): SyllabusImport | null {
	const imports = getSyllabusImports();
	if (courseId) return imports.find((item) => item.courseId === courseId) ?? null;
	return imports.at(-1) ?? null;
}

export function clearSyllabusImport(courseId?: string): null {
	if (courseId) {
		write(
			'syllabus-imports',
			getSyllabusImports().filter((item) => item.courseId !== courseId)
		);
		return null;
	}
	write('syllabus-imports', []);
	return null;
}

export function mockExtractSyllabus(
	fileName = 'CSIS 4495 Syllabus.pdf',
	courseId = 'csis-4495'
): SyllabusImport {
	return saveSyllabusImport({
		courseId,
		fileName,
		rawText:
			'Mock raw syllabus text. Replace this with PDF extraction before calling an AI parser.',
		extractedData: MOCK_SYLLABUS_DATA,
		status: 'mocked'
	});
}

export function saveSyllabusImport(input: {
	courseId?: string;
	fileName: string;
	rawText: string;
	extractedData: SyllabusExtractedData;
	status: SyllabusImport['status'];
}): SyllabusImport {
	const courseId = input.courseId?.trim() || 'csis-4495';
	const all = getSyllabusImports();
	const existing = all.find((item) => item.courseId === courseId);
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		id: existing?.id ?? crypto.randomUUID(),
		courseId,
		fileName: input.fileName,
		rawText: input.rawText,
		extractedData: {
			...input.extractedData,
			requiredMaterials:
				existing?.extractedData.requiredMaterials ?? input.extractedData.requiredMaterials
		},
		status: input.status,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	};

	write('syllabus-imports', [...all.filter((item) => item.courseId !== courseId), record]);
	return record;
}

export function updateSyllabusTextbook(fileName: string, courseId?: string): SyllabusImport {
	const existing = getSyllabusImport(courseId) ?? mockExtractSyllabus(undefined, courseId);
	const all = getSyllabusImports();
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

	write('syllabus-imports', [...all.filter((item) => item.courseId !== record.courseId), record]);
	void fileName;
	return record;
}

