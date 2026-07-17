import fs from 'node:fs';
import path from 'node:path';
import type { MaterialRecord } from '$lib/server/r2';

export const MATERIAL_INDEX_VERSION = 1;
export const PDF_PAGE_LIMIT = 1000;
export const PDF_BATCH_SIZE = 25;

export type MaterialIndexStatus =
	| 'pending'
	| 'indexing'
	| 'ready'
	| 'needs_ocr'
	| 'unsupported'
	| 'failed'
	| 'too_large';

export type MaterialIndexRecord = {
	materialId: string;
	courseId: string;
	status: MaterialIndexStatus;
	pageCount: number | null;
	nextPage: number;
	characterCount: number;
	errorMessage: string | null;
	indexVersion: number;
	createdAt: string;
	updatedAt: string;
};

export type MaterialChunk = {
	id: string;
	materialId: string;
	courseId: string;
	chunkIndex: number;
	pageStart: number | null;
	pageEnd: number | null;
	text: string;
	normalizedText: string;
	createdAt: string;
};

export type MaterialWithIndex = MaterialRecord & { index: MaterialIndexRecord };

type BatchUpdate = {
	materialId: string;
	courseId: string;
	pageCount: number;
	nextPage: number;
	characterCount: number;
	status: MaterialIndexStatus;
	chunks: MaterialChunk[];
};

type IndexRow = {
	material_id: string;
	course_id: string;
	status: string;
	page_count: number | null;
	next_page: number;
	character_count: number;
	error_message: string | null;
	index_version: number;
	created_at: string;
	updated_at: string;
};

type ChunkRow = {
	id: string;
	material_id: string;
	course_id: string;
	chunk_index: number;
	page_start: number | null;
	page_end: number | null;
	text: string;
	normalized_text: string;
	created_at: string;
};

export type MaterialIndexRepository = {
	ensure(material: MaterialRecord): Promise<MaterialIndexRecord>;
	get(materialId: string): Promise<MaterialIndexRecord | null>;
	list(courseId: string): Promise<MaterialIndexRecord[]>;
	listReadyChunks(courseId: string): Promise<MaterialChunk[]>;
	saveBatch(update: BatchUpdate): Promise<MaterialIndexRecord>;
	setStatus(
		materialId: string,
		courseId: string,
		status: MaterialIndexStatus,
		options?: { pageCount?: number | null; errorMessage?: string | null }
	): Promise<MaterialIndexRecord>;
	delete(materialId: string): Promise<void>;
};

function supportsIndexing(material: Pick<MaterialRecord, 'mimeType' | 'fileName'>): boolean {
	const mime = material.mimeType.toLowerCase();
	const name = material.fileName.toLowerCase();
	return mime === 'application/pdf' || name.endsWith('.pdf') || mime.startsWith('text/');
}

function initialRecord(material: MaterialRecord): MaterialIndexRecord {
	const now = new Date().toISOString();
	return {
		materialId: material.id,
		courseId: material.courseId,
		status: supportsIndexing(material) ? 'pending' : 'unsupported',
		pageCount: null,
		nextPage: 1,
		characterCount: 0,
		errorMessage: null,
		indexVersion: MATERIAL_INDEX_VERSION,
		createdAt: now,
		updatedAt: now
	};
}

