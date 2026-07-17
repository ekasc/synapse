import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
	list: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	rename: vi.fn(),
	delete: vi.fn()
}));

vi.mock('$lib/server/course-map/planning-scenarios', () => ({
	createPlanningScenarioRepository: () => repository
}));

import { GET as list, POST } from './+server';
import { DELETE, GET, PATCH, PUT } from './[id]/+server';

const platform = { env: { BRIEF_DB: {} } };

function request(method: string, body?: string) {
	return new Request('http://localhost/api/course-map/scenarios/scenario-1', {
		method,
		body,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' }
	});
}

describe('course map scenario API', () => {
	beforeEach(() => vi.resetAllMocks());

	it('returns collection and create payloads with conventional statuses', async () => {
		repository.list.mockResolvedValue({ outcome: 'ok', value: [{ id: 'scenario-1' }] });
		repository.create.mockResolvedValue({ outcome: 'ok', value: { id: 'scenario-2' } });

		const listed = await list({ platform } as never);
		const created = await POST({
			platform,
			request: request('POST', JSON.stringify({ name: 'Plan', moves: [{}] }))
		} as never);

		expect(listed.status).toBe(200);
		expect(await listed.json()).toEqual({ scenarios: [{ id: 'scenario-1' }] });
		expect(created.status).toBe(201);
		expect(await created.json()).toEqual({ scenario: { id: 'scenario-2' } });
	});

	it.each([
		['validation', 400],
		['not-found', 404],
		['conflict', 409]
	])('maps repository %s outcomes to %i', async (outcome, status) => {
		repository.update.mockResolvedValue(
			outcome === 'validation' ? { outcome, message: 'invalid revision' } : { outcome }
		);
		const response = await PUT({
			platform,
			params: { id: 'scenario-1' },
			request: request('PUT', '{}')
		} as never);
		expect(response.status).toBe(status);
	});

	it('passes malformed JSON to repository validation rather than throwing', async () => {
		repository.create.mockResolvedValue({
			outcome: 'validation',
			message: 'request must be a plain object'
		});
		const response = await POST({ platform, request: request('POST', '{') } as never);
		expect(response.status).toBe(400);
		expect(repository.create).toHaveBeenCalledWith(undefined);
	});

	it('supports get, rename, and revision-controlled delete', async () => {
		repository.get.mockResolvedValue({ outcome: 'ok', value: { id: 'scenario-1' } });
		repository.rename.mockResolvedValue({
			outcome: 'ok',
			value: { id: 'scenario-1', revision: 2 }
		});
		repository.delete.mockResolvedValue({ outcome: 'ok', value: null });

		expect((await GET({ platform, params: { id: 'scenario-1' } } as never)).status).toBe(200);
		expect(
			(
				await PATCH({
					platform,
					params: { id: 'scenario-1' },
					request: request('PATCH', JSON.stringify({ name: 'Renamed', revision: 1 }))
				} as never)
			).status
		).toBe(200);
		const deleted = await DELETE({
			platform,
			params: { id: 'scenario-1' },
			request: request('DELETE', JSON.stringify({ revision: 2 }))
		} as never);
		expect(deleted.status).toBe(200);
		expect(repository.delete).toHaveBeenCalledWith('scenario-1', 2);
	});

	it('returns safe 500 responses without exposing repository errors', async () => {
		repository.get.mockRejectedValue(new Error('SQLITE_ERROR: no such table secret_table'));
		const response = await GET({ platform, params: { id: 'scenario-1' } } as never);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Unable to load scenario' });
	});

	it('returns safe 500 when the platform binding is unavailable', async () => {
		const response = await list({ platform: undefined } as never);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Service unavailable' });
	});
});
