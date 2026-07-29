import { describe, expect, it } from 'vitest';
import type { MaterialRecord } from '$lib/server/r2';
import type {
	MaterialChunk,
	MaterialIndexRecord,
	MaterialIndexRepository,
	MaterialIndexStatus
} from './material-index';
import { runBackgroundIndexing } from './background-index';

type OwnedRecord = MaterialIndexRecord & { userId: string };

function makeRecord(overrides: Partial<OwnedRecord> = {}): OwnedRecord {
	return {
		materialId: 'material-1',
		courseId: 'course-1',
		status: 'pending',
		pageCount: null,
		nextPage: 1,
		characterCount: 0,
		errorMessage: null,
		indexVersion: 1,
		createdAt: '2026-07-27T00:00:00.000Z',
		updatedAt: '2026-07-27T00:00:00.000Z',
		userId: 'user-1',
		...overrides
	};
}

function makeMaterial(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
	return {
		id: 'material-1',
		courseId: 'course-1',
		fileName: 'notes.txt',
		mimeType: 'text/plain',
		size: 12,
		uploadedAt: '2026-07-27T00:00:00.000Z',
		...overrides
	};
}

type SaveBatchUpdate = Parameters<MaterialIndexRepository['saveBatch']>[1];

function createFakeRepository(records: OwnedRecord[], options: { forceIndexing?: boolean } = {}) {
	const store = new Map<string, OwnedRecord>();
	for (const record of records) store.set(record.materialId, { ...record });
	const saves: SaveBatchUpdate[] = [];

	const repository: MaterialIndexRepository = {
		async ensure(userId, material) {
			const existing = store.get(material.id);
			if (existing) return existing;
			const record = makeRecord({ materialId: material.id, courseId: material.courseId, userId });
			store.set(material.id, record);
			return record;
		},
		async get(_userId, materialId) {
			return store.get(materialId) ?? null;
		},
		async list(_userId, courseId) {
			return [...store.values()].filter((record) => record.courseId === courseId);
		},
		async listIndexable(limit) {
			return [...store.values()]
				.filter((record) => record.status === 'pending' || record.status === 'indexing')
				.slice(0, limit);
		},
		async listReadyChunks(): Promise<MaterialChunk[]> {
			return [];
		},
		async saveBatch(userId, update) {
			saves.push(update);
			const current = store.get(update.materialId) ?? makeRecord({ userId });
			const next: OwnedRecord = {
				...current,
				status: options.forceIndexing ? 'indexing' : update.status,
				pageCount: update.pageCount,
				nextPage: update.nextPage,
				characterCount: update.characterCount,
				errorMessage: null,
				userId
			};
			store.set(update.materialId, next);
			return next;
		},
		async setStatus(userId, materialId, _courseId, status, opts = {}) {
			const current = store.get(materialId) ?? makeRecord({ materialId, userId });
			const next: OwnedRecord = {
				...current,
				status,
				pageCount: opts.pageCount ?? current.pageCount,
				errorMessage: opts.errorMessage ?? null,
				userId
			};
			store.set(materialId, next);
			return next;
		},
		async delete(_userId, materialId) {
			store.delete(materialId);
		}
	};

	return { repository, store, saves };
}

const encoder = new TextEncoder();

describe('runBackgroundIndexing', () => {
	it('indexes a pending text material to ready in one batch', async () => {
		const { repository, store } = createFakeRepository([makeRecord()]);
		const summary = await runBackgroundIndexing({
			repository,
			load: async () => ({
				material: makeMaterial(),
				bytes: encoder.encode('linux event logging notes')
			})
		});

		expect(summary).toEqual({ attempted: 1, batches: 1, ready: 1, failed: 0, skipped: 0 });
		const record = store.get('material-1');
		expect(record?.status).toBe('ready');
		expect(record?.characterCount).toBeGreaterThan(0);
	});

	it('skips materials whose files are missing', async () => {
		const { repository, store } = createFakeRepository([makeRecord()]);
		const summary = await runBackgroundIndexing({ repository, load: async () => null });

		expect(summary).toEqual({ attempted: 1, batches: 0, ready: 0, failed: 0, skipped: 1 });
		expect(store.get('material-1')?.status).toBe('pending');
	});

	it('marks materials failed when extraction throws', async () => {
		const { repository, store } = createFakeRepository([
			makeRecord({ materialId: 'bad-pdf', nextPage: 1 })
		]);
		const summary = await runBackgroundIndexing({
			repository,
			load: async () => ({
				material: makeMaterial({
					id: 'bad-pdf',
					fileName: 'scan.pdf',
					mimeType: 'application/pdf'
				}),
				bytes: encoder.encode('this is not a pdf')
			})
		});

		expect(summary.attempted).toBe(1);
		expect(summary.failed).toBe(1);
		expect(summary.ready).toBe(0);
		const record = store.get('bad-pdf');
		expect(record?.status).toBe('failed');
		expect(record?.errorMessage).toBeTruthy();
	});

	it('stops after maxBatchesPerMaterial when a document stays indexing', async () => {
		const { repository } = createFakeRepository([makeRecord()], { forceIndexing: true });
		let pageCount = 0;
		const summary = await runBackgroundIndexing({
			repository,
			maxBatchesPerMaterial: 2,
			load: async () => {
				pageCount += 1;
				return { material: makeMaterial(), bytes: encoder.encode(`batch ${pageCount}`) };
			}
		});

		expect(summary.batches).toBe(2);
		expect(summary.ready).toBe(0);
		expect(summary.failed).toBe(0);
	});

	it('respects the maxMaterials bound from listIndexable', async () => {
		const { repository } = createFakeRepository([
			makeRecord({ materialId: 'a' }),
			makeRecord({ materialId: 'b' }),
			makeRecord({ materialId: 'c' })
		]);
		const summary = await runBackgroundIndexing({
			repository,
			maxMaterials: 2,
			load: async () => ({ material: makeMaterial(), bytes: encoder.encode('text') })
		});

		expect(summary.attempted).toBe(2);
	});

	it('keeps the checkpoint when the failure status update itself fails', async () => {
		const { repository, store } = createFakeRepository([makeRecord({ materialId: 'boom' })]);
		const originalSetStatus = repository.setStatus.bind(repository);
		let setStatusCalls = 0;
		repository.setStatus = async (userId, materialId, courseId, status, opts) => {
			setStatusCalls += 1;
			if (status === 'failed') throw new Error('db write failed');
			return originalSetStatus(userId, materialId, courseId, status as MaterialIndexStatus, opts);
		};

		const summary = await runBackgroundIndexing({
			repository,
			load: async () => ({
				material: makeMaterial({ id: 'boom', fileName: 'scan.pdf', mimeType: 'application/pdf' }),
				bytes: encoder.encode('still not a pdf')
			})
		});

		expect(summary.failed).toBe(1);
		expect(setStatusCalls).toBeGreaterThan(1);
		expect(store.get('boom')?.status).toBe('indexing');
	});
});
