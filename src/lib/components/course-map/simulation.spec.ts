import { describe, expect, it } from 'vitest';
import { simulateCourseMove } from './simulation';
import type { MapCourse, MapRelation, MapSemester } from './types';

const semesters: MapSemester[] = [
	{ id: 's1', term: 'Fall', year: 2025, order: 1 },
	{ id: 's2', term: 'Winter', year: 2026, order: 2 },
	{ id: 's3', term: 'Fall', year: 2026, order: 3 },
	{ id: 's4', term: 'Winter', year: 2027, order: 4 },
	{ id: 's5', term: 'Fall', year: 2027, order: 5 }
];
const courses: MapCourse[] = [
	{ id: 'a', semesterId: 's1', code: 'A', name: 'A' },
	{ id: 'b', semesterId: 's2', code: 'B', name: 'B' },
	{ id: 'c', semesterId: 's3', code: 'C', name: 'C' },
	{ id: 'd', semesterId: 's4', code: 'D', name: 'D' },
	{ id: 'e', semesterId: 's5', code: 'E', name: 'E' },
	{ id: 'x', semesterId: 's2', code: 'X', name: 'X' },
	{ id: 'y', semesterId: 's4', code: 'Y', name: 'Y' }
];
const edge = (
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
const simulate = (
	id: string,
	target: string,
	edges: MapRelation[] = [],
	courseList = courses,
	semesterList = semesters
) => simulateCourseMove(id, target, courseList, semesterList, edges);

describe('course move simulation', () => {
	it('returns no-op for the current semester', () => {
		expect(simulate('b', 's2')).toEqual({ status: 'no-op', courseId: 'b', semesterId: 's2' });
	});

	it('moves earlier while prerequisites remain valid', () => {
		expect(simulate('c', 's2', [edge('a', 'c')])).toMatchObject({ status: 'valid' });
	});

	it('reports moving earlier than a direct prerequisite', () => {
		expect(simulate('c', 's1', [edge('b', 'c')])).toMatchObject({
			status: 'invalid',
			selectedCourseViolations: [{ reason: 'prerequisite-scheduled-later' }]
		});
	});

	it('reports moving into the same semester as a prerequisite', () => {
		expect(simulate('c', 's2', [edge('b', 'c')])).toMatchObject({
			status: 'invalid',
			selectedCourseViolations: [{ reason: 'same-semester' }]
		});
	});

	it('moves later without affecting dependants', () => {
		expect(simulate('b', 's3', [edge('a', 'b')])).toMatchObject({
			status: 'valid',
			downstreamImpacts: []
		});
	});

	it('moving later makes one direct dependant invalid', () => {
		expect(simulate('b', 's4', [edge('b', 'c')])).toMatchObject({
			status: 'invalid',
			newlyIntroducedViolations: [{ courseId: 'c' }]
		});
	});

	it('moving later affects multiple direct dependants', () => {
		const result = simulate('b', 's5', [edge('b', 'c'), edge('b', 'd')]);
		expect(result).toMatchObject({ status: 'invalid' });
		if (result.status === 'invalid') expect(result.newlyIntroducedViolations).toHaveLength(2);
	});

	it('moving later delays a transitive dependant', () => {
		const result = simulate('b', 's4', [edge('b', 'c'), edge('c', 'd')]);
		expect(result).toMatchObject({ status: 'invalid' });
		if (result.status === 'invalid')
			expect(
				result.downstreamImpacts.some(
					(impact) => impact.courseId === 'd' && impact.impact === 'eligible-later'
				)
			).toBe(true);
	});

	it('resolves a pre-existing violation', () => {
		const invalid = courses.map((course) =>
			course.id === 'b' ? { ...course, semesterId: 's1' } : course
		);
		const result = simulate('b', 's2', [edge('a', 'b')], invalid);
		expect(result).toMatchObject({ status: 'valid', resolvedViolations: [{ courseId: 'b' }] });
	});

	it('does not classify unrelated pre-existing violations as new', () => {
		const result = simulate('b', 's3', [edge('e', 'a')]);
		expect(result).toMatchObject({
			status: 'valid',
			newlyIntroducedViolations: [],
			unchangedViolations: [{ courseId: 'a' }]
		});
	});

	it('separates newly introduced and unchanged violations', () => {
		const result = simulate('b', 's4', [edge('e', 'a'), edge('b', 'c')]);
		expect(result).toMatchObject({ status: 'invalid' });
		if (result.status === 'invalid') {
			expect(result.newlyIntroducedViolations).toHaveLength(1);
			expect(result.unchangedViolations).toHaveLength(1);
		}
	});

	it('handles multiple prerequisites converging on the moved course', () => {
		expect(simulate('c', 's3', [edge('a', 'c'), edge('b', 'c')])).toEqual({
			status: 'no-op',
			courseId: 'c',
			semesterId: 's3'
		});
	});

	it('handles one moved course unlocking multiple paths', () => {
		const result = simulate('b', 's1', [edge('b', 'c'), edge('b', 'd')]);
		expect(result).toMatchObject({ status: 'valid' });
		if (result.status === 'valid') expect(result.downstreamImpacts).toHaveLength(2);
	});

	it('handles a diamond dependency graph', () => {
		const result = simulate('a', 's2', [
			edge('a', 'b'),
			edge('a', 'x'),
			edge('b', 'c'),
			edge('x', 'c')
		]);
		expect(result).toMatchObject({ status: 'invalid' });
		if (result.status === 'invalid')
			expect(new Set(result.downstreamImpacts.map((impact) => impact.courseId)).size).toBe(3);
	});

	it('ignores pending edges', () => {
		expect(simulate('b', 's5', [edge('b', 'c', { reviewStatus: 'pending' })])).toMatchObject({
			status: 'valid'
		});
	});

	it('ignores rejected edges', () => {
		expect(simulate('b', 's5', [edge('b', 'c', { reviewStatus: 'rejected' })])).toMatchObject({
			status: 'valid'
		});
	});

	it('ignores non-prerequisite edges', () => {
		expect(simulate('b', 's5', [edge('b', 'c', { type: 'related' })])).toMatchObject({
			status: 'valid'
		});
	});

	it('deduplicates accepted edges and impacts', () => {
		const result = simulate('b', 's5', [edge('b', 'c'), edge('b', 'c', { id: 'copy' })]);
		expect(result).toMatchObject({ status: 'invalid' });
		if (result.status === 'invalid') {
			expect(result.newlyIntroducedViolations).toHaveLength(1);
			expect(result.downstreamImpacts).toHaveLength(1);
		}
	});

	it('rejects a missing selected course', () => {
		expect(simulate('missing', 's2')).toEqual({
			status: 'invalid-input',
			reason: 'course-not-found'
		});
	});

	it('rejects a missing target semester', () => {
		expect(simulate('b', 'missing')).toEqual({
			status: 'invalid-input',
			reason: 'semester-not-found'
		});
	});

	it('rejects Unplaced as a target', () => {
		expect(simulate('b', '__unplaced__')).toEqual({
			status: 'invalid-input',
			reason: 'target-is-unplaced'
		});
	});

	it('previews an Unplaced selected course in a real semester', () => {
		const unplaced = [...courses, { id: 'u', semesterId: 'unknown', code: 'U', name: 'U' }];
		expect(simulate('u', 's3', [], unplaced)).toMatchObject({
			status: 'valid',
			currentSemesterId: null
		});
	});

	it('returns unknown for a missing prerequisite', () => {
		expect(simulate('b', 's3', [edge('missing', 'b')])).toEqual({
			status: 'unknown',
			courseId: 'b',
			missingCourseIds: ['missing'],
			unplacedPrerequisiteIds: []
		});
	});

	it('returns unknown for an Unplaced prerequisite', () => {
		const unplaced = courses.map((course) =>
			course.id === 'a' ? { ...course, semesterId: 'unknown' } : course
		);
		expect(simulate('b', 's3', [edge('a', 'b')], unplaced)).toMatchObject({
			status: 'unknown',
			unplacedPrerequisiteIds: ['a']
		});
	});

	it('handles an unknown semester ID explicitly', () => {
		const unknown = courses.map((course) =>
			course.id === 'c' ? { ...course, semesterId: 'unknown' } : course
		);
		const result = simulate('b', 's3', [edge('b', 'c')], unknown);
		expect(result).toMatchObject({
			status: 'valid',
			unchangedViolations: [{ reason: 'unknown-semester' }]
		});
	});

	it('detects a self-cycle', () => {
		expect(simulate('b', 's3', [edge('b', 'b')])).toEqual({
			status: 'cycle',
			courseId: 'b',
			cycleCourseIds: ['b', 'b']
		});
	});

	it('detects a two-course cycle', () => {
		expect(simulate('b', 's3', [edge('b', 'c'), edge('c', 'b')])).toMatchObject({
			status: 'cycle'
		});
	});

	it('detects a longer cycle', () => {
		expect(simulate('a', 's2', [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')])).toMatchObject({
			status: 'cycle'
		});
	});

	it('reports downstream eligibility outside the current plan', () => {
		const result = simulate('b', 's5', [edge('b', 'e')]);
		expect(result).toMatchObject({ status: 'invalid' });
		if (result.status === 'invalid')
			expect(result.downstreamImpacts[0].impact).toBe('outside-plan');
	});

	it('sorts unsorted semester input', () => {
		expect(simulate('b', 's3', [edge('a', 'b')], courses, [...semesters].reverse())).toMatchObject({
			status: 'valid'
		});
	});

	it('does not mutate course or relation inputs', () => {
		const courseInput = structuredClone(courses);
		const relationInput = [edge('a', 'b')];
		const courseSnapshot = structuredClone(courseInput);
		const relationSnapshot = structuredClone(relationInput);
		simulateCourseMove('b', 's3', courseInput, semesters, relationInput);
		expect(courseInput).toEqual(courseSnapshot);
		expect(relationInput).toEqual(relationSnapshot);
	});

	it('is deterministic when re-running the same simulation', () => {
		const relations = [edge('a', 'b'), edge('b', 'c')];
		expect(simulate('b', 's4', relations)).toEqual(simulate('b', 's4', relations));
	});
});
