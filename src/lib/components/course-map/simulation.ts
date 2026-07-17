import {
	findPrerequisiteCycles,
	getAllDependants,
	getAllPrerequisites,
	getEarliestEligibleSemester,
	type EligibilityResult
} from './traversal';
import type { MapCourse, MapRelation, MapSemester } from './types';

export type ScheduleViolation = {
	courseId: string;
	prerequisiteCourseId: string;
	reason:
		| 'missing-course'
		| 'unplaced-prerequisite'
		| 'same-semester'
		| 'prerequisite-scheduled-later'
		| 'unknown-semester';
};

export type DownstreamImpact = {
	courseId: string;
	previousEligibility: EligibilityResult;
	proposedEligibility: EligibilityResult;
	impact: 'unchanged' | 'eligible-later' | 'newly-blocked' | 'outside-plan' | 'resolved';
};

type ComparedScenario = {
	courseId: string;
	currentSemesterId: string | null;
	targetSemesterId: string;
	proposedCourses: MapCourse[];
	newlyIntroducedViolations: ScheduleViolation[];
	resolvedViolations: ScheduleViolation[];
	unchangedViolations: ScheduleViolation[];
	downstreamImpacts: DownstreamImpact[];
};

export type CourseMoveScenario =
	| { status: 'no-op'; courseId: string; semesterId: string }
	| ({ status: 'valid' } & ComparedScenario)
	| ({ status: 'invalid'; selectedCourseViolations: ScheduleViolation[] } & ComparedScenario)
	| {
			status: 'unknown';
			courseId: string;
			missingCourseIds: string[];
			unplacedPrerequisiteIds: string[];
	  }
	| { status: 'cycle'; courseId: string; cycleCourseIds: string[] }
	| {
			status: 'invalid-input';
			reason: 'course-not-found' | 'semester-not-found' | 'target-is-unplaced';
	  };

