import { describe, expect, it, vi } from 'vitest';
import { createMaterialIndexRepository } from './material-index';

function mockBinding(options: { first?: unknown[]; all?: unknown[][] } = {}) {
	const first = [...(options.first ?? [])];
	const all = [...(options.all ?? [])];
	const statements: Array<{ sql: string; values: unknown[] }> = [];
	const prepare = vi.fn((sql: string) => {
		const statement = {
			sql,
			values: [] as unknown[],
			bind(...values: unknown[]) {
				statement.values = values;
				return statement;
			},
			async first<T>() {
				return (first.shift() ?? null) as T;
			},
			async all<T>() {
				return { results: (all.shift() ?? []) as T[] };
			},
			async run() {
				return { meta: { changes: 1 } };
			}
		};
		statements.push(statement);
		return statement;
	});
	const batch = vi.fn(async (_statements: D1PreparedStatement[]) => []);
	return {
		binding: { prepare, batch } as unknown as D1Database,
		prepare,
		batch,
		statements
	};
}

const material = {
	id: 'material-1',
	courseId: 'course-1',
	fileName: 'book.pdf',
	mimeType: 'application/pdf',
	size: 100,
	uploadedAt: '2026-01-01T00:00:00.000Z'
};

const indexRow = {
	material_id: 'material-1',
	course_id: 'course-1',
	status: 'pending',
	page_count: null,
	next_page: 1,
	character_count: 0,
	error_message: null,
	index_version: 1,
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-01-01T00:00:00.000Z'
};

describe('material index repository', () => {
	it('initializes a supported material idempotently', async () => {
		const mock = mockBinding({ first: [indexRow] });
		const result = await createMaterialIndexRepository(mock.binding).ensure(material);
		expect(result).toMatchObject({ materialId: material.id, status: 'pending', nextPage: 1 });
		expect(mock.statements[0].sql).toContain('ON CONFLICT(material_id) DO NOTHING');
	});

	it('returns only chunks joined to ready indexes', async () => {
		const chunkRow = {
			id: 'material-1:p12:c0',
			material_id: 'material-1',
			course_id: 'course-1',
			chunk_index: 12000,
			page_start: 12,
			page_end: 12,
			text: 'Event logging',
			normalized_text: 'event logging',
			created_at: '2026-01-01T00:00:00.000Z'
		};
		const mock = mockBinding({ all: [[chunkRow]] });
		const chunks = await createMaterialIndexRepository(mock.binding).listReadyChunks('course-1');
		expect(chunks[0]).toMatchObject({ id: chunkRow.id, pageStart: 12, pageEnd: 12 });
		expect(mock.statements[0].sql).toContain("i.status = 'ready'");
	});

	it('writes chunks and the page checkpoint in one D1 batch', async () => {
		const readyRow = { ...indexRow, status: 'ready', page_count: 12, next_page: 13 };
		const mock = mockBinding({ first: [readyRow] });
		await createMaterialIndexRepository(mock.binding).saveBatch({
			materialId: 'material-1',
			courseId: 'course-1',
			pageCount: 12,
			nextPage: 13,
			characterCount: 13,
			status: 'ready',
			chunks: [
				{
					id: 'material-1:p12:c0',
					materialId: 'material-1',
					courseId: 'course-1',
					chunkIndex: 12000,
					pageStart: 12,
					pageEnd: 12,
					text: 'Event logging',
					normalizedText: 'event logging',
					createdAt: '2026-01-01T00:00:00.000Z'
				}
			]
		});
		expect(mock.batch).toHaveBeenCalledOnce();
		const statements = mock.batch.mock.calls[0][0];
		expect(statements).toHaveLength(2);
	});

	it('deletes derived chunks and index metadata together', async () => {
		const mock = mockBinding();
		await createMaterialIndexRepository(mock.binding).delete('material-1');
		expect(mock.batch).toHaveBeenCalledOnce();
		expect(mock.statements.map((statement) => statement.sql)).toEqual([
			'DELETE FROM practice_material_chunks WHERE material_id = ?',
			'DELETE FROM practice_material_indexes WHERE material_id = ?'
		]);
	});
});
