import { describe, expect, it } from 'vitest';
import { createStaticLayout, getOrderedColumns } from './layout';
import type { MapCourse, MapSemester } from './types';

const semesters: MapSemester[] = [
	{ id: 's2', term: 'Winter', year: 2026, order: 2 },
	{ id: 's1', term: 'Fall', year: 2025, order: 1 },
	{ id: 'empty', term: 'Summer', year: 2026, order: 3 }
];
const courses: MapCourse[] = [
	{ id: 'b', semesterId: 's1', code: 'CSIS 2000', name: 'B' },
	{ id: 'a', semesterId: 's1', code: 'CSIS 1000', name: 'A' },
	{ id: 'c', semesterId: 's2', code: 'CSIS 3000', name: 'C' },
	{ id: 'u', semesterId: 'missing', code: 'CSIS 4000', name: 'U' }
];

describe('course map layout', () => {
	it('is deterministic regardless of input ordering', () => {
		expect(createStaticLayout(courses, semesters)).toEqual(
			createStaticLayout([...courses].reverse(), [...semesters].reverse())
		);
	});

	it('does not overlap courses in one semester', () => {
		const { positions } = createStaticLayout(courses, semesters);
		expect(positions.b.y).toBeGreaterThanOrEqual(positions.a.y + positions.a.height);
	});

	it('uses semester order for columns', () => {
		const { positions } = createStaticLayout(courses, semesters);
		expect(positions.a.x).toBeLessThan(positions.c.x);
	});

	it('retains empty semester columns', () => {
		expect(getOrderedColumns(courses, semesters).map((column) => column.id)).toEqual([
			's1',
			's2',
			'empty',
			'__unplaced__'
		]);
	});

	it('places unknown semesters in a final Unplaced column', () => {
		const columns = getOrderedColumns(courses, semesters);
		expect(columns.at(-1)).toEqual({ id: '__unplaced__', label: 'Unplaced' });
		expect(createStaticLayout(courses, semesters).positions.u.x).toBeGreaterThan(
			createStaticLayout(courses, semesters).positions.c.x
		);
	});

	it('contains every node within the canvas dimensions', () => {
		const layout = createStaticLayout(courses, semesters);
		for (const position of Object.values(layout.positions)) {
			expect(position.x + position.width).toBeLessThanOrEqual(layout.width);
			expect(position.y + position.height).toBeLessThanOrEqual(layout.height);
		}
	});
});
