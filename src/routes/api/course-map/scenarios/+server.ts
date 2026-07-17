import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	createPlanningScenarioRepository,
	type ScenarioResult
} from '$lib/server/course-map/planning-scenarios';

function response<T>(result: ScenarioResult<T>, status = 200) {
	if (result.outcome === 'ok') return json({ scenario: result.value }, { status });
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

export async function GET({ platform }: RequestEvent) {
	if (!platform) return json({ error: 'Service unavailable' }, { status: 500 });
	try {
		const result = await createPlanningScenarioRepository(platform.env.BRIEF_DB).list();
		if (result.outcome !== 'ok') return response(result);
		return json({ scenarios: result.value });
	} catch {
		return json({ error: 'Unable to load scenarios' }, { status: 500 });
	}
}

export async function POST({ request, platform }: RequestEvent) {
	if (!platform) return json({ error: 'Service unavailable' }, { status: 500 });
	try {
		return response(
			await createPlanningScenarioRepository(platform.env.BRIEF_DB).create(await bodyOf(request)),
			201
		);
	} catch {
		return json({ error: 'Unable to create scenario' }, { status: 500 });
	}
}
