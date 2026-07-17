import { describe, expect, it } from 'vitest';
import { applyPlanningMove, createPlanningScenario } from './planning';
import {
	decodeSharedScenario,
	encodeSharedScenario,
	replaySharedScenario,
	type SharedPlanningPayloadV1
} from './sharing';
import type { MapCourse, MapRelation, MapSemester } from './types';

const semesters: MapSemester[] = [
	{ id: 's1', term: 'Fall', year: 2025, order: 1 },
	{ id: 's2', term: 'Winter', year: 2026, order: 2 },
	{ id: 's3', term: 'Fall', year: 2026, order: 3 },
	{ id: 's4', term: 'Winter', year: 2027, order: 4 }
];
const courses: MapCourse[] = [
	{ id: 'a', semesterId: 's1', code: 'A', name: 'A' },
	{ id: 'b', semesterId: 's2', code: 'B', name: 'B' },
	{ id: 'c', semesterId: 's3', code: 'C', name: 'C' }
];
const edge = (
	source: string,
	target: string,
	overrides: Partial<MapRelation> = {}
): MapRelation => ({
	id: `${source}-${target}`,
	source,
	target,
	type: 'prereq',
	...overrides
});
const relations = [edge('a', 'b'), edge('b', 'c')];
const move = (courseId = 'b', targetSemesterId = 's3') => ({
	id: 'move-1',
	courseId,
	fromSemesterId: 's2',
	targetSemesterId
});
const payload = (moves: SharedPlanningPayloadV1['moves']): SharedPlanningPayloadV1 => ({
	version: 1,
	moves
});
const encodedJson = (value: unknown, prefix = 'v1') =>
	`${prefix}.${btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;

describe('shared scenario encoding and decoding', () => {
	it('round trips an empty scenario', () => {
		const encoded = encodeSharedScenario([]);
		expect(encoded.status).toBe('valid');
		if (encoded.status === 'valid')
			expect(decodeSharedScenario(encoded.value)).toEqual({
				status: 'valid',
				payload: payload([])
			});
	});
	it('round trips one move', () => {
		const encoded = encodeSharedScenario([move()]);
		if (encoded.status === 'valid')
			expect(decodeSharedScenario(encoded.value)).toMatchObject({
				status: 'valid',
				payload: { moves: [{ courseId: 'b', targetSemesterId: 's3' }] }
			});
	});
	it('round trips multiple ordered moves', () => {
		const encoded = encodeSharedScenario([
			{ ...move('a', 's2'), fromSemesterId: 's1' },
			{ ...move('b', 's4'), id: 'move-2' }
		]);
		if (encoded.status === 'valid')
			expect(decodeSharedScenario(encoded.value)).toMatchObject({
				status: 'valid',
				payload: { moves: [{ courseId: 'a' }, { courseId: 'b' }] }
			});
	});
	it('encodes identical input deterministically', () =>
		expect(encodeSharedScenario([move()])).toEqual(encodeSharedScenario([move()])));
	it('preserves move order', () => {
		const result = encodeSharedScenario([move('b', 's4'), { ...move('a', 's3'), id: 'move-2' }]);
		if (result.status === 'valid')
			expect(result.payload.moves.map((item) => item.courseId)).toEqual(['b', 'a']);
	});
	it('supports special characters in IDs', () => {
		const result = encodeSharedScenario([move('course/é ?', 'term:#1')]);
		if (result.status === 'valid')
			expect(decodeSharedScenario(result.value)).toMatchObject({
				status: 'valid',
				payload: { moves: [{ courseId: 'course/é ?', targetSemesterId: 'term:#1' }] }
			});
	});
	it('rejects an empty course ID', () =>
		expect(encodeSharedScenario([move(' ', 's2')])).toEqual({
			status: 'invalid',
			reason: 'invalid-id'
		}));
	it('rejects an empty semester ID', () =>
		expect(encodeSharedScenario([move('a', ' ')])).toEqual({
			status: 'invalid',
			reason: 'invalid-id'
		}));
	it('rejects an oversized course ID', () =>
		expect(encodeSharedScenario([move('a'.repeat(129), 's2')])).toEqual({
			status: 'invalid',
			reason: 'invalid-id'
		}));
	it('rejects an oversized semester ID', () =>
		expect(encodeSharedScenario([move('a', 's'.repeat(129))])).toEqual({
			status: 'invalid',
			reason: 'invalid-id'
		}));
	it('rejects more than 50 moves', () =>
		expect(
			encodeSharedScenario(
				Array.from({ length: 51 }, (_, index) => ({
					...move(`a${index}`, 's2'),
					id: `move-${index}`
				}))
			)
		).toEqual({ status: 'invalid', reason: 'too-many-moves' }));
	it('rejects parameters longer than 4096 characters', () =>
		expect(decodeSharedScenario(`v1.${'a'.repeat(4094)}`)).toEqual({
			status: 'invalid',
			reason: 'too-long'
		}));
	it('rejects malformed base64url', () =>
		expect(decodeSharedScenario('v1.***')).toEqual({
			status: 'invalid',
			reason: 'malformed-encoding'
		}));
	it('rejects encoded invalid JSON', () =>
		expect(decodeSharedScenario(`v1.${btoa('not-json').replace(/=+$/, '')}`)).toEqual({
			status: 'invalid',
			reason: 'invalid-json'
		}));
	it('rejects unsupported versions', () =>
		expect(decodeSharedScenario(encodedJson({ version: 2, moves: [] }, 'v2'))).toEqual({
			status: 'invalid',
			reason: 'unsupported-version'
		}));
	it('rejects a missing version', () =>
		expect(decodeSharedScenario(encodedJson({ moves: [] }))).toEqual({
			status: 'invalid',
			reason: 'invalid-shape'
		}));
	it('rejects missing moves', () =>
		expect(decodeSharedScenario(encodedJson({ version: 1 }))).toEqual({
			status: 'invalid',
			reason: 'invalid-shape'
		}));
	it('rejects non-array moves', () =>
		expect(decodeSharedScenario(encodedJson({ version: 1, moves: {} }))).toEqual({
			status: 'invalid',
			reason: 'invalid-shape'
		}));
	it('rejects non-object moves', () =>
		expect(decodeSharedScenario(encodedJson({ version: 1, moves: ['a'] }))).toEqual({
			status: 'invalid',
			reason: 'invalid-shape'
		}));
	it('rejects non-string IDs', () =>
		expect(
			decodeSharedScenario(
				encodedJson({ version: 1, moves: [{ courseId: 1, targetSemesterId: 's2' }] })
			)
		).toEqual({ status: 'invalid', reason: 'invalid-id' }));
	it('does not trust unknown extra fields', () => {
		const result = decodeSharedScenario(
			encodedJson({
				version: 1,
				admin: true,
				moves: [{ courseId: 'a', targetSemesterId: 's2', conflict: true }]
			})
		);
		expect(result).toEqual({
			status: 'valid',
			payload: payload([{ courseId: 'a', targetSemesterId: 's2' }])
		});
	});
	it('never throws for arbitrary decoder input', () => {
		for (const value of [null, '', '.', 'v1.', '%%%%', 'v999.x', 'v1.__proto__'])
			expect(() => decodeSharedScenario(value)).not.toThrow();
	});
});

describe('shared scenario replay', () => {
	it('applies one valid move', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'b', targetSemesterId: 's3' }]),
				courses,
				semesters,
				relations
			)
		).toMatchObject({ appliedCount: 1, skippedCount: 0 }));
	it('applies two cumulative moves in order', () => {
		const result = replaySharedScenario(
			payload([
				{ courseId: 'b', targetSemesterId: 's3' },
				{ courseId: 'c', targetSemesterId: 's4' }
			]),
			courses,
			semesters,
			relations
		);
		expect(result.scenario.moves.map((item) => item.courseId)).toEqual(['b', 'c']);
	});
	it('skips a missing course', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'missing', targetSemesterId: 's2' }]),
				courses,
				semesters,
				relations
			).entries[0].status
		).toBe('skipped-course-missing'));
	it('skips a missing semester', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'a', targetSemesterId: 'missing' }]),
				courses,
				semesters,
				relations
			).entries[0].status
		).toBe('skipped-semester-missing'));
	it('skips an Unplaced target', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'a', targetSemesterId: '__unplaced__' }]),
				courses,
				semesters,
				relations
			).entries[0].status
		).toBe('skipped-target-unplaced'));
	it('skips a no-op move', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'a', targetSemesterId: 's1' }]),
				courses,
				semesters,
				relations
			).entries[0].status
		).toBe('skipped-no-op'));
	it('continues valid moves after an invalid move', () =>
		expect(
			replaySharedScenario(
				payload([
					{ courseId: 'missing', targetSemesterId: 's2' },
					{ courseId: 'b', targetSemesterId: 's3' }
				]),
				courses,
				semesters,
				relations
			)
		).toMatchObject({ appliedCount: 1, skippedCount: 1 }));
	it('replays repeated moves for one course deterministically', () => {
		const result = replaySharedScenario(
			payload([
				{ courseId: 'b', targetSemesterId: 's3' },
				{ courseId: 'b', targetSemesterId: 's4' }
			]),
			courses,
			semesters,
			relations
		);
		expect(result.scenario.currentCourses.find((item) => item.id === 'b')?.semesterId).toBe('s4');
	});
	it('uses current simulated state for later moves', () => {
		const result = replaySharedScenario(
			payload([
				{ courseId: 'b', targetSemesterId: 's3' },
				{ courseId: 'b', targetSemesterId: 's3' }
			]),
			courses,
			semesters,
			relations
		);
		expect(result.entries.map((entry) => entry.status)).toEqual(['applied', 'skipped-no-op']);
	});
	it('matches manual scenario application', () => {
		let manual = createPlanningScenario(courses, semesters, relations);
		manual = applyPlanningMove(manual, 'b', 's3', semesters, relations).scenario;
		manual = applyPlanningMove(manual, 'c', 's4', semesters, relations).scenario;
		expect(
			replaySharedScenario(
				payload([
					{ courseId: 'b', targetSemesterId: 's3' },
					{ courseId: 'c', targetSemesterId: 's4' }
				]),
				courses,
				semesters,
				relations
			).scenario
		).toEqual(manual);
	});
	it('preserves baseline immutability', () => {
		const input = structuredClone(courses);
		const snapshot = structuredClone(input);
		replaySharedScenario(
			payload([{ courseId: 'b', targetSemesterId: 's3' }]),
			input,
			semesters,
			relations
		);
		expect(input).toEqual(snapshot);
	});
	it('is deterministic', () => {
		const shared = payload([{ courseId: 'b', targetSemesterId: 's3' }]);
		expect(replaySharedScenario(shared, courses, semesters, relations)).toEqual(
			replaySharedScenario(shared, courses, semesters, relations)
		);
	});
	it('keeps pending relations ignored', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'b', targetSemesterId: 's1' }]),
				courses,
				semesters,
				[edge('a', 'b', { reviewStatus: 'pending' })]
			).appliedCount
		).toBe(1));
	it('keeps rejected relations ignored', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'b', targetSemesterId: 's1' }]),
				courses,
				semesters,
				[edge('a', 'b', { reviewStatus: 'rejected' })]
			).appliedCount
		).toBe(1));
	it('deduplicates accepted relations', () => {
		const result = replaySharedScenario(
			payload([{ courseId: 'b', targetSemesterId: 's1' }]),
			courses,
			semesters,
			[edge('a', 'b'), edge('a', 'b', { id: 'copy' })]
		);
		expect(result.scenario.comparison.newConflicts).toHaveLength(1);
	});
	it('does not crash on cyclic graph data', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'b', targetSemesterId: 's3' }]),
				courses,
				semesters,
				[edge('a', 'b'), edge('b', 'a')]
			)
		).toMatchObject({ appliedCount: 0, skippedCount: 1 }));
	it('does not crash on missing prerequisite data', () =>
		expect(
			replaySharedScenario(
				payload([{ courseId: 'b', targetSemesterId: 's3' }]),
				courses,
				semesters,
				[edge('missing', 'b')]
			)
		).toMatchObject({ appliedCount: 0, skippedCount: 1 }));
	it('returns an empty scenario for an empty move list', () =>
		expect(replaySharedScenario(payload([]), courses, semesters, relations)).toMatchObject({
			appliedCount: 0,
			skippedCount: 0,
			scenario: { moves: [] }
		}));
});
