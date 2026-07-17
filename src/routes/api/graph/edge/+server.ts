import { json, type RequestEvent } from '@sveltejs/kit';
import { getCourses, getGraphState, saveGraphState } from '$lib/server/store';

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

const VALID_REVIEW_STATUS = new Set(['accepted', 'pending', 'rejected']);

function plainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function unsupportedKeys(value: Record<string, unknown>, allowed: Set<string>) {
	return Object.keys(value).filter((key) => !allowed.has(key));
}

const POST_ALLOWED = new Set(['source', 'target', 'type', 'label', 'directed', 'reviewStatus']);

export async function POST({ request }: RequestEvent) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
	}
	if (!plainObject(body))
		return json({ ok: false, error: 'Body must be a plain object' }, { status: 400 });

	const extra = unsupportedKeys(body, POST_ALLOWED);
	if (extra.length)
		return json({ ok: false, error: `Unsupported fields: ${extra.join(', ')}` }, { status: 400 });

	const { source, target, type, label, directed, reviewStatus } = body as Record<string, unknown>;

	if (typeof source !== 'string' || !source)
		return json({ ok: false, error: 'source must be a non-empty string' }, { status: 400 });
	if (typeof target !== 'string' || !target)
		return json({ ok: false, error: 'target must be a non-empty string' }, { status: 400 });
	if (typeof type !== 'string' || !type)
		return json({ ok: false, error: 'type must be a non-empty string' }, { status: 400 });

	if (source === target)
		return json({ ok: false, error: 'source and target must be different' }, { status: 400 });

	if (!VALID_EDGE_TYPES.has(type))
		return json({ ok: false, error: `Invalid edge type: ${type}` }, { status: 400 });

	if (label !== undefined && typeof label !== 'string')
		return json({ ok: false, error: 'label must be a string' }, { status: 400 });

	if (directed !== undefined && typeof directed !== 'boolean')
		return json({ ok: false, error: 'directed must be a boolean' }, { status: 400 });

	if (reviewStatus !== undefined && !VALID_REVIEW_STATUS.has(reviewStatus as string))
		return json({ ok: false, error: `Invalid reviewStatus: ${reviewStatus}` }, { status: 400 });

	const courses = await getCourses();
	const courseIds = new Set(courses.map((c) => c.id));
	if (!courseIds.has(source))
		return json({ ok: false, error: `source course not found: ${source}` }, { status: 400 });
	if (!courseIds.has(target))
		return json({ ok: false, error: `target course not found: ${target}` }, { status: 400 });

	const graph = await getGraphState();
	if (graph.edges.some((e) => e.source === source && e.target === target && e.type === type))
		return json(
			{ ok: false, error: 'Edge with same source, target, and type already exists' },
			{ status: 409 }
		);

	const edge = {
		id: crypto.randomUUID(),
		source,
		target,
		type,
		label: label ?? type,
		directed: directed ?? type === 'prereq',
		createdBy: 'user' as const,
		reviewStatus: reviewStatus ?? 'accepted'
	};

	graph.edges.push(edge);
	await saveGraphState(graph);

	return json(edge, { status: 201 });
}

const PATCH_ALLOWED = new Set(['id', 'label', 'type', 'directed', 'reviewStatus']);

export async function PATCH({ request }: RequestEvent) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
	}
	if (!plainObject(body))
		return json({ ok: false, error: 'Body must be a plain object' }, { status: 400 });

	const extra = unsupportedKeys(body, PATCH_ALLOWED);
	if (extra.length)
		return json({ ok: false, error: `Unsupported fields: ${extra.join(', ')}` }, { status: 400 });

	const { id, label, type, directed, reviewStatus } = body as Record<string, unknown>;

	if (typeof id !== 'string' || !id)
		return json({ ok: false, error: 'id must be a non-empty string' }, { status: 400 });

	if (label !== undefined && typeof label !== 'string')
		return json({ ok: false, error: 'label must be a string' }, { status: 400 });

	if (type !== undefined) {
		if (!VALID_EDGE_TYPES.has(type as string))
			return json({ ok: false, error: `Invalid edge type: ${type}` }, { status: 400 });
	}

	if (directed !== undefined && typeof directed !== 'boolean')
		return json({ ok: false, error: 'directed must be a boolean' }, { status: 400 });

	if (reviewStatus !== undefined && !VALID_REVIEW_STATUS.has(reviewStatus as string))
		return json({ ok: false, error: `Invalid reviewStatus: ${reviewStatus}` }, { status: 400 });

	const graph = await getGraphState();
	const idx = graph.edges.findIndex((e) => e.id === id);
	if (idx === -1) return json({ ok: false, error: 'Edge not found' }, { status: 404 });

	const existing = graph.edges[idx];
	const nextType = (type as string | undefined) ?? existing.type;
	if (
		graph.edges.some(
			(edge, index) =>
				index !== idx &&
				edge.source === existing.source &&
				edge.target === existing.target &&
				edge.type === nextType
		)
	) {
		return json(
			{ ok: false, error: 'Edge with same source, target, and type already exists' },
			{ status: 409 }
		);
	}

	const updates: Record<string, unknown> = {};
	if (label !== undefined) updates.label = label;
	if (type !== undefined) updates.type = type;
	if (directed !== undefined) updates.directed = directed;
	if (reviewStatus !== undefined) updates.reviewStatus = reviewStatus;

	graph.edges[idx] = { ...existing, ...updates };
	await saveGraphState(graph);

	return json(graph.edges[idx]);
}

export async function DELETE({ request }: RequestEvent) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
	}
	if (!plainObject(body))
		return json({ ok: false, error: 'Body must be a plain object' }, { status: 400 });

	const extra = unsupportedKeys(body, new Set(['id']));
	if (extra.length)
		return json({ ok: false, error: `Unsupported fields: ${extra.join(', ')}` }, { status: 400 });

	const { id } = body as Record<string, unknown>;

	if (typeof id !== 'string' || !id)
		return json({ ok: false, error: 'id must be a non-empty string' }, { status: 400 });

	const graph = await getGraphState();
	const len = graph.edges.length;
	graph.edges = graph.edges.filter((e) => e.id !== id);
	if (graph.edges.length === len)
		return json({ ok: false, error: 'Edge not found' }, { status: 404 });

	await saveGraphState(graph);

	return json({ ok: true });
}
