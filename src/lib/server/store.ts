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