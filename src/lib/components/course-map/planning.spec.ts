import { describe, expect, it } from 'vitest';
import {
	applyPlanningMove,
	createPlanningScenario,
	getScenarioHistoryInvariant,
	resetPlanningScenario,
	undoLastPlanningMove,
	undoPlanningMove
} from './planning';
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
	{ id: 'e', semesterId: 's5', code: 'E', name: 'E' }
];
const edge = (source: string, target: string): MapRelation => ({
	id: `${source}-${target}`,
	source,
	target,
	type: 'prereq'
});

describe('scenario history invariant', () => {
	function fourMoves() {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'a', 's2', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'd', 's5', semesters, relations).scenario;
		return scenario;
	}

	it('tracks all four ordered operations with stable unique keys', () => {
		const invariant = getScenarioHistoryInvariant(fourMoves());
		expect(invariant).toEqual({
			moveCount: 4,
			orderedMoveKeys: ['move-1', 'move-2', 'move-3', 'move-4'],
			uniqueKeyCount: 4
		});
	});

	it('undoes the first move while preserving later operations', () => {
		const scenario = undoPlanningMove(fourMoves(), 'move-1', semesters, relations);
		expect(scenario.moves.map((move) => move.id)).toEqual(['move-2', 'move-3', 'move-4']);
	});

	it('undoes a middle move while preserving later operations', () => {
		const scenario = undoPlanningMove(fourMoves(), 'move-2', semesters, relations);
		expect(scenario.moves.map((move) => move.id)).toEqual(['move-1', 'move-3', 'move-4']);
	});

	it('undoes the fourth move while preserving the first three', () => {
		const scenario = undoPlanningMove(fourMoves(), 'move-4', semesters, relations);
		expect(scenario.moves.map((move) => move.id)).toEqual(['move-1', 'move-2', 'move-3']);
	});

	it('undo last removes the actual fourth operation', () => {
		const scenario = undoLastPlanningMove(fourMoves(), semesters, relations);
		expect(scenario.moves.map((move) => move.id)).toEqual(['move-1', 'move-2', 'move-3']);
	});

	it('preserves repeated moves for one course as separate rows', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'b', 's4', semesters, relations).scenario;
		expect(scenario.moves.map((move) => move.courseId)).toEqual(['b', 'b']);
		expect(getScenarioHistoryInvariant(scenario).uniqueKeyCount).toBe(2);
	});

	it('does not mutate baseline while changing history', () => {
		const scenario = fourMoves();
		expect(scenario.baselineCourses).toEqual(courses);
		expect(courses.map((course) => course.semesterId)).toEqual(['s1', 's2', 's3', 's4', 's5']);
	});
});
const relations = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd'), edge('d', 'e')];

describe('planning scenarios', () => {
	it('applies multiple moves cumulatively in order', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		expect(scenario.moves.map((move) => move.courseId)).toEqual(['b', 'c']);
		expect(scenario.currentCourses.find((course) => course.id === 'b')?.semesterId).toBe('s3');
		expect(scenario.currentCourses.find((course) => course.id === 'c')?.semesterId).toBe('s4');
	});

	it('undoes an individual move and replays later moves', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		scenario = undoPlanningMove(scenario, 'move-1', semesters, relations);
		expect(scenario.currentCourses.find((course) => course.id === 'b')?.semesterId).toBe('s2');
		expect(scenario.currentCourses.find((course) => course.id === 'c')?.semesterId).toBe('s4');
	});

	it('undoes the last move', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		scenario = undoLastPlanningMove(scenario, semesters, relations);
		expect(scenario.moves).toHaveLength(1);
		expect(scenario.currentCourses.find((course) => course.id === 'c')?.semesterId).toBe('s3');
	});

	it('resets the complete scenario to baseline', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's4', semesters, relations).scenario;
		expect(resetPlanningScenario(scenario, semesters, relations)).toMatchObject({
			currentCourses: courses,
			moves: []
		});
	});

	it('derives cumulative downstream eligibility impacts', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's4', semesters, relations).scenario;
		expect(scenario.comparison.delayedCourseIds).toEqual(expect.arrayContaining(['c', 'd']));
	});

	it('preserves move order when replaying after undo', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'd', 's5', semesters, relations).scenario;
		scenario = undoPlanningMove(scenario, 'move-2', semesters, relations);
		expect(scenario.moves.map((move) => move.id)).toEqual(['move-1', 'move-3']);
	});

	it('replays deterministically', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's4', semesters, relations).scenario;
		const first = undoPlanningMove(scenario, 'missing', semesters, relations);
		const second = undoPlanningMove(scenario, 'missing', semesters, relations);
		expect(first).toEqual(second);
	});

	it('does not mutate baseline inputs or scenario baseline', () => {
		const input = structuredClone(courses);
		const snapshot = structuredClone(input);
		const original = createPlanningScenario(input, semesters, relations);
		applyPlanningMove(original, 'b', 's4', semesters, relations);
		expect(input).toEqual(snapshot);
		expect(original.baselineCourses).toEqual(snapshot);
		expect(original.currentCourses).toEqual(snapshot);
	});

	it('generates changed, conflict, resolved, earlier, and readiness comparisons', () => {
		const invalidBaseline = courses.map((course) =>
			course.id === 'b' ? { ...course, semesterId: 's1' } : course
		);
		let scenario = createPlanningScenario(invalidBaseline, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's2', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'd', 's3', semesters, relations).scenario;
		expect(scenario.comparison.changedCourseIds).toEqual(expect.arrayContaining(['b', 'd']));
		expect(scenario.comparison.resolvedConflicts.length).toBeGreaterThan(0);
		expect(scenario.comparison.movedEarlierCourseIds).toContain('d');
		expect(typeof scenario.comparison.ready).toBe('boolean');
	});

	it('derives graph and eligibility from the current simulated plan', () => {
		let scenario = createPlanningScenario(courses, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's4', semesters, relations).scenario;
		expect(scenario.graph.b).toEqual({ prerequisites: ['a'], dependants: ['c'] });
		expect(scenario.eligibility.c).toBeDefined();
	});

	it('keeps history and rendered plan synchronized through the complete workflow', () => {
		const baseline = structuredClone(courses);
		let scenario = createPlanningScenario(baseline, semesters, relations);
		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		expect(scenario.moves).toHaveLength(1);
		expect(scenario.currentCourses.find((course) => course.id === 'b')?.semesterId).toBe('s3');

		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		expect(scenario.moves.map((move) => move.courseId)).toEqual(['b', 'c']);
		expect(scenario.comparison.changedCourseIds).toEqual(['b', 'c']);

		scenario = undoPlanningMove(scenario, 'move-1', semesters, relations);
		expect(scenario.moves.map((move) => move.courseId)).toEqual(['c']);
		expect(scenario.currentCourses.find((course) => course.id === 'b')?.semesterId).toBe('s2');
		expect(scenario.currentCourses.find((course) => course.id === 'c')?.semesterId).toBe('s4');

		scenario = undoLastPlanningMove(scenario, semesters, relations);
		expect(scenario.moves).toEqual([]);
		expect(scenario.currentCourses).toEqual(baseline);

		scenario = applyPlanningMove(scenario, 'b', 's3', semesters, relations).scenario;
		scenario = applyPlanningMove(scenario, 'c', 's4', semesters, relations).scenario;
		expect(resetPlanningScenario(scenario, semesters, relations).currentCourses).toEqual(baseline);
		expect(baseline).toEqual(courses);
	});
});
