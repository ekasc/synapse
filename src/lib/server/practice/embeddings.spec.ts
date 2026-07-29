import { describe, expect, it, vi } from 'vitest';
import type { MaterialChunk } from './material-index';
import {
	createSemanticPipeline,
	createVectorizeStore,
	createWorkersAiEmbedder,
	fromVectorId,
	indexChunksSemantically,
	toVectorId
} from './embeddings';

function makeChunk(id: string, text: string): MaterialChunk {
	return {
		id,
		materialId: id.split(':')[0],
		courseId: 'course-1',
		chunkIndex: 1,
		pageStart: 1,
		pageEnd: 1,
		text,
		normalizedText: text.toLowerCase(),
		createdAt: '2026-07-27T00:00:00.000Z'
	};
}

describe('vector id mapping', () => {
	it('round-trips chunk ids through Vectorize-safe ids', () => {
		const id = '550e8400-e29b-41d4-a716-446655440000:p142:c3';
		expect(toVectorId(id)).toBe('550e8400-e29b-41d4-a716-446655440000_p142_c3');
		expect(fromVectorId(toVectorId(id))).toBe(id);
	});
});

describe('createWorkersAiEmbedder', () => {
	it('batches texts and flattens data[].embedding responses', async () => {
		const run = vi.fn(async (_model: string, input: unknown) => ({
			data: (input as { text: string[] }).text.map((_, i) => ({ embedding: [i, i] }))
		}));
		const embedder = createWorkersAiEmbedder(run);

		const vectors = await embedder.embed(['a', 'b', 'c']);

		expect(vectors).toEqual([
			[0, 0],
			[1, 1],
			[2, 2]
		]);
	});

	it('accepts bare number[][] data responses', async () => {
		const run = vi.fn(async () => ({ data: [[1, 2]] }));
		const embedder = createWorkersAiEmbedder(run);

		expect(await embedder.embed(['a'])).toEqual([[1, 2]]);
	});

	it('throws when the vector count does not match the input', async () => {
		const run = vi.fn(async () => ({ data: [{ embedding: [1] }] }));
		const embedder = createWorkersAiEmbedder(run);

		await expect(embedder.embed(['a', 'b'])).rejects.toThrow('Embedding count mismatch');
	});
});

describe('createVectorizeStore', () => {
	it('upserts sanitized ids with chunk metadata', async () => {
		const upsert = vi.fn(async () => ({}));
		const store = createVectorizeStore({
			upsert,
			query: vi.fn(),
			deleteByIds: vi.fn()
		});

		await store.upsert([makeChunk('m1:p1:c0', 'text')], [[0.1, 0.2]]);

		expect(upsert).toHaveBeenCalledWith([
			{
				id: 'm1_p1_c0',
				values: [0.1, 0.2],
				metadata: { chunkId: 'm1:p1:c0', courseId: 'course-1', materialId: 'm1' }
			}
		]);
	});

	it('maps query matches back to chunk ids using metadata', async () => {
		const store = createVectorizeStore({
			upsert: vi.fn(),
			query: vi.fn(async () => ({
				matches: [{ id: 'm1_p1_c0', score: 0.9, metadata: { chunkId: 'm1:p1:c0' } }]
			})),
			deleteByIds: vi.fn()
		});

		expect(await store.query([0.1], 5)).toEqual([{ chunkId: 'm1:p1:c0', score: 0.9 }]);
	});

	it('falls back to id parsing when metadata is missing', async () => {
		const store = createVectorizeStore({
			upsert: vi.fn(),
			query: vi.fn(async () => ({ matches: [{ id: 'm1_p2_c1', score: 0.5 }] })),
			deleteByIds: vi.fn()
		});

		expect(await store.query([0.1], 5)).toEqual([{ chunkId: 'm1:p2:c1', score: 0.5 }]);
	});
});

describe('createSemanticPipeline', () => {
	it('returns null when either binding is missing', () => {
		expect(createSemanticPipeline({})).toBeNull();
		expect(createSemanticPipeline({ AI: { run: vi.fn() } })).toBeNull();
	});
});

describe('indexChunksSemantically', () => {
	it('is a no-op without a pipeline', async () => {
		await expect(
			indexChunksSemantically(null, [makeChunk('m1:p1:c0', 'x')])
		).resolves.toBeUndefined();
	});

	it('swallows embedding failures so durable indexing is never blocked', async () => {
		const embedder = { embed: vi.fn(async () => Promise.reject(new Error('ai down'))) };
		const store = { upsert: vi.fn(), query: vi.fn(), deleteByIds: vi.fn() };

		await expect(
			indexChunksSemantically({ embedder, store }, [makeChunk('m1:p1:c0', 'x')])
		).resolves.toBeUndefined();
		expect(store.upsert).not.toHaveBeenCalled();
	});
});
