import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
	list: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	updateProgress: vi.fn(),
	delete: vi.fn()
}));

vi.mock('$lib/server/practice/sessions', () => ({
	createPracticeSessionRepository: () => repository
}));

import { GET as list, POST } from './+server';
import { DELETE, GET, PATCH } from './[id]/+server';

const platform = { env: { BRIEF_DB: {} } };

const baseUrl = 'http://localhost/api/practice/sessions';

function request(method: string, body?: string) {
	return new Request(`${baseUrl}/session-1`, {
		method,
		body,
		headers: body === undefined ? undefined : { 'content-type': 'application/json' }
	});
}

function url(path = '/') {
	return new URL(path, baseUrl);
}

describe('practice sessions API', () => {
	beforeEach(() => vi.resetAllMocks());

	it('returns collection and create payloads with conventional statuses', async () => {
		repository.list.mockResolvedValue({ outcome: 'ok', value: [{ id: 's1' }] });
		repository.create.mockResolvedValue({ outcome: 'ok', value: { id: 's2' } });

		const listed = await list({ platform, url: url() } as never);
		const created = await POST({
			platform,
			request: request('POST', JSON.stringify({ courseId: 'c1', courseCode: 'CS1' }))
		} as never);

		expect(listed.status).toBe(200);
		expect(await listed.json()).toEqual({ sessions: [{ id: 's1' }] });
		expect(created.status).toBe(201);
		expect(await created.json()).toEqual({ session: { id: 's2' } });
	});

	it.each([
		['validation', 400],
		['not-found', 404]
	])('maps repository %s outcomes to %i', async (outcome, status) => {
		repository.updateProgress.mockResolvedValue(
			outcome === 'validation' ? { outcome, message: 'invalid progress' } : { outcome }
		);
		const response = await PATCH({
			platform,
			params: { id: 'session-1' },
			request: request('PATCH', '{}')
		} as never);
		expect(response.status).toBe(status);
	});

	it('passes malformed JSON to repository validation', async () => {
		repository.create.mockResolvedValue({
			outcome: 'validation',
			message: 'request must be a plain object'
		});
		const response = await POST({ platform, request: request('POST', '{') } as never);
		expect(response.status).toBe(400);
		expect(repository.create).toHaveBeenCalledWith(undefined);
	});

	it('supports get, patch (updateProgress), and delete', async () => {
		repository.get.mockResolvedValue({ outcome: 'ok', value: { id: 'session-1' } });
		repository.updateProgress.mockResolvedValue({
			outcome: 'ok',
			value: { id: 'session-1', score: 5 }
		});
		repository.delete.mockResolvedValue({ outcome: 'ok', value: null });

		expect((await GET({ platform, params: { id: 'session-1' } } as never)).status).toBe(200);
		expect(
			(
				await PATCH({
					platform,
					params: { id: 'session-1' },
					request: request('PATCH', JSON.stringify({ score: 5 }))
				} as never)
			).status
		).toBe(200);
		const deleted = await DELETE({
			platform,
			params: { id: 'session-1' }
		} as never);
		expect(deleted.status).toBe(200);
		expect(repository.delete).toHaveBeenCalledWith('session-1');
	});

	it('returns safe 500 responses without exposing repository errors', async () => {
		repository.get.mockRejectedValue(new Error('SQLITE_ERROR: no such table'));
		const response = await GET({ platform, params: { id: 'session-1' } } as never);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Unable to load session' });
	});

	it('returns safe 500 when the platform binding is unavailable', async () => {
		const response = await list({ platform: undefined, url: url() } as never);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Service unavailable' });
	});
});
