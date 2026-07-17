import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
	applyGraphImport: vi.fn(),
	getCourses: vi.fn(),
	getGraphState: vi.fn(),
	getSemesters: vi.fn()
}));

vi.mock('$lib/server/store', () => store);

import { POST } from './+server';

function request(body: unknown) {
	return new Request('http://localhost/api/graph/import', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('graph import API', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		store.getSemesters.mockResolvedValue([{ id: 'fall', term: 'Fall', year: 2026, order: 1 }]);
		store.getCourses.mockResolvedValue([]);
		store.getGraphState.mockResolvedValue({ positions: {}, edges: [] });
		store.applyGraphImport.mockResolvedValue(undefined);
	});

	it('rejects malformed JSON and non-object payloads before reading store state', async () => {
		const malformed = new Request('http://localhost/api/graph/import', {
			method: 'POST',
			body: '{bad'
		});
		expect((await POST({ request: malformed } as never)).status).toBe(400);
		expect((await POST({ request: request([]) } as never)).status).toBe(400);
		expect(store.applyGraphImport).not.toHaveBeenCalled();
	});

	it('rejects oversized requests, strings, and edge collections before writing', async () => {
		const oversizedRequest = new Request('http://localhost/api/graph/import', {
			method: 'POST',
			headers: { 'content-length': '1000001' },
			body: '{}'
		});
		expect((await POST({ request: oversizedRequest } as never)).status).toBe(413);

		const strings = await POST({
			request: request({
				nodes: [{ id: 'x'.repeat(129), code: 'A'.repeat(65), name: 'N'.repeat(201) }]
			})
		} as never);
		expect(strings.status).toBe(400);

		const edges = await POST({
			request: request({
				edges: Array.from({ length: 2001 }, () => ({ source: 'a', target: 'b' }))
			})
		} as never);
		expect(edges.status).toBe(400);
		expect(store.applyGraphImport).not.toHaveBeenCalled();
	});

	it.each([
		[{ nodes: [{ code: 'A', name: 'One', surprise: true }] }, 'unsupported fields'],
		[
			{
				nodes: [
					{ code: 'A', name: 'One' },
					{ code: ' a ', name: 'Two' }
				]
			},
			'duplicates course code'
		],
		[
			{
				nodes: [
					{ id: 'same', code: 'A', name: 'One' },
					{ id: 'same', code: 'B', name: 'Two' }
				]
			},
			'duplicates node id'
		],
		[{ nodes: [{ code: 'A', name: 'One', semesterId: 'missing' }] }, 'invalid semester'],
		[{ nodes: [{ code: 'A', name: 'One', x: Number.MAX_VALUE, y: 0 }] }, 'must be finite'],
		[{ nodes: [{ code: 'A', name: 'One' }], edges: [{ source: 'A', target: 'A' }] }, 'self-edge'],
		[
			{ nodes: [{ code: 'A', name: 'One' }], edges: [{ source: 'A', target: 'missing' }] },
			'target does not exist'
		],
		[
			{
				nodes: [{ code: 'A', name: 'One' }],
				edges: [{ source: 'A', target: 'missing', type: 'coreq' }]
			},
			'type is unsupported'
		]
	])('rejects the complete payload before writing: %j', async (body, message) => {
		const response = await POST({ request: request(body) } as never);
		expect(response.status).toBe(400);
		expect((await response.json()).issues.join(' ')).toContain(message);
		expect(store.applyGraphImport).not.toHaveBeenCalled();
	});

	it('rejects duplicate imported edges and oversized collections before writing', async () => {
		const node = { code: 'A', name: 'One' };
		const response = await POST({
			request: request({
				nodes: [
					node,
					...Array.from({ length: 500 }, (_, index) => ({ code: `C${index}`, name: 'Course' }))
				],
				edges: [
					{ source: 'A', target: 'C1', type: 'related' },
					{ source: 'A', target: 'C1', type: 'related' }
				]
			})
		} as never);
		expect(response.status).toBe(400);
		const result = await response.json();
		expect(result.issues).toEqual(
			expect.arrayContaining([
				expect.stringContaining('at most 500'),
				expect.stringContaining('duplicates another imported edge')
			])
		);
		expect(store.applyGraphImport).not.toHaveBeenCalled();
	});

	it('commits courses and graph once and returns structured counts and warnings', async () => {
		store.getCourses.mockResolvedValue([
			{ id: 'existing', semesterId: 'fall', code: 'OLD', name: 'Old' }
		]);
		store.getGraphState.mockResolvedValue({
			positions: {},
			edges: [{ id: 'edge', source: 'existing', target: 'other', type: 'related' }]
		});
		const response = await POST({
			request: request({
				nodes: [
					{ code: 'old', name: 'Updated' },
					{ id: 'new', code: 'NEW', name: 'New', x: 10, y: 20, width: 176, height: 70 }
				],
				edges: [{ source: 'OLD', target: 'new', type: 'prereq' }]
			})
		} as never);
		expect(response.status).toBe(200);
		expect(store.applyGraphImport).toHaveBeenCalledTimes(1);
		const [mutations, graph] = store.applyGraphImport.mock.calls[0];
		expect(mutations).toHaveLength(2);
		expect(graph.positions.new).toEqual({ x: 10, y: 20 });
		expect(graph.edges.at(-1)).toMatchObject({ source: 'existing', target: 'new', type: 'prereq' });
		expect(await response.json()).toMatchObject({
			ok: true,
			counts: {
				nodesReceived: 2,
				created: 1,
				updated: 1,
				edgesReceived: 1,
				edgesAdded: 1,
				edgesSkipped: 0
			},
			warnings: [expect.stringContaining('dimensions')]
		});
	});
});
