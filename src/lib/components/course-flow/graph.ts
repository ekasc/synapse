import type { MarkerType, Viewport } from '@xyflow/svelte';
import type {
	Course,
	CourseEdgeData,
	CourseEdgeType,
	CourseFlowEdge,
	CourseFlowNode,
	CourseNodeData,
	CourseRelation,
	GraphWarning,
	PersistedGraphState,
	Semester,
	GraphMode
} from './types';

export const TAG_COLOR: Record<string, string> = {
	core: '#fbf8f0',
	programming: '#efe6cc',
	math: '#e8dcc1',
	systems: '#cfc5b4',
	ai: '#e6ff8a',
	writing: '#e0d6bb'
};

const VALID_EDGE_TYPES = new Set([
	'prereq',
	'coreq',
	'unlocks',
	'topic-overlap',
	'same-requirement',
	'grade-risk',
	'study-dependency',
	'related'
]);

function stableRelationId(edge: Partial<CourseRelation>, type: CourseEdgeType): string {
	const source = edge.source?.trim() || 'missing-source';
	const target = edge.target?.trim() || 'missing-target';
	return `${source}:${target}:${type}`;
}

export function normalizeRelation(edge: Partial<CourseRelation>): CourseRelation {
	const type = edge.type && VALID_EDGE_TYPES.has(edge.type) ? edge.type : 'related';
	return {
		id: edge.id?.trim() || stableRelationId(edge, type as CourseEdgeType),
		source: edge.source?.trim() ?? '',
		target: edge.target?.trim() ?? '',
		label: edge.label || type,
		type: type as CourseEdgeType,
		directed: edge.directed ?? true,
		createdBy: edge.createdBy,
		confidence: edge.confidence,
		reason: edge.reason,
		reviewStatus: edge.reviewStatus
	};
}

export function semesterLabel(semesters: Record<string, Semester>, semesterId: string): string {
	const semester = semesters[semesterId];
	return semester ? `${semester.term} ${semester.year}` : 'Unplaced';
}

export function computeCourseSignals(course: Course) {
	return {
		status: course.signals?.status ?? 'planned',
		riskLevel: course.signals?.riskLevel ?? 'none',
		requirementGroup: course.signals?.requirementGroup ?? (course.tag as string) ?? 'core',
		credits: course.signals?.credits ?? course.credits ?? 3,
		deadlinesThisWeek: course.signals?.deadlinesThisWeek ?? 0,
		nextDeadline: course.signals?.nextDeadline,
		studyHours: course.signals?.studyHours,
		materialCount: course.signals?.materialCount,
		noteCount: course.signals?.noteCount,
		topics: course.signals?.topics,
		currentGrade: course.signals?.currentGrade,
		projectedGrade: course.signals?.projectedGrade
	};
}

export function toFlowNodes(
	courses: Course[],
	semesters: Record<string, Semester>,
	positions: Record<string, { x: number; y: number }>,
	warnings?: Record<string, GraphWarning[]>,
	graphMode?: GraphMode
): CourseFlowNode[] {
	return courses.map((course) => ({
		id: course.id,
		type: 'course' as const,
		position:
			Number.isFinite(positions[course.id]?.x) && Number.isFinite(positions[course.id]?.y)
				? positions[course.id]
				: { x: 120, y: 120 },
		data: {
			course,
			semesterLabel: semesterLabel(semesters, course.semesterId),
			tagColor: TAG_COLOR[course.tag ?? 'core'] ?? TAG_COLOR.core,
			warnings: warnings?.[course.id],
			graphMode
		} satisfies CourseNodeData
	}));
}

export function toFlowEdges(
	edges: Partial<CourseRelation>[],
	courseIds: Set<string>,
	graphMode?: GraphMode
): CourseFlowEdge[] {
	return edges
		.map((edge) => {
			const relation = normalizeRelation(edge);
			if (
				!relation.source ||
				!relation.target ||
				relation.source === relation.target ||
				!courseIds.has(relation.source) ||
				!courseIds.has(relation.target)
			)
				return null;
			const flowEdge: CourseFlowEdge = {
				id: relation.id,
				source: relation.source,
				target: relation.target,
				type: 'course' as const,
				label: relation.label || undefined,
				interactionWidth: 32,
				data: {
					label: relation.label,
					relationType: relation.type,
					directed: relation.directed,
					createdBy: relation.createdBy,
					confidence: relation.confidence,
					reason: relation.reason,
					reviewStatus: relation.reviewStatus,
					graphMode
				} satisfies CourseEdgeData,
				markerEnd: relation.directed ? { type: 'arrowclosed' as MarkerType } : undefined
			};
			return flowEdge;
		})
		.filter((edge): edge is CourseFlowEdge => edge !== null)
		.filter(
			(edge, index, all) =>
				all.findIndex(
					(candidate) =>
						candidate.source === edge.source &&
						candidate.target === edge.target &&
						candidate.data?.relationType === edge.data?.relationType
				) === index
		);
}

export function toPersistedGraph(
	nodes: CourseFlowNode[],
	edges: CourseFlowEdge[],
	viewport: Viewport
): PersistedGraphState {
	return {
		positions: Object.fromEntries(
			nodes
				.filter((node) => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))
				.map((node) => [node.id, { x: node.position.x, y: node.position.y }])
		),
		viewport,
		edges: edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			label: edge.data?.label ?? '',
			type: edge.data?.relationType ?? 'related',
			directed: edge.data?.directed ?? true,
			createdBy: edge.data?.createdBy,
			confidence: edge.data?.confidence,
			reason: edge.data?.reason,
			reviewStatus: edge.data?.reviewStatus
		}))
	};
}

export function organizeNodes(
	nodes: CourseFlowNode[],
	courses: Course[],
	semesters: Semester[]
): CourseFlowNode[] {
	const grouped: Record<string, Course[]> = {};
	for (const course of courses) {
		(grouped[course.semesterId] ??= []).push(course);
	}

	const sorted = [...semesters].sort((a, b) => a.order - b.order);
	const newPositions: Record<string, { x: number; y: number }> = {};

	sorted.forEach((semester, si) => {
		const group = grouped[semester.id] ?? [];
		const baseX = 80 + si * 320;
		const baseY = 110;
		group.forEach((course, ci) => {
			newPositions[course.id] = { x: baseX, y: baseY + ci * 130 };
		});
	});

	courses
		.filter((course) => !newPositions[course.id])
		.forEach((course, i) => {
			newPositions[course.id] = { x: 80 + (i % 4) * 260, y: 560 + Math.floor(i / 4) * 104 };
		});

	return nodes.map((node) => {
		const pos = newPositions[node.id];
		return pos ? { ...node, position: pos } : node;
	});
}
