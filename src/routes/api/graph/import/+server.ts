import { json, type RequestEvent } from '@sveltejs/kit';
import {
	applyGraphImport,
	getCourses,
	getGraphState,
	getSemesters,
	type Course,
	type GraphState
} from '$lib/server/store';

type RelationType = 'prereq' | 'related' | 'concept';
type ImportNode = {
	id?: string;
	code: string;
	name: string;
	semesterId?: string;
	tag?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
};
type ImportEdge = {
	id?: string;
	source: string;
	target: string;
	type?: RelationType;
	label?: string;
	directed?: boolean;
};

const RELATION_TYPES = new Set<RelationType>(['prereq', 'related', 'concept']);
const BODY_KEYS = new Set(['nodes', 'edges']);
const NODE_KEYS = new Set(['id', 'code', 'name', 'semesterId', 'tag', 'x', 'y', 'width', 'height']);
const EDGE_KEYS = new Set(['id', 'source', 'target', 'type', 'label', 'directed']);
const MAX_COORDINATE = 1_000_000;
const MAX_DIMENSION = 10_000;
const MAX_REQUEST_BYTES = 1_000_000;
const NODE_W = 176;
const NODE_H = 70;
const COL_GAP = 80;
const ROW_GAP = 46;

function plainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function normalizeCode(code: string) {
	return code.trim().replace(/\s+/g, ' ').toUpperCase();
}

function boundedString(value: unknown, max: number, required = false): value is string {
	return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}

function boundedNumber(value: unknown, max: number, positive = false): value is number {
	return (
		typeof value === 'number' &&
		Number.isFinite(value) &&
		Math.abs(value) <= max &&
		(!positive || value > 0)
	);
}

function unsupportedKeys(value: Record<string, unknown>, allowed: Set<string>) {
	return Object.keys(value).filter((key) => !allowed.has(key));
}

function validateNode(value: unknown, index: number, issues: string[]): value is ImportNode {
	if (!plainObject(value)) {
		issues.push(`nodes[${index}] must be a plain object`);
		return false;
	}
	const extra = unsupportedKeys(value, NODE_KEYS);
	if (extra.length) issues.push(`nodes[${index}] has unsupported fields: ${extra.join(', ')}`);
	if (value.id !== undefined && !boundedString(value.id, 128, true))
		issues.push(`nodes[${index}].id must be a non-empty string of at most 128 characters`);
	if (!boundedString(value.code, 64, true))
		issues.push(`nodes[${index}].code must be a non-empty string of at most 64 characters`);
	if (!boundedString(value.name, 200, true))
		issues.push(`nodes[${index}].name must be a non-empty string of at most 200 characters`);
	if (value.semesterId !== undefined && !boundedString(value.semesterId, 128, true))
		issues.push(`nodes[${index}].semesterId must be a non-empty string of at most 128 characters`);
	if (value.tag !== undefined && !boundedString(value.tag, 64))
		issues.push(`nodes[${index}].tag must be a string of at most 64 characters`);
	for (const field of ['x', 'y'] as const) {
		if (value[field] !== undefined && !boundedNumber(value[field], MAX_COORDINATE))
			issues.push(
				`nodes[${index}].${field} must be finite and between -${MAX_COORDINATE} and ${MAX_COORDINATE}`
			);
	}
	for (const field of ['width', 'height'] as const) {
		if (value[field] !== undefined && !boundedNumber(value[field], MAX_DIMENSION, true))
			issues.push(
				`nodes[${index}].${field} must be finite, positive, and at most ${MAX_DIMENSION}`
			);
	}
	if ((value.x === undefined) !== (value.y === undefined))
		issues.push(`nodes[${index}] must provide both x and y`);
	return extra.length === 0 && issues.every((issue) => !issue.startsWith(`nodes[${index}]`));
}

