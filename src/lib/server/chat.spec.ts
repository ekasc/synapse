import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCourses, listMaterials, listMaterialsFallback, listReadyChunks, fallbackReadyChunks } =
	vi.hoisted(() => ({
		getCourses: vi.fn(),
		listMaterials: vi.fn(),
		listMaterialsFallback: vi.fn(),
		listReadyChunks: vi.fn(),
		fallbackReadyChunks: vi.fn()
	}));

vi.mock('$lib/server/store', () => ({ getCourses }));
vi.mock('$lib/server/r2', () => ({ listMaterials, listMaterialsFallback }));
vi.mock('$lib/server/practice/material-index', () => ({
	createMaterialIndexRepository: (binding?: D1Database) => ({
		listReadyChunks: binding ? listReadyChunks : fallbackReadyChunks
	})
}));
vi.mock('$lib/server/practice/retrieval', () => ({
	selectIndexedChunks: () => [],
	indexedChunksToContext: () => []
}));

import { answerChat, removeSourceIds } from './chat';

describe('answerChat Worker storage fallbacks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCourses.mockResolvedValue([
			{
				id: 'course-1',
				userId: 'user-1',
				semesterId: 'semester-1',
				code: 'CSIS 1115',
				name: 'Programming',
				instructor: '',
				credits: 3
			}
		]);
		listReadyChunks.mockRejectedValue(new Error('index unavailable'));
		listMaterials.mockResolvedValue([]);
	});

	it('does not access filesystem fallbacks when Worker bindings exist', async () => {
		const result = await answerChat(
			{ question: 'How many courses?', courseId: 'all' },
			{
				userId: 'user-1',
				db: {} as D1Database,
				materials: {} as R2Bucket
			}
		);

		expect(result.answer).toContain('could not find indexed material');
		expect(fallbackReadyChunks).not.toHaveBeenCalled();
		expect(listMaterialsFallback).not.toHaveBeenCalled();
	});
});

describe('removeSourceIds', () => {
	it('removes internal citation IDs without changing the answer', () => {
		expect(
			removeSourceIds('You have 15 courses [course-course-1].', [
				{
					id: 'course-course-1',
					label: 'Course record',
					detail: 'catalog record',
					excerpt: '',
					courseId: 'course-1'
				}
			])
		).toBe('You have 15 courses.');
	});
});
