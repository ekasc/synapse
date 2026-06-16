import { json, type RequestEvent } from '@sveltejs/kit';
import { getGraphState, saveGraphState, type GraphState } from '$lib/server/store';

function isPoint(value: unknown): value is { x: number; y: number } {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { x?: unknown }).x === 'number'
		&& typeof (value as { y?: unknown }).y === 'number';
}

function isGraphState(value: unknown): value is GraphState {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as { positions?: unknown; edges?: unknown };
	if (typeof candidate.positions !== 'object' || candidate.positions === null) return false;
	if (!Array.isArray(candidate.edges)) return false;

	const positions = candidate.positions as Record<string, unknown>;
	const validPositions = Object.values(positions).every(isPoint);
	const validEdges = candidate.edges.every((edge: unknown) => (
		typeof edge === 'object'
		&& edge !== null
		&& typeof (edge as { source?: unknown }).source === 'string'
		&& typeof (edge as { target?: unknown }).target === 'string'
	));

	return validPositions && validEdges;
}

export function GET() {
	return json(getGraphState());
}

export async function PUT({ request }: RequestEvent) {
	const body: unknown = await request.json();
	if (!isGraphState(body)) {
		return json({ ok: false, error: 'Invalid graph state' }, { status: 400 });
	}

	saveGraphState(body);
	return json({ ok: true });
}