function validateEdge(value: unknown, index: number, issues: string[]): value is ImportEdge {
	if (!plainObject(value)) {
		issues.push(`edges[${index}] must be a plain object`);
		return false;
	}
	const extra = unsupportedKeys(value, EDGE_KEYS);
	if (extra.length) issues.push(`edges[${index}] has unsupported fields: ${extra.join(', ')}`);
	for (const field of ['id', 'source', 'target'] as const) {
		const required = field !== 'id';
		if (value[field] !== undefined || required) {
			if (!boundedString(value[field], 128, true))
				issues.push(
					`edges[${index}].${field} must be a non-empty string of at most 128 characters`
				);
		}
	}
	if (
		value.type !== undefined &&
		(typeof value.type !== 'string' || !RELATION_TYPES.has(value.type as RelationType))
	)
		issues.push(`edges[${index}].type is unsupported`);
	if (value.label !== undefined && !boundedString(value.label, 200))
		issues.push(`edges[${index}].label must be a string of at most 200 characters`);
	if (value.directed !== undefined && typeof value.directed !== 'boolean')
		issues.push(`edges[${index}].directed must be a boolean`);
	return extra.length === 0 && issues.every((issue) => !issue.startsWith(`edges[${index}]`));
}

function nextPosition(index: number, positions: GraphState['positions']) {
	const finiteX = Object.values(positions)
		.map((point) => point.x)
		.filter(Number.isFinite);
	const baseX = finiteX.length > 0 ? Math.max(...finiteX) + NODE_W + COL_GAP : 120;
	return { x: baseX, y: 120 + index * (NODE_H + ROW_GAP) };
}

