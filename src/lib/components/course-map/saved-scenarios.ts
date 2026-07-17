export type StoredMove = { courseId: string; targetSemesterId: string };

export type StoredScenario = {
	id: string;
	name: string;
	revision: number;
	createdAt: string;
	updatedAt: string;
	moves: StoredMove[];
};

export type SavedScenarioAssociation = {
	id: string;
	name: string;
	revision: number;
	lastSavedMoveSignature: string;
	lastSavedName: string;
};

export type ScenarioOperation =
	| 'list'
	| 'load'
	| 'create'
	| 'update'
	| 'rename'
	| 'duplicate'
	| 'delete'
	| 'recovery';

export type ScenarioOperationState =
	| { kind: 'idle' }
	| { kind: 'busy'; operation: ScenarioOperation; scenario: StoredScenario | null }
	| { kind: 'success'; operation: ScenarioOperation; message: string }
	| {
			kind: 'failure';
			operation: ScenarioOperation;
			scenario: StoredScenario | null;
			message: string;
			conflict: boolean;
	  };

export function beginScenarioOperation(
	operation: ScenarioOperation,
	scenario: StoredScenario | null = null
): ScenarioOperationState {
	return { kind: 'busy', operation, scenario };
}

export function clearScenarioOperation(): ScenarioOperationState {
	return { kind: 'idle' };
}

export function completeScenarioOperation(
	operation: ScenarioOperation,
	message: string
): ScenarioOperationState {
	return { kind: 'success', operation, message };
}

export function failScenarioOperation(
	operation: ScenarioOperation,
	scenario: StoredScenario | null,
	message: string,
	conflict: boolean
): ScenarioOperationState {
	return { kind: 'failure', operation, scenario, message, conflict };
}

export function orderedMoveSignature(moves: StoredMove[]) {
	return JSON.stringify(
		moves.map(({ courseId, targetSemesterId }) => [courseId, targetSemesterId])
	);
}

export function associateSavedScenario(scenario: StoredScenario): SavedScenarioAssociation {
	return {
		id: scenario.id,
		name: scenario.name,
		revision: scenario.revision,
		lastSavedMoveSignature: orderedMoveSignature(scenario.moves),
		lastSavedName: scenario.name
	};
}

export function isAssociationDirty(
	association: SavedScenarioAssociation | null,
	moves: StoredMove[]
) {
	return Boolean(
		association &&
		(association.name !== association.lastSavedName ||
			orderedMoveSignature(moves) !== association.lastSavedMoveSignature)
	);
}
