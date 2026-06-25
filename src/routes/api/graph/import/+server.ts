import { json, type RequestEvent } from '@sveltejs/kit';
import {
	addCourse,
	getCourses,
	getGraphState,
	getSemesters,
	saveGraphState,
	updateCourse,
	type Course,
	type GraphState
} from '$lib/server/store';

type RelationType = NonNullable<GraphState['edges'][number]['type']>;
type ImportNode = {
	code: string;
	name: string;
	semesterId?: string;
	tag?: string;
};
type ImportEdge = {
	source: string;
	target: string;
	type?: RelationType;
	label?: string;
	directed?: boolean;
};
type GraphImport = {
	nodes?: ImportNode[];
	edges?: ImportEdge[];
};

const RELATION_TYPES = new Set<RelationType>(['prereq', 'related', 'concept']);
const NODE_W = 176;
const NODE_H = 70;
const COL_GAP = 80;
const ROW_GAP = 46;

function normalizeCode(code: string) {
	return code.trim().replace(/\s+/g, ' ').toUpperCase();
}

function isImportNode(value: unknown): value is ImportNode {
	if (typeof value !== 'object' || value === null) return false;
	const node = value as { code?: unknown; name?: unknown; semesterId?: unknown; tag?: unknown };
	return (
		typeof node.code === 'string' &&
		node.code.trim().length > 0 &&
		typeof node.name === 'string' &&
		node.name.trim().length > 0 &&
		(node.semesterId === undefined || typeof node.semesterId === 'string') &&
		(node.tag === undefined || typeof node.tag === 'string')
	);
}

function isImportEdge(value: unknown): value is ImportEdge {
	if (typeof value !== 'object' || value === null) return false;
	const edge = value as {
		source?: unknown;
		target?: unknown;
		type?: unknown;
		label?: unknown;
		directed?: unknown;
	};
	return (
		typeof edge.source === 'string' &&
		edge.source.trim().length > 0 &&
		typeof edge.target === 'string' &&
		edge.target.trim().length > 0 &&
		(edge.type === undefined ||
			(typeof edge.type === 'string' && RELATION_TYPES.has(edge.type as RelationType))) &&
		(edge.label === undefined || typeof edge.label === 'string') &&
		(edge.directed === undefined || typeof edge.directed === 'boolean')
	);
}

function isGraphImport(value: unknown): value is GraphImport {
	if (typeof value !== 'object' || value === null) return false;
	const body = value as { nodes?: unknown; edges?: unknown };
	return (
		(body.nodes === undefined || (Array.isArray(body.nodes) && body.nodes.every(isImportNode))) &&
		(body.edges === undefined || (Array.isArray(body.edges) && body.edges.every(isImportEdge)))
	);
}

function nextPosition(index: number, existingPositions: GraphState['positions']) {
	const points = Object.values(existingPositions);
	const baseX =
		points.length > 0 ? Math.max(...points.map((point) => point.x)) + NODE_W + COL_GAP : 120;
	return {
		x: baseX,
		y: 120 + index * (NODE_H + ROW_GAP)
	};
}

export async function POST({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isGraphImport(body)) {
		return json({ ok: false, error: 'Invalid graph import payload' }, { status: 400 });
	}

	const semesters = getSemesters().sort((a, b) => b.order - a.order);
	const fallbackSemester = semesters[0];
	if (!fallbackSemester && body.nodes?.some((node) => !node.semesterId)) {
		return json(
			{ ok: false, error: 'No semester exists for imported nodes without semesterId' },
			{ status: 400 }
		);
	}

	const courses = getCourses();
	const coursesByCode = new Map(courses.map((course) => [normalizeCode(course.code), course]));
	const graph = getGraphState();
	const created: Course[] = [];
	const updated: Course[] = [];

	for (const node of body.nodes ?? []) {
		const code = normalizeCode(node.code);
		const existing = coursesByCode.get(code);
		if (existing) {
			const updates: Partial<Course> = {
				name: node.name.trim(),
				semesterId: node.semesterId ?? existing.semesterId,
				tag: node.tag ?? existing.tag
			};
			updateCourse(existing.id, updates);
			const next = { ...existing, ...updates };
			coursesByCode.set(code, next);
			updated.push(next);
			continue;
		}

		const course: Course = {
			id: crypto.randomUUID(),
			semesterId: node.semesterId ?? fallbackSemester.id,
			code,
			name: node.name.trim(),
			tag: node.tag ?? 'core'
		};
		addCourse(course);
		coursesByCode.set(code, course);
		graph.positions[course.id] = nextPosition(created.length, graph.positions);
		created.push(course);
	}

	let edgesAdded = 0;
	let edgesSkipped = 0;
	for (const incoming of body.edges ?? []) {
		const source = coursesByCode.get(normalizeCode(incoming.source));
		const target = coursesByCode.get(normalizeCode(incoming.target));
		if (!source || !target || source.id === target.id) {
			edgesSkipped += 1;
			continue;
		}

		const type = incoming.type ?? 'related';
		const label = incoming.label?.trim() || type;
		const directed = incoming.directed ?? type === 'prereq';
		const exists = graph.edges.some(
			(edge) => edge.source === source.id && edge.target === target.id && edge.type === type
		);
		if (exists) {
			edgesSkipped += 1;
			continue;
		}

		graph.edges.push({
			id: crypto.randomUUID(),
			source: source.id,
			target: target.id,
			label,
			type,
			directed
		});
		edgesAdded += 1;
	}

	saveGraphState(graph);
	return json({
		ok: true,
		created: created.map((course) => course.code),
		updated: updated.map((course) => course.code),
		edgesAdded,
		edgesSkipped
	});
}
