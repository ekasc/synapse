import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Force the store to use a per-test data directory by overriding process.cwd.
// Imported AFTER setup so the module's path.resolve('.data') binds to the new cwd.
const testDir = mkdtempSync(join(tmpdir(), 'synapse-store-'));
process.chdir(testDir);

const {
	addCourse,
	addSemester,
	getCourses,
	getGraphState,
	getSemesters,
	saveGraphState,
	updateCourse,
	deleteCourse,
	deleteSemester,
	applyGraphImport,
	setStoreDb,
	sanitizeCourseColor
} = await import('./store');

beforeEach(() => {
	setStoreDb(null);
	rmSync(join(testDir, '.data'), { recursive: true, force: true });
});

function courseBinding(signals: string | null) {
	const stored = {
		id: 'd1-course',
		semesterId: 's1',
		code: 'CSIS 2200',
		name: 'Systems',
		instructor: null,
		credits: 3,
		tag: null,
		color: null,
		signals
	};
	return {
		stored,
		binding: {
			prepare: vi.fn(() => ({
				bind() {
					return this;
				},
				async all() {
					return { results: [{ ...stored }] };
				}
			}))
		} as unknown as D1Database
	};
}

describe('D1 course row mapping', () => {
	it('parses valid signal status and topic arrays without mutating the stored row', async () => {
		const raw = JSON.stringify({ status: 'active', topics: ['joins', 'indexes'] });
		const { binding, stored } = courseBinding(raw);
		setStoreDb(binding);

		const [course] = await getCourses();

		expect(course.signals?.status).toBe('active');
		expect(course.signals?.topics).toEqual(['joins', 'indexes']);
		expect(stored.signals).toBe(raw);
	});

	it.each([null, '', '{bad json', JSON.stringify({ status: 'unknown' }), JSON.stringify([])])(
		'falls back to undefined for invalid database signals %s',
		async (signals) => {
			const { binding } = courseBinding(signals);
			setStoreDb(binding);
			expect((await getCourses())[0]?.signals).toBeUndefined();
		}
	);

	it('leaves filesystem signal objects unchanged', async () => {
		const signals = { status: 'planned' as const, topics: ['foundations'] };
		await addCourse({
			id: 'fs-course',
			semesterId: 's1',
			code: 'CSIS 1000',
			name: 'Foundations',
			signals
		});
		expect((await getCourses())[0]?.signals).toEqual(signals);
	});
});

describe('sanitizeCourseColor', () => {
	it('accepts 3-, 6-, and 8-digit hex colors', () => {
		expect(sanitizeCourseColor('#fff')).toBe('#fff');
		expect(sanitizeCourseColor('#FFFFFF')).toBe('#FFFFFF');
		expect(sanitizeCourseColor('#1a1814ff')).toBe('#1a1814ff');
	});

	it('strips whitespace around valid values', () => {
		expect(sanitizeCourseColor('  #abc  ')).toBe('#abc');
	});

	it('rejects CSS injection attempts with semicolons or parens', () => {
		expect(sanitizeCourseColor('red; background: url(http://evil)')).toBeUndefined();
		expect(sanitizeCourseColor('rgb(1,2,3)')).toBeUndefined();
		expect(sanitizeCourseColor('hsl(0 0% 0%)')).toBeUndefined();
	});

	it('rejects quoted-value breakouts and non-string input', () => {
		expect(sanitizeCourseColor('foo"bar')).toBeUndefined();
		expect(sanitizeCourseColor("'; display:none")).toBeUndefined();
		expect(sanitizeCourseColor(null)).toBeUndefined();
		expect(sanitizeCourseColor(undefined)).toBeUndefined();
		expect(sanitizeCourseColor(0xffffff)).toBeUndefined();
	});
});

