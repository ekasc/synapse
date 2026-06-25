import type { Course, CourseFlowEdge, CourseFlowNode, GraphWarning, Semester } from './types';
import { computeCourseSignals } from './graph';

export function validateGraph(
	nodes: CourseFlowNode[],
	edges: CourseFlowEdge[],
	courses: Course[],
	semesters: Semester[]
): GraphWarning[] {
	const warnings: GraphWarning[] = [];
	const courseMap = new Map(courses.map((c) => [c.id, c]));
	const semesterMap = new Map(semesters.map((s) => [s.id, s]));

	const semesterCredits: Record<string, number> = {};

	for (const course of courses) {
		const signals = computeCourseSignals(course);
		const credits = signals.credits;
		const sid = course.semesterId;
		semesterCredits[sid] = (semesterCredits[sid] ?? 0) + credits;
	}

	for (const [sid, total] of Object.entries(semesterCredits)) {
		if (total > 18) {
			const sem = semesterMap.get(sid);
			const semName = sem ? sem.term + ' ' + sem.year : 'Semester';
			warnings.push({
				id: 'overload-' + sid,
				type: 'overloaded-semester',
				severity: 'warning',
				message: semName + ' has ' + total + ' credits (max 18)'
			});
		}
	}

	for (const edge of edges) {
		const src = courseMap.get(edge.source);
		const tgt = courseMap.get(edge.target);
		const type = edge.data?.relationType;

		if (!src || !tgt) {
			const srcCode = src?.code ?? 'unknown';
			const tgtCode = tgt?.code ?? 'unknown';
			warnings.push({
				id: 'orphan-' + edge.id,
				type: 'orphan-edge',
				severity: 'warning',
				edgeId: edge.id,
				message: 'Edge connects ' + srcCode + ' -> ' + tgtCode + ', missing course'
			});
			continue;
		}

		if (type === 'prereq') {
			const srcSem = semesterMap.get(src.semesterId);
			const tgtSem = semesterMap.get(tgt.semesterId);
			if (srcSem && tgtSem && srcSem.order >= tgtSem.order) {
				warnings.push({
					id: 'prereq-' + edge.id,
					type: 'prereq-after-course',
					severity: 'critical',
					courseId: tgt.id,
					edgeId: edge.id,
					message: tgt.code + ' is scheduled before prerequisite ' + src.code
				});
			}
		}
	}

	for (const course of courses) {
		if (!course.semesterId || !semesterMap.has(course.semesterId)) {
			warnings.push({
				id: 'unplaced-' + course.id,
				type: 'missing-course',
				severity: 'info',
				courseId: course.id,
				message: course.code + ' has no semester'
			});
		}
	}

	return warnings;
}
