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

export type Course = {
	id: string;
	semesterId: string;
	code: string;
	name: string;
	instructor?: string;
	credits?: number;
	tag?: string;
};

export type GraphState = {
	positions: Record<string, { x: number; y: number }>;
	edges: {
		id?: string;
		source: string;
		target: string;
		label?: string;
		type?: 'prereq' | 'related' | 'concept';
		directed?: boolean;
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

export function getSyllabusImport(): SyllabusImport | null {
	return read<SyllabusImport>('syllabus-imports').at(-1) ?? null;
}

export function mockExtractSyllabus(fileName = 'CSIS 4495 Syllabus.pdf'): SyllabusImport {
	const existing = getSyllabusImport();
	const now = new Date().toISOString();
	const record: SyllabusImport = {
		id: existing?.id ?? crypto.randomUUID(),
		courseId: existing?.courseId ?? 'csis-4495',
		fileName,
		rawText:
			'Mock raw syllabus text. Replace this with PDF extraction before calling an AI parser.',
		extractedData: {
			...MOCK_SYLLABUS_DATA,
			requiredMaterials:
				existing?.extractedData.requiredMaterials ?? MOCK_SYLLABUS_DATA.requiredMaterials
		},
		status: 'mocked',
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
