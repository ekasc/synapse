import {
	getAcceptedRelations,
	getPlanViolations,
	getViolationKey,
	simulateCourseMove,
	type CourseMoveScenario,
	type ScheduleViolation
} from './simulation';
import { getEarliestEligibleSemester, type EligibilityResult } from './traversal';
import type { MapCourse, MapRelation, MapSemester } from './types';

export type PlanningMove = {
	id: string;
	courseId: string;
	fromSemesterId: string | null;
	targetSemesterId: string;
};

export type PlanningComparison = {
	changedCourseIds: string[];
	newConflicts: ScheduleViolation[];
	resolvedConflicts: ScheduleViolation[];
	delayedCourseIds: string[];
	movedEarlierCourseIds: string[];
	ready: boolean;
};

export type PlanningScenario = {
	baselineCourses: MapCourse[];
	currentCourses: MapCourse[];
	moves: PlanningMove[];
	graph: Record<string, { prerequisites: string[]; dependants: string[] }>;
	eligibility: Record<string, EligibilityResult>;
	comparison: PlanningComparison;
};

export type PlanningMoveResult = {
	scenario: PlanningScenario;
	result: CourseMoveScenario;
};

export function getScenarioHistoryInvariant(scenario: PlanningScenario) {
	return {
		moveCount: scenario.moves.length,
		orderedMoveKeys: scenario.moves.map((move) => move.id),
		uniqueKeyCount: new Set(scenario.moves.map((move) => move.id)).size
	};
}

function copyCourses(courses: MapCourse[]) {
	return courses.map((course) => ({ ...course }));
}

function eligibilityOrder(result: EligibilityResult, semesterOrder: Map<string, number>) {
	if (result.status === 'eligible')
		return semesterOrder.get(result.semesterId) ?? Number.POSITIVE_INFINITY;
	if (result.status === 'outside-plan') return Number.POSITIVE_INFINITY;
	return null;
}

function deriveScenario(
	baselineCourses: MapCourse[],
	currentCourses: MapCourse[],
	moves: PlanningMove[],
	semesters: MapSemester[],
	relations: MapRelation[]
): PlanningScenario {
	const accepted = getAcceptedRelations(relations);
	const graph: PlanningScenario['graph'] = {};
	for (const course of currentCourses) graph[course.id] = { prerequisites: [], dependants: [] };
	for (const relation of accepted) {
		graph[relation.target]?.prerequisites.push(relation.source);
		graph[relation.source]?.dependants.push(relation.target);
	}
	const eligibility: Record<string, EligibilityResult> = {};
	const baselineEligibility: Record<string, EligibilityResult> = {};
	for (const course of currentCourses) {
		eligibility[course.id] = getEarliestEligibleSemester(
			course.id,
			currentCourses,
			semesters,
			accepted
		);
		baselineEligibility[course.id] = getEarliestEligibleSemester(
			course.id,
			baselineCourses,
			semesters,
			accepted
		);
	}
	const baselineViolations = getPlanViolations(baselineCourses, semesters, accepted);
	const currentViolations = getPlanViolations(currentCourses, semesters, accepted);
	const baselineKeys = new Set(baselineViolations.map(getViolationKey));
	const currentKeys = new Set(currentViolations.map(getViolationKey));
	const semesterOrder = new Map(semesters.map((semester) => [semester.id, semester.order]));
	const baselineById = new Map(baselineCourses.map((course) => [course.id, course]));
	const changedCourseIds = currentCourses
		.filter((course) => baselineById.get(course.id)?.semesterId !== course.semesterId)
		.map((course) => course.id);
	const movedEarlierCourseIds = changedCourseIds.filter((id) => {
		const baseline = baselineById.get(id)!;
		const current = currentCourses.find((course) => course.id === id)!;
		return (
			(semesterOrder.get(current.semesterId) ?? Infinity) <
			(semesterOrder.get(baseline.semesterId) ?? Infinity)
		);
	});
	const delayedCourseIds = currentCourses
		.filter((course) => {
			const before = eligibilityOrder(baselineEligibility[course.id], semesterOrder);
			const after = eligibilityOrder(eligibility[course.id], semesterOrder);
			return before !== null && after !== null && after > before;
		})
		.map((course) => course.id);
	const newConflicts = currentViolations.filter(
		(violation) => !baselineKeys.has(getViolationKey(violation))
	);
	const resolvedConflicts = baselineViolations.filter(
		(violation) => !currentKeys.has(getViolationKey(violation))
	);
	return {
		baselineCourses: copyCourses(baselineCourses),
		currentCourses: copyCourses(currentCourses),
		moves: moves.map((move) => ({ ...move })),
		graph,
		eligibility,
		comparison: {
			changedCourseIds,
			newConflicts,
			resolvedConflicts,
			delayedCourseIds,
			movedEarlierCourseIds,
			ready: newConflicts.length === 0
		}
	};
}

export function createPlanningScenario(
	courses: MapCourse[],
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	return deriveScenario(courses, courses, [], semesters, relations);
}

function replayMoves(
	baselineCourses: MapCourse[],
	moves: PlanningMove[],
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	let currentCourses = copyCourses(baselineCourses);
	const replayed: PlanningMove[] = [];
	for (const intent of moves) {
		const current = currentCourses.find((course) => course.id === intent.courseId);
		if (!current || current.semesterId === intent.targetSemesterId) continue;
		const result = simulateCourseMove(
			intent.courseId,
			intent.targetSemesterId,
			currentCourses,
			semesters,
			relations
		);
		if (result.status !== 'valid' && result.status !== 'invalid') continue;
		replayed.push({
			id: intent.id,
			courseId: intent.courseId,
			fromSemesterId: semesters.some((semester) => semester.id === current.semesterId)
				? current.semesterId
				: null,
			targetSemesterId: intent.targetSemesterId
		});
		currentCourses = result.proposedCourses;
	}
	return deriveScenario(baselineCourses, currentCourses, replayed, semesters, relations);
}

export function applyPlanningMove(
	scenario: PlanningScenario,
	courseId: string,
	targetSemesterId: string,
	semesters: MapSemester[],
	relations: MapRelation[]
): PlanningMoveResult {
	const result = simulateCourseMove(
		courseId,
		targetSemesterId,
		scenario.currentCourses,
		semesters,
		relations
	);
	if (result.status !== 'valid' && result.status !== 'invalid') return { scenario, result };
	const current = scenario.currentCourses.find((course) => course.id === courseId)!;
	const nextMoveNumber =
		Math.max(0, ...scenario.moves.map((move) => Number(move.id.replace('move-', '')) || 0)) + 1;
	const move: PlanningMove = {
		id: `move-${nextMoveNumber}`,
		courseId,
		fromSemesterId: semesters.some((semester) => semester.id === current.semesterId)
			? current.semesterId
			: null,
		targetSemesterId
	};
	return {
		result,
		scenario: deriveScenario(
			scenario.baselineCourses,
			result.proposedCourses,
			[...scenario.moves, move],
			semesters,
			relations
		)
	};
}

export function undoPlanningMove(
	scenario: PlanningScenario,
	moveId: string,
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	return replayMoves(
		scenario.baselineCourses,
		scenario.moves.filter((move) => move.id !== moveId),
		semesters,
		relations
	);
}

export function undoLastPlanningMove(
	scenario: PlanningScenario,
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	const last = scenario.moves.at(-1);
	return last ? undoPlanningMove(scenario, last.id, semesters, relations) : scenario;
}

export function resetPlanningScenario(
	scenario: PlanningScenario,
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	return createPlanningScenario(scenario.baselineCourses, semesters, relations);
}
