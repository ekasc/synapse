import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	createPlanningScenarioRepository,
	type ScenarioResult
} from '$lib/server/course-map/planning-scenarios';

function response<T>(result: ScenarioResult<T>) {
	if (result.outcome === 'ok') return json({ scenario: result.value });
	if (result.outcome === 'validation') return json({ error: result.message }, { status: 400 });
	if (result.outcome === 'not-found') return json({ error: 'Scenario not found' }, { status: 404 });
	return json({ error: 'Scenario revision conflict' }, { status: 409 });
}

async function bodyOf(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

function withRevision(body: unknown) {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
	const { expectedRevision, ...rest } = body as Record<string, unknown>;
	return { ...rest, revision: expectedRevision };
}

function unavailable() {
	return json({ error: 'Service unavailable' }, { status: 500 });
}

export async function GET({ params, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		return response(await createPlanningScenarioRepository(platform.env.BRIEF_DB).get(params.id));
	} catch {
		return json({ error: 'Unable to load scenario' }, { status: 500 });
	}
}

export async function PUT({ params, request, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		return response(
			await createPlanningScenarioRepository(platform.env.BRIEF_DB).update(
				params.id,
				withRevision(await bodyOf(request))
			)
		);
	} catch {
		return json({ error: 'Unable to update scenario' }, { status: 500 });
	}
}

export async function PATCH({ params, request, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		return response(
			await createPlanningScenarioRepository(platform.env.BRIEF_DB).rename(
				params.id,
				withRevision(await bodyOf(request))
			)
		);
	} catch {
		return json({ error: 'Unable to rename scenario' }, { status: 500 });
	}
}

export async function DELETE({ params, request, platform }: RequestEvent) {
	if (!platform) return unavailable();
	try {
		const body = await bodyOf(request);
		if (
			body === null ||
			typeof body !== 'object' ||
			Array.isArray(body) ||
			Object.getPrototypeOf(body) !== Object.prototype ||
			Object.keys(body).some((key) => key !== 'revision')
		) {
			return json({ error: 'request must contain only revision' }, { status: 400 });
		}
		const revision = (body as Record<string, unknown>).revision;
		return response(
			await createPlanningScenarioRepository(platform.env.BRIEF_DB).delete(params.id, revision)
		);
	} catch {
		return json({ error: 'Unable to delete scenario' }, { status: 500 });
	}
}
