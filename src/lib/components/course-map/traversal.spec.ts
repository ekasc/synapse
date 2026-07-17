import { describe, expect, it } from 'vitest';
import {
	findPrerequisiteCycles,
	getAllDependants,
	getAllPrerequisites,
	getBlockingPrerequisites,
	getDirectDependants,
	getDirectPrerequisites,
	getEarliestEligibleSemester
} from './traversal';
import type { MapCourse, MapRelation, MapSemester } from './types';

const semesters: MapSemester[] = [
	{ id: 's1', term: 'Fall', year: 2025, order: 1 },
	{ id: 's2', term: 'Winter', year: 2026, order: 2 },
	{ id: 's3', term: 'Fall', year: 2026, order: 3 }
];
const courses: MapCourse[] = [
	{ id: 'a', semesterId: 's1', code: 'CSIS 1000', name: 'A' },
	{ id: 'b', semesterId: 's2', code: 'CSIS 2000', name: 'B' },
	{ id: 'c', semesterId: 's3', code: 'CSIS 3000', name: 'C' },
	{ id: 'd', semesterId: 's3', code: 'CSIS 3001', name: 'D' }
];
const relation = (
	source: string,
	target: string,
	overrides: Partial<MapRelation> = {}
): MapRelation => ({
	id: `${source}-${target}`,
	source,
	target,
	type: 'prereq',
	...overrides
});

describe('earliest eligible semester', () => {
	const eligible = (
		courseId: string,
		courseList = courses,
		semesterList = semesters,
		edges: MapRelation[] = []
	) => getEarliestEligibleSemester(courseId, courseList, semesterList, edges);

	it('returns already eligible with no prerequisites', () => {
		expect(eligible('a')).toEqual({ status: 'already-eligible' });
	});

	it('finds the semester after one prerequisite', () => {
		expect(eligible('b', courses, semesters, [relation('a', 'b')])).toMatchObject({
			status: 'eligible',
			semesterId: 's2',
			scheduleStatus: 'valid'
		});
	});

	it('uses the latest of multiple prerequisite semesters', () => {
		expect(
			eligible('c', courses, semesters, [relation('a', 'c'), relation('b', 'c')])
		).toMatchObject({
			status: 'eligible',
			semesterId: 's3'
		});
	});

	it('includes a transitive prerequisite chain', () => {
		expect(
			eligible('c', courses, semesters, [relation('a', 'b'), relation('b', 'c')])
		).toMatchObject({
			status: 'eligible',
			latestPrerequisiteCourseIds: ['b']
		});
	});

	it('deduplicates a diamond-shaped dependency graph', () => {
		const diamondCourses = [...courses, { id: 'x', semesterId: 's2', code: 'X', name: 'X' }];
		expect(
			eligible('c', diamondCourses, semesters, [
				relation('a', 'b'),
				relation('a', 'x'),
				relation('b', 'c'),
				relation('x', 'c')
			])
		).toMatchObject({ status: 'eligible', latestPrerequisiteCourseIds: ['b', 'x'] });
	});

	it('does not satisfy a prerequisite in the same semester', () => {
		expect(eligible('c', courses, semesters, [relation('d', 'c')])).toMatchObject({
			status: 'outside-plan'
		});
	});

	it('reports a course scheduled before its earliest semester', () => {
		const early = courses.map((course) =>
			course.id === 'c' ? { ...course, semesterId: 's1' } : course
		);
		expect(eligible('c', early, semesters, [relation('b', 'c')])).toMatchObject({
			scheduleStatus: 'too-early'
		});
	});

	it('reports a course scheduled exactly in its earliest semester', () => {
		expect(eligible('c', courses, semesters, [relation('b', 'c')])).toMatchObject({
			scheduleStatus: 'valid'
		});
	});

	it('reports a course scheduled later than necessary', () => {
		const late = courses.map((course) =>
			course.id === 'c' ? { ...course, semesterId: 's3' } : course
		);
		expect(eligible('c', late, semesters, [relation('a', 'c')])).toMatchObject({
			scheduleStatus: 'later-than-necessary'
		});
	});

	it('returns unknown for a missing prerequisite course', () => {
		expect(eligible('b', courses, semesters, [relation('missing', 'b')])).toEqual({
			status: 'unknown',
			missingCourseIds: ['missing'],
			missingRelationIds: ['missing-b'],
			unplacedCourseIds: []
		});
	});

	it('returns unknown for an unplaced prerequisite', () => {
		const unplaced = courses.map((course) =>
			course.id === 'a' ? { ...course, semesterId: 'missing' } : course
		);
		expect(eligible('b', unplaced, semesters, [relation('a', 'b')])).toMatchObject({
			status: 'unknown',
			unplacedCourseIds: ['a']
		});
	});

	it('ignores a pending prerequisite', () => {
		expect(
			eligible('b', courses, semesters, [relation('a', 'b', { reviewStatus: 'pending' })])
		).toEqual({ status: 'already-eligible' });
	});

	it('ignores a rejected prerequisite', () => {
		expect(
			eligible('b', courses, semesters, [relation('a', 'b', { reviewStatus: 'rejected' })])
		).toEqual({ status: 'already-eligible' });
	});

	it('ignores a non-prerequisite relation', () => {
		expect(eligible('b', courses, semesters, [relation('a', 'b', { type: 'related' })])).toEqual({
			status: 'already-eligible'
		});
	});

	it('deduplicates accepted edges', () => {
		expect(
			eligible('b', courses, semesters, [relation('a', 'b'), relation('a', 'b', { id: 'copy' })])
		).toMatchObject({ status: 'eligible', latestPrerequisiteCourseIds: ['a'] });
	});

	it('detects a self-cycle', () => {
		expect(eligible('a', courses, semesters, [relation('a', 'a')])).toEqual({
			status: 'cycle',
			cycleCourseIds: ['a', 'a']
		});
	});

	it('detects a two-course cycle', () => {
		expect(
			eligible('b', courses, semesters, [relation('a', 'b'), relation('b', 'a')])
		).toMatchObject({ status: 'cycle' });
	});

	it('detects a longer prerequisite cycle', () => {
		expect(
			eligible('d', courses, semesters, [
				relation('a', 'b'),
				relation('b', 'c'),
				relation('c', 'a'),
				relation('c', 'd')
			])
		).toMatchObject({ status: 'cycle' });
	});

	it('returns outside plan when the latest prerequisite is in the final semester', () => {
		expect(eligible('b', courses, semesters, [relation('c', 'b')])).toMatchObject({
			status: 'outside-plan',
			latestPrerequisiteSemesterId: 's3'
		});
	});

	it('sorts semester inputs by order', () => {
		expect(eligible('b', courses, [...semesters].reverse(), [relation('a', 'b')])).toMatchObject({
			status: 'eligible',
			semesterId: 's2'
		});
	});

	it('returns unknown for a prerequisite with an unknown semester ID', () => {
		const unknownSemester = courses.map((course) =>
			course.id === 'a' ? { ...course, semesterId: 'unknown' } : course
		);
		expect(eligible('b', unknownSemester, semesters, [relation('a', 'b')])).toMatchObject({
			status: 'unknown',
			unplacedCourseIds: ['a']
		});
	});

	it('returns unknown when the selected course is missing', () => {
		expect(eligible('missing')).toEqual({
			status: 'unknown',
			missingCourseIds: ['missing'],
			missingRelationIds: [],
			unplacedCourseIds: []
		});
	});
});