function fromIndexRow(row: IndexRow): MaterialIndexRecord {
	return {
		materialId: row.material_id,
		courseId: row.course_id,
		status: row.status as MaterialIndexStatus,
		pageCount: row.page_count,
		nextPage: row.next_page,
		characterCount: row.character_count,
		errorMessage: row.error_message,
		indexVersion: row.index_version,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function fromChunkRow(row: ChunkRow): MaterialChunk {
	return {
		id: row.id,
		materialId: row.material_id,
		courseId: row.course_id,
		chunkIndex: row.chunk_index,
		pageStart: row.page_start,
		pageEnd: row.page_end,
		text: row.text,
		normalizedText: row.normalized_text,
		createdAt: row.created_at
	};
}

function createD1Repository(binding: D1Database): MaterialIndexRepository {
	return {
		async ensure(material) {
			const initial = initialRecord(material);
			await binding
				.prepare(
					`INSERT INTO practice_material_indexes
					 (material_id, course_id, status, page_count, next_page, character_count,
					  error_message, index_version, created_at, updated_at)
					 VALUES (?, ?, ?, NULL, 1, 0, NULL, ?, ?, ?)
					 ON CONFLICT(material_id) DO NOTHING`
				)
				.bind(
					initial.materialId,
					initial.courseId,
					initial.status,
					initial.indexVersion,
					initial.createdAt,
					initial.updatedAt
				)
				.run();
			return (await this.get(material.id)) ?? initial;
		},

		async get(materialId) {
			const row = await binding
				.prepare('SELECT * FROM practice_material_indexes WHERE material_id = ?')
				.bind(materialId)
				.first<IndexRow>();
			return row ? fromIndexRow(row) : null;
		},

		async list(courseId) {
			const result = await binding
				.prepare(
					'SELECT * FROM practice_material_indexes WHERE course_id = ? ORDER BY created_at, material_id'
				)
				.bind(courseId)
				.all<IndexRow>();
			return (result.results ?? []).map(fromIndexRow);
		},

		async listReadyChunks(courseId) {
			const result = await binding
				.prepare(
					`SELECT c.* FROM practice_material_chunks c
					 JOIN practice_material_indexes i ON i.material_id = c.material_id
					 WHERE c.course_id = ? AND i.status = 'ready'
					 ORDER BY c.material_id, c.chunk_index`
				)
				.bind(courseId)
				.all<ChunkRow>();
			return (result.results ?? []).map(fromChunkRow);
		},

		async saveBatch(update) {
			const now = new Date().toISOString();
			const statements = update.chunks.map((chunk) =>
				binding
					.prepare(
						`INSERT INTO practice_material_chunks
						 (id, material_id, course_id, chunk_index, page_start, page_end, text,
						  normalized_text, created_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
						 ON CONFLICT(material_id, chunk_index) DO UPDATE SET
						  id = excluded.id, page_start = excluded.page_start,
						  page_end = excluded.page_end, text = excluded.text,
						  normalized_text = excluded.normalized_text`
					)
					.bind(
						chunk.id,
						chunk.materialId,
						chunk.courseId,
						chunk.chunkIndex,
						chunk.pageStart,
						chunk.pageEnd,
						chunk.text,
						chunk.normalizedText,
						chunk.createdAt
					)
			);
			statements.push(
				binding
					.prepare(
						`UPDATE practice_material_indexes
						 SET status = ?, page_count = ?, next_page = ?, character_count = ?,
						     error_message = NULL, updated_at = ?
						 WHERE material_id = ? AND course_id = ?`
					)
					.bind(
						update.status,
						update.pageCount,
						update.nextPage,
						update.characterCount,
						now,
						update.materialId,
						update.courseId
					)
			);
			await binding.batch(statements);
			const result = await this.get(update.materialId);
			if (!result) throw new Error('Material index disappeared after batch update');
			return result;
		},

		async setStatus(materialId, courseId, status, options = {}) {
			const now = new Date().toISOString();
			await binding
				.prepare(
					`UPDATE practice_material_indexes
					 SET status = ?, page_count = COALESCE(?, page_count), error_message = ?, updated_at = ?
					 WHERE material_id = ? AND course_id = ?`
				)
				.bind(
					status,
					options.pageCount ?? null,
					options.errorMessage ?? null,
					now,
					materialId,
					courseId
				)
				.run();
			const result = await this.get(materialId);
			if (!result) throw new Error('Material index not found');
			return result;
		},

		async delete(materialId) {
			await binding.batch([
				binding
					.prepare('DELETE FROM practice_material_chunks WHERE material_id = ?')
					.bind(materialId),
				binding
					.prepare('DELETE FROM practice_material_indexes WHERE material_id = ?')
					.bind(materialId)
			]);
		}
	};
}

type FallbackData = {
	indexes: MaterialIndexRecord[];
	chunks: MaterialChunk[];
};

const FALLBACK_DIR = path.resolve('.data', 'practice-index');
const FALLBACK_FILE = path.join(FALLBACK_DIR, 'index.json');

function readFallback(): FallbackData {
	if (!fs.existsSync(FALLBACK_FILE)) return { indexes: [], chunks: [] };
	return JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8')) as FallbackData;
}

function writeFallback(data: FallbackData) {
	fs.mkdirSync(FALLBACK_DIR, { recursive: true });
	fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, '\t'));
}

