import type { MapCourse, MapRelation, MapSemester } from './types';

export type BlockingReason = 'missing' | 'unplaced' | 'same-semester' | 'scheduled-later';

export type BlockingPrerequisite = {
	courseId: string;
	course?: MapCourse;
	reason: BlockingReason;
};

export type EligibilityScheduleStatus =
	| 'unscheduled'
	| 'too-early'
	| 'valid'
	| 'later-than-necessary';

export type EligibilityResult =
	| { status: 'already-eligible' }
	| {
			status: 'eligible';
			semesterId: string;
			semesterLabel: string;
			latestPrerequisiteSemesterId: string;
			latestPrerequisiteSemesterLabel: string;
			latestPrerequisiteCourseIds: string[];
			scheduleStatus: EligibilityScheduleStatus;
			currentSemesterId?: string;
			currentSemesterLabel?: string;
	  }
	| {
			status: 'outside-plan';
			latestPrerequisiteSemesterId: string;
			latestPrerequisiteSemesterLabel: string;
			latestPrerequisiteCourseIds: string[];
	  }
	| {
			status: 'unknown';
			missingCourseIds: string[];
			missingRelationIds: string[];
			unplacedCourseIds: string[];
	  }
	| { status: 'cycle'; cycleCourseIds: string[] };

function acceptedPrerequisites(relations: MapRelation[]) {
	return relations.filter(
		(relation) =>
			relation.type === 'prereq' &&
			relation.reviewStatus !== 'rejected' &&
			relation.reviewStatus !== 'pending'
	);
}

function uniqueAdjacent(courseId: string, relations: MapRelation[], direction: 'up' | 'down') {
	const adjacent = new Set<string>();
	for (const relation of acceptedPrerequisites(relations)) {
		if (direction === 'up' && relation.target === courseId) adjacent.add(relation.source);
		if (direction === 'down' && relation.source === courseId) adjacent.add(relation.target);
	}
	return [...adjacent];
}

export function getDirectPrerequisites(courseId: string, relations: MapRelation[]) {
	return uniqueAdjacent(courseId, relations, 'up');
}

export function getDirectDependants(courseId: string, relations: MapRelation[]) {
	return uniqueAdjacent(courseId, relations, 'down');
}

function traverse(courseId: string, relations: MapRelation[], direction: 'up' | 'down') {
	const visited = new Set<string>([courseId]);
	const result: string[] = [];
	const queue = uniqueAdjacent(courseId, relations, direction);

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (visited.has(current)) continue;
		visited.add(current);
		result.push(current);
		queue.push(...uniqueAdjacent(current, relations, direction));
	}

	return result;
}

export function getAllPrerequisites(courseId: string, relations: MapRelation[]) {
	return traverse(courseId, relations, 'up');
}

export function getAllDependants(courseId: string, relations: MapRelation[]) {
	return traverse(courseId, relations, 'down');
}

export function findPrerequisiteCycles(courses: MapCourse[], relations: MapRelation[]) {
	const courseIds = new Set(courses.map((course) => course.id));
	const graph = new Map<string, string[]>();
	for (const course of courses) graph.set(course.id, []);
	for (const relation of acceptedPrerequisites(relations)) {
		if (courseIds.has(relation.source) && courseIds.has(relation.target)) {
			graph.get(relation.source)!.push(relation.target);
		}
	}

	const cycles: string[][] = [];
	const seenCycles = new Set<string>();
	const visited = new Set<string>();
	const active = new Set<string>();
	const path: string[] = [];

	function visit(courseId: string) {
		visited.add(courseId);
		active.add(courseId);
		path.push(courseId);

		for (const next of graph.get(courseId) ?? []) {
			if (!visited.has(next)) visit(next);
			else if (active.has(next)) {
				const cycle = [...path.slice(path.indexOf(next)), next];
				const body = cycle.slice(0, -1);
				const rotations = body.map((_, index) => [...body.slice(index), ...body.slice(0, index)]);
				const canonical = rotations.map((rotation) => rotation.join('\u0000')).sort()[0];
				if (!seenCycles.has(canonical)) {
					seenCycles.add(canonical);
					cycles.push(cycle);
				}
			}
		}

		path.pop();
		active.delete(courseId);
	}

	for (const course of [...courses].sort((a, b) => a.id.localeCompare(b.id))) {
		if (!visited.has(course.id)) visit(course.id);
	}
	return cycles;
}

