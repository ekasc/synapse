import type { MaterialChunk } from './material-index';

export const EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5';
export const EMBEDDING_DIMENSIONS = 384;
export const VECTORIZE_INDEX_NAME = 'synapse-material-chunks';
const EMBED_BATCH_SIZE = 10;

export type EmbeddingProvider = {
	embed(texts: string[]): Promise<number[][]>;
};

export type VectorSearchMatch = {
	chunkId: string;
	score: number;
};

export type VectorStore = {
	upsert(chunks: MaterialChunk[], vectors: number[][]): Promise<void>;
	query(vector: number[], topK: number): Promise<VectorSearchMatch[]>;
	deleteByIds(chunkIds: string[]): Promise<void>;
};

// Vectorize ids only allow [A-Za-z0-9_-]; chunk ids contain ':' separators.
export function toVectorId(chunkId: string): string {
	return chunkId.replaceAll(':', '_');
}

export function fromVectorId(vectorId: string): string {
	const lastC = vectorId.lastIndexOf('_c');
	const lastP = vectorId.lastIndexOf('_p');
	if (lastC === -1 || lastP === -1 || lastP >= lastC) return vectorId;
	return `${vectorId.slice(0, lastP)}:${vectorId.slice(lastP + 1, lastC)}:${vectorId.slice(lastC + 1)}`;
}

type WorkersAiRun = (model: string, input: unknown) => Promise<unknown>;

function parseEmbeddingResponse(result: unknown, expected: number): number[][] {
	const data = (result as { data?: unknown })?.data;
	if (!Array.isArray(data)) throw new Error('Unexpected embedding response shape');
	const vectors = data.map((entry) => {
		if (Array.isArray(entry)) return entry as number[];
		const embedding = (entry as { embedding?: unknown })?.embedding;
		if (!Array.isArray(embedding)) throw new Error('Unexpected embedding entry shape');
		return embedding as number[];
	});
	if (vectors.length !== expected) throw new Error('Embedding count mismatch');
	return vectors;
}

export function createWorkersAiEmbedder(run: WorkersAiRun): EmbeddingProvider {
	return {
		async embed(texts) {
			const vectors: number[][] = [];
			for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
				const slice = texts.slice(start, start + EMBED_BATCH_SIZE);
				const result = await run(EMBEDDING_MODEL, { text: slice });
				vectors.push(...parseEmbeddingResponse(result, slice.length));
			}
			return vectors;
		}
	};
}

type VectorizeMetadataValue = string | number | boolean | string[];
type VectorizeMetadata = VectorizeMetadataValue | Record<string, VectorizeMetadataValue>;

type VectorizeLike = {
	upsert(
		vectors: Array<{
			id: string;
			values: number[];
			metadata?: Record<string, VectorizeMetadata>;
		}>
	): Promise<unknown>;
	query(
		vector: number[],
		options?: { topK?: number; returnMetadata?: boolean | 'all' }
	): Promise<{
		matches?: Array<{
			id: string;
			score: number;
			metadata?: Record<string, VectorizeMetadata>;
		}>;
	}>;
	deleteByIds(ids: string[]): Promise<unknown>;
};

export function createVectorizeStore(index: VectorizeLike): VectorStore {
	return {
		async upsert(chunks, vectors) {
			if (chunks.length === 0) return;
			await index.upsert(
				chunks.map((chunk, i) => ({
					id: toVectorId(chunk.id),
					values: vectors[i],
					metadata: { chunkId: chunk.id, courseId: chunk.courseId, materialId: chunk.materialId }
				}))
			);
		},
		async query(vector, topK) {
			const result = await index.query(vector, { topK, returnMetadata: 'all' });
			return (result.matches ?? []).map((match) => {
				const metaChunkId = match.metadata?.chunkId;
				return {
					chunkId: typeof metaChunkId === 'string' ? metaChunkId : fromVectorId(match.id),
					score: match.score
				};
			});
		},
		async deleteByIds(chunkIds) {
			if (chunkIds.length === 0) return;
			await index.deleteByIds(chunkIds.map(toVectorId));
		}
	};
}

export type SemanticPipeline = {
	embedder: EmbeddingProvider;
	store: VectorStore;
};

// Returns null when either binding is missing so callers degrade to the
// deterministic lexical scorer, matching the repo's optional-infra pattern.
export function createSemanticPipeline(env: {
	AI?: { run: WorkersAiRun };
	VECTORIZE?: VectorizeLike;
}): SemanticPipeline | null {
	if (!env.AI || !env.VECTORIZE) return null;
	return {
		embedder: createWorkersAiEmbedder(env.AI.run.bind(env.AI)),
		store: createVectorizeStore(env.VECTORIZE)
	};
}

// Best-effort: semantic indexing must never fail the durable D1 index write.
export async function indexChunksSemantically(
	pipeline: SemanticPipeline | null,
	chunks: MaterialChunk[]
): Promise<void> {
	if (!pipeline || chunks.length === 0) return;
	try {
		const vectors = await pipeline.embedder.embed(chunks.map((chunk) => chunk.text));
		await pipeline.store.upsert(chunks, vectors);
	} catch (cause) {
		console.error('Semantic indexing skipped:', cause);
	}
}
