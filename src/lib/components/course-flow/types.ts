import type { Edge, Node, Viewport } from '@xyflow/svelte';

export type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';

export type RequirementGroup =
	| 'core'
	| 'programming'
	| 'math'
	| 'systems'
	| 'ai'
	| 'writing'
	| 'elective'
	| 'general';

export type CourseSignal = {
	status?: CourseStatus;
	credits?: number;
	currentGrade?: number;
	projectedGrade?: number;
	deadlinesThisWeek?: number;
	nextDeadline?: string;
	studyHours?: number;
	materialCount?: number;
	noteCount?: number;
	riskLevel?: 'none' | 'low' | 'medium' | 'high';
	requirementGroup?: RequirementGroup;
	topics?: string[];
};

export type Course = {
	id: string;
	semesterId: string;
	code: string;
	name: string;
	instructor?: string;
	credits?: number;
	tag?: string;
	signals?: CourseSignal;
};

export type Semester = {
	id: string;
	term: string;
	year: number;
	order: number;
};

export type CourseRelationType = 'prereq' | 'related' | 'concept';

export type CourseEdgeType =
	| 'prereq'
	| 'coreq'
	| 'unlocks'
	| 'topic-overlap'
	| 'same-requirement'
	| 'grade-risk'
	| 'study-dependency'
	| 'related';

export type EdgeMetadata = {
	label: string;
	relationType: CourseEdgeType;
	directed: boolean;
	createdBy: 'user' | 'ai';
	confidence?: number;
	reason?: string;
	reviewStatus?: 'accepted' | 'pending' | 'rejected';
};

export type CourseRelation = {
	id: string;
	source: string;
	target: string;
	label: string;
	type: CourseEdgeType;
	directed: boolean;
	createdBy?: 'user' | 'ai';
	confidence?: number;
	reason?: string;
	reviewStatus?: 'accepted' | 'pending' | 'rejected';
};

export type CourseNodeData = {
	course: Course;
	semesterLabel: string;
	tagColor: string;
	warnings?: GraphWarning[];
	graphMode?: GraphMode;
	atlasRole?: 'center' | 'upstream' | 'downstream' | 'muted';
};

export type CourseEdgeData = {
	label: string;
	relationType: CourseEdgeType;
	directed: boolean;
	createdBy?: 'user' | 'ai';
	confidence?: number;
	reason?: string;
	reviewStatus?: 'accepted' | 'pending' | 'rejected';
	graphMode?: GraphMode;
	atlasRole?: 'connected' | 'muted';
};

export type CourseFlowNode = Node<CourseNodeData, 'course'>;
export type CourseFlowEdge = Edge<CourseEdgeData, 'course'> & { interactionWidth?: number };

export type PersistedGraphState = {
	positions: Record<string, { x: number; y: number }>;
	viewport?: Viewport;
	edges: Partial<CourseRelation>[];
};

export type GraphMode = 'default' | 'prereqs' | 'this-week' | 'risk' | 'degree-progress';

export type GraphWarning = {
	id: string;
	type: 'prereq-after-course' | 'missing-course' | 'overloaded-semester' | 'orphan-edge';
	severity: 'info' | 'warning' | 'critical';
	courseId?: string;
	edgeId?: string;
	message: string;
};