export function getBlockingPrerequisites(
	courseId: string,
	courses: MapCourse[],
	semesters: MapSemester[],
	relations: MapRelation[]
) {
	const coursesById = new Map(courses.map((course) => [course.id, course]));
	const semestersById = new Map(semesters.map((semester) => [semester.id, semester]));
	const selected = coursesById.get(courseId);
	const selectedSemester = selected ? semestersById.get(selected.semesterId) : undefined;
	const blocking: BlockingPrerequisite[] = [];

	for (const prerequisiteId of getDirectPrerequisites(courseId, relations)) {
		const prerequisite = coursesById.get(prerequisiteId);
		if (!prerequisite) {
			blocking.push({ courseId: prerequisiteId, reason: 'missing' });
			continue;
		}
		const prerequisiteSemester = semestersById.get(prerequisite.semesterId);
		if (!prerequisiteSemester) {
			blocking.push({ courseId: prerequisiteId, course: prerequisite, reason: 'unplaced' });
		} else if (selectedSemester && prerequisiteSemester.id === selectedSemester.id) {
			blocking.push({ courseId: prerequisiteId, course: prerequisite, reason: 'same-semester' });
		} else if (selectedSemester && prerequisiteSemester.order >= selectedSemester.order) {
			blocking.push({ courseId: prerequisiteId, course: prerequisite, reason: 'scheduled-later' });
		}
	}

	return blocking;
}

export function getEarliestEligibleSemester(
	courseId: string,
	courses: MapCourse[],
	semesters: MapSemester[],
	relations: MapRelation[]
): EligibilityResult {
	const coursesById = new Map(courses.map((course) => [course.id, course]));
	const selected = coursesById.get(courseId);
	if (!selected) {
		return {
			status: 'unknown',
			missingCourseIds: [courseId],
			missingRelationIds: [],
			unplacedCourseIds: []
		};
	}

	const accepted = acceptedPrerequisites(relations);
	const prerequisiteIds = getAllPrerequisites(courseId, accepted);
	const dependencyIds = new Set([courseId, ...prerequisiteIds]);
	const cycle = findPrerequisiteCycles(courses, accepted).find((path) =>
		path.slice(0, -1).some((id) => dependencyIds.has(id))
	);
	if (cycle) return { status: 'cycle', cycleCourseIds: cycle };
	if (prerequisiteIds.length === 0) return { status: 'already-eligible' };

	const missingCourseIds = prerequisiteIds.filter((id) => !coursesById.has(id));
	const missingSet = new Set(missingCourseIds);
	const missingRelationIds = accepted
		.filter((relation) => missingSet.has(relation.source) && dependencyIds.has(relation.target))
		.map((relation) => relation.id);
	const semestersById = new Map(semesters.map((semester) => [semester.id, semester]));
	const unplacedCourseIds = prerequisiteIds.filter((id) => {
		const prerequisite = coursesById.get(id);
		return prerequisite !== undefined && !semestersById.has(prerequisite.semesterId);
	});
	if (missingCourseIds.length > 0 || unplacedCourseIds.length > 0) {
		return { status: 'unknown', missingCourseIds, missingRelationIds, unplacedCourseIds };
	}

	const orderedSemesters = [...semesters].sort(
		(a, b) => a.order - b.order || a.id.localeCompare(b.id)
	);
	let latestPrerequisite = orderedSemesters[0];
	for (const prerequisiteId of prerequisiteIds) {
		const prerequisite = coursesById.get(prerequisiteId)!;
		const prerequisiteSemester = semestersById.get(prerequisite.semesterId)!;
		if (!latestPrerequisite || prerequisiteSemester.order > latestPrerequisite.order) {
			latestPrerequisite = prerequisiteSemester;
		}
	}

	const latestPrerequisiteCourseIds = prerequisiteIds.filter(
		(id) => coursesById.get(id)?.semesterId === latestPrerequisite.id
	);
	const eligibleSemester = orderedSemesters.find(
		(semester) => semester.order > latestPrerequisite.order
	);
	const latestPrerequisiteSemesterLabel = `${latestPrerequisite.term} ${latestPrerequisite.year}`;
	if (!eligibleSemester) {
		return {
			status: 'outside-plan',
			latestPrerequisiteSemesterId: latestPrerequisite.id,
			latestPrerequisiteSemesterLabel,
			latestPrerequisiteCourseIds
		};
	}

	const currentSemester = semestersById.get(selected.semesterId);
	let scheduleStatus: EligibilityScheduleStatus = 'unscheduled';
	if (currentSemester) {
		if (currentSemester.order < eligibleSemester.order) scheduleStatus = 'too-early';
		else if (currentSemester.order === eligibleSemester.order) scheduleStatus = 'valid';
		else scheduleStatus = 'later-than-necessary';
	}

	return {
		status: 'eligible',
		semesterId: eligibleSemester.id,
		semesterLabel: `${eligibleSemester.term} ${eligibleSemester.year}`,
		latestPrerequisiteSemesterId: latestPrerequisite.id,
		latestPrerequisiteSemesterLabel,
		latestPrerequisiteCourseIds,
		scheduleStatus,
		currentSemesterId: currentSemester?.id,
		currentSemesterLabel: currentSemester
			? `${currentSemester.term} ${currentSemester.year}`
			: undefined
	};
}