describe('course map traversal', () => {
	it('finds one direct prerequisite', () => {
		expect(getDirectPrerequisites('b', [relation('a', 'b')])).toEqual(['a']);
	});

	it('finds a multi-level prerequisite chain', () => {
		expect(getAllPrerequisites('c', [relation('a', 'b'), relation('b', 'c')])).toEqual(['b', 'a']);
	});

	it('finds multiple courses unlocked by one prerequisite', () => {
		expect(getDirectDependants('a', [relation('a', 'b'), relation('a', 'c')])).toEqual(['b', 'c']);
	});

	it('finds multiple prerequisites converging on one course', () => {
		expect(getDirectPrerequisites('c', [relation('a', 'c'), relation('b', 'c')])).toEqual([
			'a',
			'b'
		]);
	});

	it('deduplicates duplicate edges', () => {
		expect(
			getDirectPrerequisites('b', [relation('a', 'b'), relation('a', 'b', { id: 'copy' })])
		).toEqual(['a']);
	});

	it('preserves missing source IDs for blocking checks', () => {
		expect(getBlockingPrerequisites('b', courses, semesters, [relation('missing', 'b')])).toEqual([
			{ courseId: 'missing', reason: 'missing' }
		]);
	});

	it('ignores an edge with a missing target when traversing known courses', () => {
		expect(getAllDependants('a', [relation('a', 'missing')])).toEqual(['missing']);
		expect(getBlockingPrerequisites('a', courses, semesters, [relation('b', 'missing')])).toEqual(
			[]
		);
	});

	it('handles self-references without recurring indefinitely', () => {
		expect(getAllPrerequisites('a', [relation('a', 'a')])).toEqual([]);
		expect(findPrerequisiteCycles(courses, [relation('a', 'a')])).toEqual([['a', 'a']]);
	});

	it('detects a two-course cycle', () => {
		expect(findPrerequisiteCycles(courses, [relation('a', 'b'), relation('b', 'a')])).toEqual([
			['a', 'b', 'a']
		]);
	});

	it('detects a longer cycle', () => {
		expect(
			findPrerequisiteCycles(courses, [relation('a', 'b'), relation('b', 'c'), relation('c', 'a')])
		).toEqual([['a', 'b', 'c', 'a']]);
	});

	it('ignores rejected and non-prerequisite edges', () => {
		expect(
			getDirectPrerequisites('b', [
				relation('a', 'b', { reviewStatus: 'rejected' }),
				relation('c', 'b', { type: 'related' })
			])
		).toEqual([]);
	});

	it('excludes pending edges from blocking logic', () => {
		expect(
			getBlockingPrerequisites('b', courses, semesters, [
				relation('c', 'b', { reviewStatus: 'pending' })
			])
		).toEqual([]);
	});

	it('reports a same-semester prerequisite as blocked', () => {
		expect(getBlockingPrerequisites('c', courses, semesters, [relation('d', 'c')])[0].reason).toBe(
			'same-semester'
		);
	});

	it('accepts an earlier-semester prerequisite', () => {
		expect(getBlockingPrerequisites('c', courses, semesters, [relation('a', 'c')])).toEqual([]);
	});

	it('reports a later-semester prerequisite as blocked', () => {
		expect(getBlockingPrerequisites('b', courses, semesters, [relation('c', 'b')])[0].reason).toBe(
			'scheduled-later'
		);
	});
});
