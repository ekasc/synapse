import {
	applyPlanningMove,
	createPlanningScenario,
	type PlanningMove,
	type PlanningScenario
} from './planning';
import type { MapCourse, MapRelation, MapSemester } from './types';

export const MAX_ENCODED_PLAN_LENGTH = 4096;
export const MAX_SHARED_MOVES = 50;
export const MAX_SHARED_ID_LENGTH = 128;

export type SharedPlanningPayloadV1 = {
	version: 1;
	moves: Array<{ courseId: string; targetSemesterId: string }>;
};

export type SharedScenarioInvalidReason =
	| 'too-long'
	| 'malformed-encoding'
	| 'invalid-json'
	| 'unsupported-version'
	| 'invalid-shape'
	| 'too-many-moves'
	| 'invalid-id';

export type EncodeSharedScenarioResult =
	| { status: 'valid'; value: string; payload: SharedPlanningPayloadV1 }
	| { status: 'invalid'; reason: SharedScenarioInvalidReason };

export type DecodeSharedScenarioResult =
	| { status: 'valid'; payload: SharedPlanningPayloadV1 }
	| { status: 'absent' }
	| { status: 'invalid'; reason: SharedScenarioInvalidReason };

export type SharedMoveReplayEntry = {
	index: number;
	courseId: string;
	targetSemesterId: string;
	status:
		| 'applied'
		| 'skipped-course-missing'
		| 'skipped-semester-missing'
		| 'skipped-target-unplaced'
		| 'skipped-no-op'
		| 'skipped-invalid-input';
	reason?: string;
};

export type SharedScenarioReplayResult = {
	scenario: PlanningScenario;
	entries: SharedMoveReplayEntry[];
	appliedCount: number;
	skippedCount: number;
};

export type SharedScenarioSourceState =
	| { status: 'none' }
	| { status: 'invalid'; reason: SharedScenarioInvalidReason }
	| { status: 'loaded'; replay: SharedScenarioReplayResult; modified: boolean };

function base64UrlEncode(value: string) {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string) {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
	const padding = '='.repeat((4 - (value.length % 4)) % 4);
	const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function validateId(value: unknown) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_SHARED_ID_LENGTH) return null;
	return trimmed;
}

function validateMoves(
	value: unknown
):
	| { status: 'valid'; moves: SharedPlanningPayloadV1['moves'] }
	| { status: 'invalid'; reason: SharedScenarioInvalidReason } {
	if (!Array.isArray(value)) return { status: 'invalid', reason: 'invalid-shape' };
	if (value.length > MAX_SHARED_MOVES) return { status: 'invalid', reason: 'too-many-moves' };
	const moves: SharedPlanningPayloadV1['moves'] = [];
	for (const move of value) {
		if (!move || typeof move !== 'object' || Array.isArray(move)) {
			return { status: 'invalid', reason: 'invalid-shape' };
		}
		const record = move as Record<string, unknown>;
		const courseId = validateId(record.courseId);
		const targetSemesterId = validateId(record.targetSemesterId);
		if (!courseId || !targetSemesterId) return { status: 'invalid', reason: 'invalid-id' };
		moves.push({ courseId, targetSemesterId });
	}
	return { status: 'valid', moves };
}

export function encodeSharedScenario(moves: PlanningMove[]): EncodeSharedScenarioResult {
	const validated = validateMoves(
		moves.map((move) => ({ courseId: move.courseId, targetSemesterId: move.targetSemesterId }))
	);
	if (validated.status === 'invalid') return validated;
	const canonicalMoves = validated.moves.filter(
		(_, index) => moves[index].fromSemesterId !== moves[index].targetSemesterId
	);
	const payload: SharedPlanningPayloadV1 = { version: 1, moves: canonicalMoves };
	const value = `v1.${base64UrlEncode(JSON.stringify(payload))}`;
	if (value.length > MAX_ENCODED_PLAN_LENGTH) return { status: 'invalid', reason: 'too-long' };
	return { status: 'valid', value, payload };
}

export function decodeSharedScenario(value: string | null): DecodeSharedScenarioResult {
	if (value === null || value === '') return { status: 'absent' };
	if (value.length > MAX_ENCODED_PLAN_LENGTH) return { status: 'invalid', reason: 'too-long' };
	const separator = value.indexOf('.');
	if (separator < 1) return { status: 'invalid', reason: 'malformed-encoding' };
	if (value.slice(0, separator) !== 'v1')
		return { status: 'invalid', reason: 'unsupported-version' };
	let decoded: string;
	try {
		decoded = base64UrlDecode(value.slice(separator + 1));
	} catch {
		return { status: 'invalid', reason: 'malformed-encoding' };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(decoded);
	} catch {
		return { status: 'invalid', reason: 'invalid-json' };
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { status: 'invalid', reason: 'invalid-shape' };
	}
	const record = parsed as Record<string, unknown>;
	if (record.version !== 1) {
		return {
			status: 'invalid',
			reason: typeof record.version === 'number' ? 'unsupported-version' : 'invalid-shape'
		};
	}
	const validated = validateMoves(record.moves);
	if (validated.status === 'invalid') return validated;
	return { status: 'valid', payload: { version: 1, moves: validated.moves } };
}

export function replaySharedScenario(
	payload: SharedPlanningPayloadV1,
	baselineCourses: MapCourse[],
	semesters: MapSemester[],
	relations: MapRelation[]
): SharedScenarioReplayResult {
	let scenario = createPlanningScenario(baselineCourses, semesters, relations);
	const entries: SharedMoveReplayEntry[] = [];
	for (const [index, move] of payload.moves.entries()) {
		const course = scenario.currentCourses.find((item) => item.id === move.courseId);
		let status: SharedMoveReplayEntry['status'];
		let reason: string | undefined;
		if (!course) {
			status = 'skipped-course-missing';
		} else if (move.targetSemesterId === '__unplaced__') {
			status = 'skipped-target-unplaced';
		} else if (!semesters.some((semester) => semester.id === move.targetSemesterId)) {
			status = 'skipped-semester-missing';
		} else if (course.semesterId === move.targetSemesterId) {
			status = 'skipped-no-op';
		} else {
			const applied = applyPlanningMove(
				scenario,
				move.courseId,
				move.targetSemesterId,
				semesters,
				relations
			);
			if (applied.result.status === 'valid' || applied.result.status === 'invalid') {
				scenario = applied.scenario;
				status = 'applied';
			} else {
				status = 'skipped-invalid-input';
				reason = applied.result.status;
			}
		}
		entries.push({ index, ...move, status, ...(reason ? { reason } : {}) });
	}
	const appliedCount = entries.filter((entry) => entry.status === 'applied').length;
	return { scenario, entries, appliedCount, skippedCount: entries.length - appliedCount };
}
