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

// ── Course Briefs ──

export type Briefing = {
	code: string;
	name: string;
	institution: string;
	professor: string;
	rmpRating: string;
	rmpCount?: number;
	workload: string;
	weeklyHours?: string;
	prereqReadiness: string;
	gradeStructure: { item: string; weight: string }[];
	recommendation: string;
	sources: { description: string; url?: string; found: boolean }[];
	researchedAt: string;
};

export function getBriefs(): Briefing[] {
	return read<Briefing>('briefs');
}

export function saveBrief(brief: Briefing): void {
	const all = getBriefs().filter((b) => b.code !== brief.code);
	all.push(brief);
	write('briefs', all);
}

export function getBrief(code: string): Briefing | undefined {
	return getBriefs().find((b) => b.code.toUpperCase() === code.toUpperCase());
}

// ── Course Materials ──

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureUploadsDir() {
	ensureDir();
	if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export type Material = {
	id: string;
	courseId: string;
	fileName: string;
	mimeType: string;
	size: number;
	uploadedAt: string;
};

export function getMaterials(courseId?: string): Material[] {
	const all = read<Material>('materials');
	return courseId ? all.filter((m) => m.courseId === courseId) : all;
}

export function getMaterial(id: string): Material | undefined {
	return read<Material>('materials').find((m) => m.id === id);
}

export async function addMaterial(courseId: string, file: File): Promise<Material> {
	ensureUploadsDir();
	const id = crypto.randomUUID();
	const safeName = path.basename(file.name).replace(/[^\w.\- ]/g, '_');
	const ext = path.extname(safeName);
	const storageName = id + ext;
	const buffer = Buffer.from(await file.arrayBuffer());
	fs.writeFileSync(path.join(UPLOADS_DIR, storageName), buffer);
	const material: Material = {
		id,
		courseId,
		fileName: safeName,
		mimeType: file.type || 'application/octet-stream',
		size: buffer.byteLength,
		uploadedAt: new Date().toISOString()
	};
	const all = getMaterials();
	all.push(material);
	write('materials', all);
	return material;
}

export function deleteMaterial(id: string): void {
	const all = getMaterials();
	const target = all.find((m) => m.id === id);
	if (target) {
		const ext = path.extname(target.fileName);
		const filePath = path.join(UPLOADS_DIR, id + ext);
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
	}
	write(
		'materials',
		all.filter((m) => m.id !== id)
	);
}

export function readMaterialBytes(material: Material): Buffer {
	const ext = path.extname(material.fileName);
	const filePath = path.join(UPLOADS_DIR, material.id + ext);
	return fs.readFileSync(filePath);
}

// ── Syllabus Intelligence ──

export function getSyllabusImport(): SyllabusImport | null {
	return read<SyllabusImport>('syllabus-imports').at(-1) ?? null;
}

export function mockExtractSyllabus(fileName = 'CSIS 4495 Syllabus.pdf'): SyllabusImport {
	return saveSyllabusImport({
		fileName,
		rawText:
			'Mock raw syllabus text. Replace this with PDF extraction before calling an AI parser.',
		extractedData: MOCK_SYLLABUS_DATA,
		status: 'mocked'
	});
}

export function saveSyllabusImport(input: {
	fileName: string;
	rawText: string;
	extractedData: SyllabusExtractedData;
	status: SyllabusImport['status'];
}): SyllabusImport {
	const existing = getSyllabusImport();
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		id: existing?.id ?? crypto.randomUUID(),
		courseId: existing?.courseId ?? 'csis-4495',
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

	write('syllabus-imports', [record]);
	return record;
}

export function updateSyllabusTextbook(fileName: string): SyllabusImport {
	const existing = getSyllabusImport() ?? mockExtractSyllabus();
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

	write('syllabus-imports', [record]);
	void fileName;
	return record;
}