describe('addCourse / updateCourse color sanitization', () => {
	const base = {
		id: 'c1',
		semesterId: 's1',
		code: 'CSIS 1000',
		name: 'Foundations'
	};

	it('strips a malicious color on add', async () => {
		await addCourse({ ...base, color: 'red; background: url(http://evil)' });
		const courses = await getCourses();
		expect(courses[0]?.color).toBeUndefined();
	});

	it('strips a malicious color on update', async () => {
		await addCourse({ ...base });
		await updateCourse('c1', { color: '#fff; color: red' });
		const courses = await getCourses();
		expect(courses[0]?.color).toBeUndefined();
	});

	it('keeps a valid hex color on update', async () => {
		await addCourse({ ...base });
		await updateCourse('c1', { color: '#4a6fa5' });
		const courses = await getCourses();
		expect(courses[0]?.color).toBe('#4a6fa5');
	});

	it('clears the color when an invalid value is sent', async () => {
		await addCourse({ ...base, color: '#fff' });
		await updateCourse('c1', { color: 'red; bad' });
		const courses = await getCourses();
		expect(courses[0]?.color).toBeUndefined();
	});

	it('survives a delete without resurrecting the bad color', async () => {
		await addCourse({ ...base, color: 'red; bad' });
		await deleteCourse('c1');
		const courses = await getCourses();
		expect(courses).toHaveLength(0);
	});
});

describe('Course Linker deletion integrity', () => {
	beforeEach(async () => {
		await addSemester({ id: 's1', term: 'Fall', year: 2026, order: 1 });
		await addSemester({ id: 's2', term: 'Spring', year: 2027, order: 2 });
		await addCourse({ id: 'c1', semesterId: 's1', code: 'ONE', name: 'One' });
		await addCourse({ id: 'c2', semesterId: 's1', code: 'TWO', name: 'Two' });
		await addCourse({ id: 'c3', semesterId: 's2', code: 'THREE', name: 'Three' });
		await saveGraphState({
			positions: { c1: { x: 1, y: 1 }, c2: { x: 2, y: 2 }, c3: { x: 3, y: 3 } },
			edges: [
				{ id: 'e1', source: 'c1', target: 'c2' },
				{ id: 'e2', source: 'c2', target: 'c3' },
				{ id: 'e3', source: 'c3', target: 'external' }
			]
		});
	});

	it('deletes a course position and incident edges without touching unrelated graph data', async () => {
		await deleteCourse('c2');
		expect((await getCourses()).map((course) => course.id)).toEqual(['c1', 'c3']);
		expect(await getGraphState()).toEqual({
			positions: { c1: { x: 1, y: 1 }, c3: { x: 3, y: 3 } },
			edges: [{ id: 'e3', source: 'c3', target: 'external' }]
		});
	});

	it('deletes all semester courses and their graph data while retaining other semesters', async () => {
		await deleteSemester('s1');
		expect((await getSemesters()).map((semester) => semester.id)).toEqual(['s2']);
		expect((await getCourses()).map((course) => course.id)).toEqual(['c3']);
		expect(await getGraphState()).toEqual({
			positions: { c3: { x: 3, y: 3 } },
			edges: [{ id: 'e3', source: 'c3', target: 'external' }]
		});
	});
});

describe('Course Linker D1 atomic writes', () => {
	it('submits the complete import as one batch and propagates a batch rollback failure', async () => {
		const prepared: { sql: string; values: unknown[] }[] = [];
		const binding = {
			prepare(sql: string) {
				return {
					bind(...values: unknown[]) {
						const statement = { sql, values };
						prepared.push(statement);
						return statement;
					}
				};
			},
			batch: vi.fn().mockRejectedValue(new Error('D1 batch rolled back'))
		} as unknown as D1Database;
		setStoreDb(binding);

		await expect(
			applyGraphImport(
				[
					{
						course: { id: 'atomic', semesterId: 's1', code: 'ATOMIC', name: 'Atomic' },
						existing: false
					}
				],
				{ positions: { atomic: { x: 1, y: 2 } }, edges: [] }
			)
		).rejects.toThrow('D1 batch rolled back');
		expect(binding.batch).toHaveBeenCalledTimes(1);
		expect(binding.batch).toHaveBeenCalledWith(prepared);
		expect(prepared.map((statement) => statement.sql)).toEqual([
			expect.stringContaining('INSERT INTO courses'),
			expect.stringContaining('INSERT OR REPLACE INTO graph_state')
		]);
		setStoreDb(null);
	});
});
