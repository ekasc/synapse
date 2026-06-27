import { json, type RequestEvent } from '@sveltejs/kit';
import { getGraphState, saveGraphState, type GraphState } from '$lib/server/store';

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

const VALID_CREATED_BY = new Set(['user', 'ai'] as const);
const VALID_REVIEW_STATUS = new Set(['accepted', 'pending', 'rejected'] as const);

function isPoint(value: unknown): value is { x: number; y: number } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { x?: unknown }).x === 'number' &&
		typeof (value as { y?: unknown }).y === 'number'
	);
}

function isViewport(value: unknown): value is { x: number; y: number; zoom: number } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { x?: unknown }).x === 'number' &&
		typeof (value as { y?: unknown }).y === 'number' &&
		typeof (value as { zoom?: unknown }).zoom === 'number'
	);
}

function isGraphState(value: unknown): value is GraphState {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as { positions?: unknown; edges?: unknown; viewport?: unknown };
	if (typeof candidate.positions !== 'object' || candidate.positions === null) return false;
	if (!Array.isArray(candidate.edges)) return false;

	const positions = candidate.positions as Record<string, unknown>;
	const validPositions = Object.values(positions).every(isPoint);
	const validEdges = candidate.edges.every((edge: unknown) => {
		if (typeof edge !== 'object' || edge === null) return false;
		const e = edge as Record<string, unknown>;
		if (typeof e.source !== 'string' || typeof e.target !== 'string') return false;
		if (e.type !== undefined && typeof e.type === 'string') {
			if (!VALID_EDGE_TYPES.has(e.type)) return false;
		}
		if (e.directed !== undefined && typeof e.directed !== 'boolean') return false;
		if (e.createdBy !== undefined && !VALID_CREATED_BY.has(e.createdBy as 'user' | 'ai'))
			return false;
		if (e.confidence !== undefined && typeof e.confidence !== 'number') return false;
		if (e.reason !== undefined && typeof e.reason !== 'string') return false;
		if (
			e.reviewStatus !== undefined &&
			!VALID_REVIEW_STATUS.has(e.reviewStatus as 'accepted' | 'pending' | 'rejected')
		)
			return false;
		return true;
	});
	const validViewport = candidate.viewport === undefined || isViewport(candidate.viewport);

	return validPositions && validEdges && validViewport;
}

export async function GET() {
	return json(await getGraphState());
}

export async function PUT({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isGraphState(body)) {
		return json({ ok: false, error: 'Invalid graph state' }, { status: 400 });
	}

	await saveGraphState(body);
	return json({ ok: true });
}