export async function POST({ request }: RequestEvent) {
	let body: unknown;
	try {
		const declaredLength = Number(request.headers.get('content-length'));
		if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES)
			return json({ ok: false, error: 'Graph import payload is too large' }, { status: 413 });
		const raw = await request.text();
		if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES)
			return json({ ok: false, error: 'Graph import payload is too large' }, { status: 413 });
		body = JSON.parse(raw);
	} catch {
		return json(
			{ ok: false, error: 'Invalid graph import payload', issues: ['body must be valid JSON'] },
			{ status: 400 }
		);
	}
	if (!plainObject(body))
		return json(
			{ ok: false, error: 'Invalid graph import payload', issues: ['body must be a plain object'] },
			{ status: 400 }
		);

	const issues: string[] = [];
	const extra = unsupportedKeys(body, BODY_KEYS);
	if (extra.length) issues.push(`body has unsupported fields: ${extra.join(', ')}`);
	if (body.nodes !== undefined && !Array.isArray(body.nodes)) issues.push('nodes must be an array');
	if (body.edges !== undefined && !Array.isArray(body.edges)) issues.push('edges must be an array');
	const rawNodes = Array.isArray(body.nodes) ? body.nodes : [];
	const rawEdges = Array.isArray(body.edges) ? body.edges : [];
	if (rawNodes.length > 500) issues.push('nodes must contain at most 500 items');
	if (rawEdges.length > 2000) issues.push('edges must contain at most 2000 items');
	const nodes = rawNodes.filter((node, index): node is ImportNode =>
		validateNode(node, index, issues)
	);
	const edges = rawEdges.filter((edge, index): edge is ImportEdge =>
		validateEdge(edge, index, issues)
	);

	const semesters = await getSemesters();
	const semesterIds = new Set(semesters.map((semester) => semester.id));
	const fallbackSemester = [...semesters].sort((a, b) => b.order - a.order)[0];
	const courses = await getCourses();
	const coursesByCode = new Map(courses.map((course) => [normalizeCode(course.code), course]));
	const coursesById = new Map(courses.map((course) => [course.id, course]));
	const nodeIds = new Set<string>();
	const nodeCodes = new Set<string>();
	for (const [index, node] of nodes.entries()) {
		const code = normalizeCode(node.code);
		if (nodeCodes.has(code)) issues.push(`nodes[${index}] duplicates course code ${code}`);
		nodeCodes.add(code);
		if (node.id) {
			if (nodeIds.has(node.id)) issues.push(`nodes[${index}] duplicates node id ${node.id}`);
			nodeIds.add(node.id);
			const idOwner = coursesById.get(node.id);
			if (idOwner && normalizeCode(idOwner.code) !== code)
				issues.push(`nodes[${index}].id belongs to another course`);
		}
		const semesterId =
			node.semesterId ?? coursesByCode.get(code)?.semesterId ?? fallbackSemester?.id;
		if (!semesterId || !semesterIds.has(semesterId))
			issues.push(`nodes[${index}] references an invalid semester`);
	}

	const referenceMap = new Map<string, string>();
	for (const course of courses) {
		referenceMap.set(course.id, course.id);
		referenceMap.set(normalizeCode(course.code), course.id);
	}
	for (const node of nodes) {
		const existing = coursesByCode.get(normalizeCode(node.code));
		const id = existing?.id ?? node.id ?? crypto.randomUUID();
		referenceMap.set(normalizeCode(node.code), id);
		if (node.id) referenceMap.set(node.id, id);
	}
	const edgeIds = new Set<string>();
	const edgeKeys = new Set<string>();
	for (const [index, edge] of edges.entries()) {
		const source = referenceMap.get(edge.source) ?? referenceMap.get(normalizeCode(edge.source));
		const target = referenceMap.get(edge.target) ?? referenceMap.get(normalizeCode(edge.target));
		if (!source) issues.push(`edges[${index}].source does not exist`);
		if (!target) issues.push(`edges[${index}].target does not exist`);
		if (source && target && source === target) issues.push(`edges[${index}] cannot be a self-edge`);
		if (edge.id) {
			if (edgeIds.has(edge.id)) issues.push(`edges[${index}] duplicates edge id ${edge.id}`);
			edgeIds.add(edge.id);
		}
		if (source && target) {
			const key = `${source}\0${target}\0${edge.type ?? 'related'}`;
			if (edgeKeys.has(key)) issues.push(`edges[${index}] duplicates another imported edge`);
			edgeKeys.add(key);
		}
	}
	if (issues.length)
		return json({ ok: false, error: 'Invalid graph import payload', issues }, { status: 400 });

	const graph = await getGraphState();
	const mutations: { course: Course; existing: boolean }[] = [];
	const created: string[] = [];
	const updated: string[] = [];
	for (const node of nodes) {
		const code = normalizeCode(node.code);
		const existing = coursesByCode.get(code);
		const course: Course = existing
			? {
					...existing,
					name: node.name.trim(),
					semesterId: node.semesterId ?? existing.semesterId,
					tag: node.tag ?? existing.tag
				}
			: {
					id: node.id ?? referenceMap.get(code)!,
					semesterId: node.semesterId ?? fallbackSemester!.id,
					code,
					name: node.name.trim(),
					tag: node.tag ?? 'core'
				};
		mutations.push({ course, existing: Boolean(existing) });
		(existing ? updated : created).push(code);
		if (!existing)
			graph.positions[course.id] =
				node.x === undefined
					? nextPosition(created.length - 1, graph.positions)
					: { x: node.x, y: node.y! };
	}

	let edgesAdded = 0;
	let edgesSkipped = 0;
	const warnings: string[] = [];
	for (const incoming of edges) {
		const source =
			referenceMap.get(incoming.source) ?? referenceMap.get(normalizeCode(incoming.source))!;
		const target =
			referenceMap.get(incoming.target) ?? referenceMap.get(normalizeCode(incoming.target))!;
		const type = incoming.type ?? 'related';
		if (
			graph.edges.some(
				(edge) => edge.source === source && edge.target === target && edge.type === type
			)
		) {
			edgesSkipped++;
			warnings.push(`Edge ${incoming.source} -> ${incoming.target} already exists`);
			continue;
		}
		graph.edges.push({
			id: incoming.id ?? crypto.randomUUID(),
			source,
			target,
			label: incoming.label?.trim() || type,
			type,
			directed: incoming.directed ?? type === 'prereq'
		});
		edgesAdded++;
	}
	if (nodes.some((node) => node.width !== undefined || node.height !== undefined))
		warnings.push('Node dimensions were validated but are not persisted by the graph store');

	await applyGraphImport(mutations, graph);
	return json({
		ok: true,
		counts: {
			nodesReceived: nodes.length,
			created: created.length,
			updated: updated.length,
			edgesReceived: edges.length,
			edgesAdded,
			edgesSkipped
		},
		created,
		updated,
		warnings
	});
}