function createFallbackRepository(): MaterialIndexRepository {
	return {
		async ensure(material) {
			const data = readFallback();
			const existing = data.indexes.find((item) => item.materialId === material.id);
			if (existing) return existing;
			const record = initialRecord(material);
			data.indexes.push(record);
			writeFallback(data);
			return record;
		},
		async get(materialId) {
			return readFallback().indexes.find((item) => item.materialId === materialId) ?? null;
		},
		async list(courseId) {
			return readFallback().indexes.filter((item) => item.courseId === courseId);
		},
		async listReadyChunks(courseId) {
			const data = readFallback();
			const ready = new Set(
				data.indexes
					.filter((item) => item.courseId === courseId && item.status === 'ready')
					.map((item) => item.materialId)
			);
			return data.chunks
				.filter((chunk) => chunk.courseId === courseId && ready.has(chunk.materialId))
				.sort((a, b) =>
					a.materialId === b.materialId
						? a.chunkIndex - b.chunkIndex
						: a.materialId.localeCompare(b.materialId)
				);
		},
		async saveBatch(update) {
			const data = readFallback();
			for (const chunk of update.chunks) {
				const position = data.chunks.findIndex(
					(item) => item.materialId === chunk.materialId && item.chunkIndex === chunk.chunkIndex
				);
				if (position === -1) data.chunks.push(chunk);
				else data.chunks[position] = chunk;
			}
			const position = data.indexes.findIndex((item) => item.materialId === update.materialId);
			if (position === -1) throw new Error('Material index not found');
			data.indexes[position] = {
				...data.indexes[position],
				status: update.status,
				pageCount: update.pageCount,
				nextPage: update.nextPage,
				characterCount: update.characterCount,
				errorMessage: null,
				updatedAt: new Date().toISOString()
			};
			writeFallback(data);
			return data.indexes[position];
		},
		async setStatus(materialId, courseId, status, options = {}) {
			const data = readFallback();
			const position = data.indexes.findIndex(
				(item) => item.materialId === materialId && item.courseId === courseId
			);
			if (position === -1) throw new Error('Material index not found');
			data.indexes[position] = {
				...data.indexes[position],
				status,
				pageCount: options.pageCount ?? data.indexes[position].pageCount,
				errorMessage: options.errorMessage ?? null,
				updatedAt: new Date().toISOString()
			};
			writeFallback(data);
			return data.indexes[position];
		},
		async delete(materialId) {
			const data = readFallback();
			data.indexes = data.indexes.filter((item) => item.materialId !== materialId);
			data.chunks = data.chunks.filter((item) => item.materialId !== materialId);
			writeFallback(data);
		}
	};
}

export function createMaterialIndexRepository(binding?: D1Database): MaterialIndexRepository {
	return binding ? createD1Repository(binding) : createFallbackRepository();
}

export async function attachMaterialIndexes(
	materials: MaterialRecord[],
	repository: MaterialIndexRepository
): Promise<MaterialWithIndex[]> {
	return Promise.all(
		materials.map(async (material) => ({
			...material,
			index: await repository.ensure(material)
		}))
	);
}
