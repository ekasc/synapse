import { describe, expect, it, vi } from 'vitest';
import { createPlanningScenarioRepository } from './planning-scenarios';

function mockBinding(options?: {
	batchChanges?: number;
	firstResults?: unknown[];
	allResults?: unknown[][];
}) {
	const statements: Array<{ sql: string; values: unknown[] }> = [];
	const firstResults = [...(options?.firstResults ?? [])];
	const allResults = [...(options?.allResults ?? [])];
	const prepare = vi.fn((sql: string) => {
		const statement = {
			sql,
			values: [] as unknown[],
			bind(...values: unknown[]) {
				statement.values = values;
				return statement;
			},
			async first() {
				return firstResults.shift() ?? null;
			},
			async all() {
				return { results: allResults.shift() ?? [] };
			},
			async run() {
				return { meta: { changes: options?.batchChanges ?? 1 } };
			}
		};
		statements.push(statement);
		return statement;
	});
	const batch = vi.fn(async (items: Array<{ sql: string; values: unknown[] }>) =>
		items.map((item, index) => ({
			meta: { changes: index === items.length - 1 ? (options?.batchChanges ?? 1) : 1 },
			item
		}))
	);
	return {
		binding: { prepare, batch } as unknown as D1Database,
		prepare,
		batch,
		statements
	};
}

const validMoves = [{ courseId: ' CSIS-2200 ', targetSemesterId: ' fall-2026 ' }];

describe('planning scenario validation', () => {
	it.each([
		[null, 'plain object'],
		[[], 'plain object'],
		[{ name: '   ', moves: validMoves }, 'name'],
		[{ name: 'x'.repeat(81), moves: validMoves }, 'name'],
		[{ name: 'Plan', moves: [] }, 'moves'],
		[{ name: 'Plan', moves: Array.from({ length: 51 }, () => validMoves[0]) }, 'moves'],
		[{ name: 'Plan', moves: [new (class Move {})()] }, 'plain object'],
		[{ name: 'Plan', moves: [{ courseId: ' ', targetSemesterId: 'term' }] }, 'courseId'],
		[
			{ name: 'Plan', moves: [{ courseId: 'course', targetSemesterId: 'x'.repeat(129) }] },
			'targetSemesterId'
		],
		[{ name: 'Plan', moves: validMoves, extra: true }, 'unsupported']
	])('rejects invalid create input %#', async (input, message) => {
		const mock = mockBinding();
		const result = await createPlanningScenarioRepository(mock.binding).create(input);
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain(message);
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it.each([0, 1.5, '1', null])(
		'rejects invalid revision %s before update SQL',
		async (revision) => {
			const mock = mockBinding();
			const result = await createPlanningScenarioRepository(mock.binding).update('scenario', {
				name: 'Plan',
				moves: validMoves,
				revision
			});
			expect(result).toMatchObject({ outcome: 'validation' });
			expect(mock.prepare).not.toHaveBeenCalled();
		}
	);
});

describe('planning scenario persistence contracts', () => {
	it('trims input, assigns server fields, and batches ordered moves', async () => {
		const mock = mockBinding();
		const result = await createPlanningScenarioRepository(mock.binding).create({
			name: '  Graduation plan  ',
			moves: [...validMoves, { courseId: 'CSIS-3300', targetSemesterId: 'spring-2027' }]
		});

		expect(result.outcome).toBe('ok');
		if (result.outcome !== 'ok') return;
		expect(result.value.name).toBe('Graduation plan');
		expect(result.value.revision).toBe(1);
		expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/i);
		expect(Number.isNaN(Date.parse(result.value.createdAt))).toBe(false);
		expect(result.value.moves[0]).toEqual({
			courseId: 'CSIS-2200',
			targetSemesterId: 'fall-2026'
		});
		expect(mock.batch).toHaveBeenCalledOnce();
		expect(mock.statements[1].values.slice(1)).toEqual([0, 'CSIS-2200', 'fall-2026']);
		expect(mock.statements[2].values.slice(1)).toEqual([1, 'CSIS-3300', 'spring-2027']);
	});

	it('guards the scenario, move deletion, and every move insert by revision in one batch', async () => {
		const mock = mockBinding({
			firstResults: [{ created_at: '2026-01-01T00:00:00.000Z' }]
		});
		const result = await createPlanningScenarioRepository(mock.binding).update(' scenario-1 ', {
			name: ' Revised ',
			moves: [
				{ courseId: 'course-1', targetSemesterId: 'term-1' },
				{ courseId: 'course-2', targetSemesterId: 'term-2' }
			],
			revision: 3
		});

		expect(result).toMatchObject({ outcome: 'ok', value: { id: 'scenario-1', revision: 4 } });
		expect(mock.batch).toHaveBeenCalledOnce();
		const batched = mock.batch.mock.calls[0][0];
		expect(batched).toHaveLength(4);
		for (const statement of batched) {
			expect(statement.sql).toContain('revision = ?');
			expect(statement.values.at(-1)).toBe(3);
		}
		expect(batched.at(-1)?.sql).toContain('WHERE id = ? AND revision = ?');
		expect(batched.at(-1)?.values.slice(-2)).toEqual(['scenario-1', 3]);
	});

	it('distinguishes update conflicts from missing scenarios', async () => {
		const conflict = mockBinding({ batchChanges: 0, firstResults: [{ found: 1 }] });
		const missing = mockBinding({ batchChanges: 0, firstResults: [null] });
		const input = { name: 'Plan', moves: validMoves, revision: 2 };

		expect(await createPlanningScenarioRepository(conflict.binding).update('id', input)).toEqual({
			outcome: 'conflict'
		});
		expect(await createPlanningScenarioRepository(missing.binding).update('id', input)).toEqual({
			outcome: 'not-found'
		});
	});

	it('lists scenarios with moves in persisted order', async () => {
		const mock = mockBinding({
			allResults: [
				[
					{
						id: 's1',
						name: 'Plan',
						revision: 2,
						created_at: 'created',
						updated_at: 'updated'
					}
				],
				[
					{
						scenario_id: 's1',
						move_order: 0,
						course_id: 'c1',
						target_semester_id: 't1'
					}
				]
			]
		});
		const result = await createPlanningScenarioRepository(mock.binding).list();
		expect(result).toEqual({
			outcome: 'ok',
			value: [
				{
					id: 's1',
					name: 'Plan',
					revision: 2,
					createdAt: 'created',
					updatedAt: 'updated',
					moves: [{ courseId: 'c1', targetSemesterId: 't1' }]
				}
			]
		});
	});
});