export function getAcceptedRelations(relations: MapRelation[]) {
	const seen = new Set<string>();
	return relations.filter((relation) => {
		if (
			relation.type !== 'prereq' ||
			relation.reviewStatus === 'pending' ||
			relation.reviewStatus === 'rejected'
		)
			return false;
		const key = `${relation.source}\u0000${relation.target}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function getPlanViolations(
	courses: MapCourse[],
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	const coursesById = new Map(courses.map((course) => [course.id, course]));
	const semestersById = new Map(semesters.map((semester) => [semester.id, semester]));
	const violations: ScheduleViolation[] = [];
	for (const relation of relations) {
		const dependent = coursesById.get(relation.target);
		const prerequisite = coursesById.get(relation.source);
		if (!prerequisite) {
			violations.push({
				courseId: relation.target,
				prerequisiteCourseId: relation.source,
				reason: 'missing-course'
			});
			continue;
		}
		const prerequisiteSemester = semestersById.get(prerequisite.semesterId);
		if (!prerequisiteSemester) {
			violations.push({
				courseId: relation.target,
				prerequisiteCourseId: relation.source,
				reason: 'unplaced-prerequisite'
			});
			continue;
		}
		if (!dependent || !semestersById.has(dependent.semesterId)) {
			violations.push({
				courseId: relation.target,
				prerequisiteCourseId: relation.source,
				reason: 'unknown-semester'
			});
			continue;
		}
		const dependentSemester = semestersById.get(dependent.semesterId)!;
		if (prerequisiteSemester.id === dependentSemester.id) {
			violations.push({
				courseId: dependent.id,
				prerequisiteCourseId: prerequisite.id,
				reason: 'same-semester'
			});
		} else if (prerequisiteSemester.order > dependentSemester.order) {
			violations.push({
				courseId: dependent.id,
				prerequisiteCourseId: prerequisite.id,
				reason: 'prerequisite-scheduled-later'
			});
		}
	}
	return violations;
}

export function getViolationKey(violation: ScheduleViolation) {
	return `${violation.courseId}\u0000${violation.prerequisiteCourseId}\u0000${violation.reason}`;
}

function compareEligibility(
	previous: EligibilityResult,
	proposed: EligibilityResult,
	semesters: MapSemester[]
): DownstreamImpact['impact'] {
	if (previous.status === 'eligible' && proposed.status === 'eligible') {
		const order = new Map(semesters.map((semester) => [semester.id, semester.order]));
		const before = order.get(previous.semesterId)!;
		const after = order.get(proposed.semesterId)!;
		if (after > before) return 'eligible-later';
		if (after < before) return 'resolved';
		return 'unchanged';
	}
	if (proposed.status === 'outside-plan' && previous.status !== 'outside-plan')
		return 'outside-plan';
	if (
		(proposed.status === 'unknown' || proposed.status === 'cycle') &&
		previous.status !== proposed.status
	)
		return 'newly-blocked';
	if (
		(previous.status === 'outside-plan' || previous.status === 'unknown') &&
		(proposed.status === 'eligible' || proposed.status === 'already-eligible')
	)
		return 'resolved';
	return 'unchanged';
}

export function simulateCourseMove(
	courseId: string,
	targetSemesterId: string,
	courses: MapCourse[],
	semesters: MapSemester[],
	relations: MapRelation[]
): CourseMoveScenario {
	const selected = courses.find((course) => course.id === courseId);
	if (!selected) return { status: 'invalid-input', reason: 'course-not-found' };
	if (targetSemesterId === '__unplaced__') {
		return { status: 'invalid-input', reason: 'target-is-unplaced' };
	}
	if (!semesters.some((semester) => semester.id === targetSemesterId)) {
		return { status: 'invalid-input', reason: 'semester-not-found' };
	}
	if (selected.semesterId === targetSemesterId) {
		return { status: 'no-op', courseId, semesterId: targetSemesterId };
	}

	const accepted = getAcceptedRelations(relations);
	const affectedIds = new Set([
		courseId,
		...getAllPrerequisites(courseId, accepted),
		...getAllDependants(courseId, accepted)
	]);
	const cycle = findPrerequisiteCycles(courses, accepted).find((path) =>
		path.slice(0, -1).some((id) => affectedIds.has(id))
	);
	if (cycle) return { status: 'cycle', courseId, cycleCourseIds: cycle };

	const coursesById = new Map(courses.map((course) => [course.id, course]));
	const prerequisiteIds = getAllPrerequisites(courseId, accepted);
	const missingCourseIds = prerequisiteIds.filter((id) => !coursesById.has(id));
	const semesterIds = new Set(semesters.map((semester) => semester.id));
	const unplacedPrerequisiteIds = prerequisiteIds.filter((id) => {
		const course = coursesById.get(id);
		return course !== undefined && !semesterIds.has(course.semesterId);
	});
	if (missingCourseIds.length > 0 || unplacedPrerequisiteIds.length > 0) {
		return { status: 'unknown', courseId, missingCourseIds, unplacedPrerequisiteIds };
	}

	const proposedCourses = courses.map((course) =>
		course.id === courseId ? { ...course, semesterId: targetSemesterId } : { ...course }
	);
	const baselineViolations = getPlanViolations(courses, semesters, accepted);
	const proposedViolations = getPlanViolations(proposedCourses, semesters, accepted);
	const baselineKeys = new Set(baselineViolations.map(getViolationKey));
	const proposedKeys = new Set(proposedViolations.map(getViolationKey));
	const newlyIntroducedViolations = proposedViolations.filter(
		(violation) => !baselineKeys.has(getViolationKey(violation))
	);
	const resolvedViolations = baselineViolations.filter(
		(violation) => !proposedKeys.has(getViolationKey(violation))
	);
	const unchangedViolations = proposedViolations.filter((violation) =>
		baselineKeys.has(getViolationKey(violation))
	);
	const selectedCourseViolations = proposedViolations.filter(
		(violation) => violation.courseId === courseId
	);
	const downstreamImpacts = getAllDependants(courseId, accepted).map((dependantId) => {
		const previousEligibility = getEarliestEligibleSemester(
			dependantId,
			courses,
			semesters,
			accepted
		);
		const proposedEligibility = getEarliestEligibleSemester(
			dependantId,
			proposedCourses,
			semesters,
			accepted
		);
		return {
			courseId: dependantId,
			previousEligibility,
			proposedEligibility,
			impact: compareEligibility(previousEligibility, proposedEligibility, semesters)
		};
	});
	const comparison = {
		courseId,
		currentSemesterId: semesterIds.has(selected.semesterId) ? selected.semesterId : null,
		targetSemesterId,
		proposedCourses,
		newlyIntroducedViolations,
		resolvedViolations,
		unchangedViolations,
		downstreamImpacts
	};
	if (selectedCourseViolations.length > 0 || newlyIntroducedViolations.length > 0) {
		return { status: 'invalid', ...comparison, selectedCourseViolations };
	}
	return { status: 'valid', ...comparison };
}
