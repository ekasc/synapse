import { describe, expect, it } from 'vitest';
import {
	associateSavedScenario,
	beginScenarioOperation,
	completeScenarioOperation,
	failScenarioOperation,
	isAssociationDirty,
	orderedMoveSignature,
	type StoredScenario
} from './saved-scenarios';

const stored: StoredScenario = {
	id: 'plan-1',
	name: 'Primary plan',
	revision: 3,
	createdAt: '2026-01-01',
	updatedAt: '2026-01-02',
	moves: [
		{ courseId: 'cs-1', targetSemesterId: 'fall' },
		{ courseId: 'cs-1', targetSemesterId: 'winter' }
	]
};

describe('saved scenario identity', () => {
	it('uses an ordered signature that preserves repeated same-course moves', () => {
		expect(orderedMoveSignature(stored.moves)).not.toBe(
			orderedMoveSignature([...stored.moves].reverse())
		);
		expect(JSON.parse(orderedMoveSignature(stored.moves))).toHaveLength(2);
	});

	it('tracks id, name, revision, and both last-saved values in one association', () => {
		expect(associateSavedScenario(stored)).toEqual({
			id: 'plan-1',
			name: 'Primary plan',
			revision: 3,
			lastSavedMoveSignature: orderedMoveSignature(stored.moves),
			lastSavedName: 'Primary plan'
		});
	});

	it('is dirty for either ordered move changes or a changed associated name', () => {
		const association = associateSavedScenario(stored);
		expect(isAssociationDirty(association, stored.moves)).toBe(false);
		expect(isAssociationDirty({ ...association, name: 'Renamed locally' }, stored.moves)).toBe(
			true
		);
		expect(isAssociationDirty(association, [...stored.moves].reverse())).toBe(true);
	});
});

describe('saved scenario operation state', () => {
	it('replaces prior feedback whenever an operation starts', () => {
		const success = completeScenarioOperation('duplicate', 'Scenario duplicated');
		expect(success.kind).toBe('success');
		expect(beginScenarioOperation('rename', stored)).toEqual({
			kind: 'busy',
			operation: 'rename',
			scenario: stored
		});
		expect(beginScenarioOperation('list')).toEqual({
			kind: 'busy',
			operation: 'list',
			scenario: null
		});
	});

	it('preserves the exact conflict target and lets failures replace success', () => {
		const conflict = failScenarioOperation('rename', stored, 'Could not rename scenario.', true);
		expect(conflict).toMatchObject({ kind: 'failure', scenario: stored, conflict: true });
		expect(failScenarioOperation('delete', stored, 'Could not delete scenario.', false)).toEqual({
			kind: 'failure',
			operation: 'delete',
			scenario: stored,
			message: 'Could not delete scenario.',
			conflict: false
		});
	});
});
