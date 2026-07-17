import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
	getCourses: vi.fn(),
	getGraphState: vi.fn(),
	saveGraphState: vi.fn()
}));

vi.mock('$lib/server/store', () => store);

import { POST, PATCH, DELETE } from './+server';

function apiRequest(body: unknown) {
	return new Request('http://localhost/api/graph/edge', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('graph edge API', () => {
	const courseA = { id: 'course-a', semesterId: 'fall', code: 'CS101', name: 'CS 101' };
	const courseB = { id: 'course-b', semesterId: 'fall', code: 'CS102', name: 'CS 102' };

	beforeEach(() => {
		vi.resetAllMocks();
		store.getCourses.mockResolvedValue([courseA, courseB]);
		store.getGraphState.mockResolvedValue({ positions: {}, edges: [] });
	});

	describe('POST', () => {
		it('creates an edge and returns it with 201', async () => {
			const body = { source: 'course-a', target: 'course-b', type: 'prereq' };
			const response = await POST({ request: apiRequest(body) } as never);

			expect(response.status).toBe(201);
			const edge = await response.json();
			expect(edge).toMatchObject({
				source: 'course-a',
				target: 'course-b',
				type: 'prereq',
				label: 'prereq',
				directed: true,
				createdBy: 'user',
				reviewStatus: 'accepted'
			});
			expect(edge.id).toEqual(expect.any(String));
			expect(store.saveGraphState).toHaveBeenCalledOnce();
			const saved = store.saveGraphState.mock.calls[0][0];
			expect(saved.edges).toHaveLength(1);
		});

		it('rejects non-existent source course', async () => {
			const response = await POST({
				request: apiRequest({ source: 'missing', target: 'course-b', type: 'prereq' })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('source course not found');
			expect(store.saveGraphState).not.toHaveBeenCalled();
		});

		it('rejects non-existent target course', async () => {
			const response = await POST({
				request: apiRequest({ source: 'course-a', target: 'missing', type: 'prereq' })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('target course not found');
		});

		it('rejects duplicate source+target+type', async () => {
			store.getGraphState.mockResolvedValue({
				positions: {},
				edges: [{ id: 'e1', source: 'course-a', target: 'course-b', type: 'prereq' }]
			});

			const response = await POST({
				request: apiRequest({ source: 'course-a', target: 'course-b', type: 'prereq' })
			} as never);

			expect(response.status).toBe(409);
			expect(store.saveGraphState).not.toHaveBeenCalled();
		});

		it('rejects self-edge', async () => {
			const response = await POST({
				request: apiRequest({ source: 'course-a', target: 'course-a', type: 'prereq' })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('must be different');
		});

		it('rejects invalid edge type', async () => {
			const response = await POST({
				request: apiRequest({ source: 'course-a', target: 'course-b', type: 'invalid-type' })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('Invalid edge type');
		});

		it('rejects unsupported body keys', async () => {
			const response = await POST({
				request: apiRequest({ source: 'course-a', target: 'course-b', type: 'prereq', foo: 'bar' })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('Unsupported fields');
		});
	});

	describe('PATCH', () => {
		it('updates edge fields and returns updated edge', async () => {
			const existing = {
				id: 'edge-1',
				source: 'course-a',
				target: 'course-b',
				type: 'prereq',
				label: 'prereq',
				directed: false,
				createdBy: 'user',
				reviewStatus: 'pending'
			};
			store.getGraphState.mockResolvedValue({ positions: {}, edges: [existing] });

			const response = await PATCH({
				request: apiRequest({
					id: 'edge-1',
					label: 'updated label',
					type: 'coreq',
					directed: true,
					reviewStatus: 'accepted'
				})
			} as never);

			expect(response.status).toBe(200);
			const updated = await response.json();
			expect(updated.label).toBe('updated label');
			expect(updated.type).toBe('coreq');
			expect(updated.directed).toBe(true);
			expect(updated.reviewStatus).toBe('accepted');
			expect(store.saveGraphState).toHaveBeenCalledOnce();
		});

		it('returns 404 for non-existent edge', async () => {
			const response = await PATCH({
				request: apiRequest({ id: 'no-such-edge', label: 'anything' })
			} as never);

			expect(response.status).toBe(404);
			expect((await response.json()).error).toBe('Edge not found');
		});

		it('rejects an update that would duplicate another edge', async () => {
			store.getGraphState.mockResolvedValue({
				positions: {},
				edges: [
					{ id: 'edge-1', source: 'course-a', target: 'course-b', type: 'prereq' },
					{ id: 'edge-2', source: 'course-a', target: 'course-b', type: 'coreq' }
				]
			});

			const response = await PATCH({
				request: apiRequest({ id: 'edge-2', type: 'prereq' })
			} as never);

			expect(response.status).toBe(409);
			expect(store.saveGraphState).not.toHaveBeenCalled();
		});

		it('rejects unknown body keys', async () => {
			const response = await PATCH({
				request: apiRequest({ id: 'edge-1', confidence: 0.9 })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('Unsupported fields');
		});

		it('rejects invalid type in update', async () => {
			const existing = { id: 'edge-1', source: 'course-a', target: 'course-b', type: 'prereq' };
			store.getGraphState.mockResolvedValue({ positions: {}, edges: [existing] });

			const response = await PATCH({
				request: apiRequest({ id: 'edge-1', type: 'bad-type' })
			} as never);

			expect(response.status).toBe(400);
		});
	});

	describe('DELETE', () => {
		it('removes an edge and returns ok', async () => {
			const existing = { id: 'edge-1', source: 'course-a', target: 'course-b', type: 'prereq' };
			store.getGraphState.mockResolvedValue({ positions: {}, edges: [existing] });

			const response = await DELETE({
				request: apiRequest({ id: 'edge-1' })
			} as never);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ ok: true });
			expect(store.saveGraphState).toHaveBeenCalledOnce();
			const saved = store.saveGraphState.mock.calls[0][0];
			expect(saved.edges).toHaveLength(0);
		});

		it('returns 404 for non-existent edge', async () => {
			const response = await DELETE({
				request: apiRequest({ id: 'no-such-edge' })
			} as never);

			expect(response.status).toBe(404);
			expect((await response.json()).error).toBe('Edge not found');
		});

		it('rejects unsupported body keys', async () => {
			const response = await DELETE({
				request: apiRequest({ id: 'edge-1', type: 'prereq' })
			} as never);

			expect(response.status).toBe(400);
			expect((await response.json()).error).toContain('Unsupported fields');
		});
	});
});
