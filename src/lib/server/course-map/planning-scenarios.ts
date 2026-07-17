export type PlanningScenarioMove = {
	courseId: string;
	targetSemesterId: string;
};

export type PlanningScenario = {
	id: string;
	name: string;
	revision: number;
	createdAt: string;
	updatedAt: string;
	moves: PlanningScenarioMove[];
};

export type ScenarioResult<T> =
	| { outcome: 'ok'; value: T }
	| { outcome: 'validation'; message: string }
	| { outcome: 'not-found' }
	| { outcome: 'conflict' };

type ScenarioRow = {
	id: string;
	name: string;
	revision: number;
	created_at: string;
	updated_at: string;
};

type MoveRow = {
	scenario_id: string;
	move_order: number;
	course_id: string;
	target_semester_id: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function validateId(value: unknown, field = 'id'): ScenarioResult<string> {
	if (typeof value !== 'string')
		return { outcome: 'validation', message: `${field} must be a string` };
	const id = value.trim();
	if (id.length < 1 || id.length > 128)
		return { outcome: 'validation', message: `${field} must be 1 to 128 characters` };
	return { outcome: 'ok', value: id };
}

function validateName(value: unknown): ScenarioResult<string> {
	if (typeof value !== 'string') return { outcome: 'validation', message: 'name must be a string' };
	const name = value.trim();
	if (name.length < 1 || name.length > 80)
		return { outcome: 'validation', message: 'name must be 1 to 80 characters' };
	return { outcome: 'ok', value: name };
}

function validateRevision(value: unknown): ScenarioResult<number> {
	if (!Number.isInteger(value) || (value as number) < 1)
		return { outcome: 'validation', message: 'revision must be an integer of at least 1' };
	return { outcome: 'ok', value: value as number };
}

function validateMoves(value: unknown): ScenarioResult<PlanningScenarioMove[]> {
	if (!Array.isArray(value) || value.length < 1 || value.length > 50)
		return { outcome: 'validation', message: 'moves must contain 1 to 50 entries' };

	const moves: PlanningScenarioMove[] = [];
	for (const entry of value) {
		if (!isPlainObject(entry))
			return { outcome: 'validation', message: 'each move must be a plain object' };
		if (Object.keys(entry).some((key) => key !== 'courseId' && key !== 'targetSemesterId'))
			return { outcome: 'validation', message: 'move contains unsupported fields' };
		const courseId = validateId(entry.courseId, 'courseId');
		if (courseId.outcome !== 'ok') return courseId;
		const targetSemesterId = validateId(entry.targetSemesterId, 'targetSemesterId');
		if (targetSemesterId.outcome !== 'ok') return targetSemesterId;
		moves.push({ courseId: courseId.value, targetSemesterId: targetSemesterId.value });
	}
	return { outcome: 'ok', value: moves };
}

function validateObject(value: unknown, fields: string[]): ScenarioResult<Record<string, unknown>> {
	if (!isPlainObject(value))
		return { outcome: 'validation', message: 'request must be a plain object' };
	if (Object.keys(value).some((key) => !fields.includes(key)))
		return { outcome: 'validation', message: 'request contains unsupported fields' };
	return { outcome: 'ok', value };
}

function mapScenario(row: ScenarioRow, moves: MoveRow[]): PlanningScenario {
	return {
		id: row.id,
		name: row.name,
		revision: row.revision,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		moves: moves.map((move) => ({
			courseId: move.course_id,
			targetSemesterId: move.target_semester_id
		}))
	};
}

export function createPlanningScenarioRepository(binding: D1Database) {
	async function readMoves(ids?: string[]): Promise<MoveRow[]> {
		if (ids && ids.length === 0) return [];
		const statement = ids
			? binding
					.prepare(
						`SELECT scenario_id, move_order, course_id, target_semester_id
						 FROM planning_scenario_moves WHERE scenario_id IN (${ids.map(() => '?').join(', ')})
						 ORDER BY scenario_id, move_order`
					)
					.bind(...ids)
			: binding.prepare(
					`SELECT scenario_id, move_order, course_id, target_semester_id
					 FROM planning_scenario_moves ORDER BY scenario_id, move_order`
				);
		return (await statement.all<MoveRow>()).results;
	}

	async function list(): Promise<ScenarioResult<PlanningScenario[]>> {
		const rows = (
			await binding
				.prepare(
					`SELECT id, name, revision, created_at, updated_at
					 FROM planning_scenarios ORDER BY updated_at DESC, id`
				)
				.all<ScenarioRow>()
		).results;
		const moves = await readMoves(rows.map((row) => row.id));
		return {
			outcome: 'ok',
			value: rows.map((row) =>
				mapScenario(
					row,
					moves.filter((move) => move.scenario_id === row.id)
				)
			)
		};
	}

	async function get(idInput: unknown): Promise<ScenarioResult<PlanningScenario>> {
		const id = validateId(idInput);
		if (id.outcome !== 'ok') return id;
		const row = await binding
			.prepare(
				`SELECT id, name, revision, created_at, updated_at FROM planning_scenarios WHERE id = ?`
			)
			.bind(id.value)
			.first<ScenarioRow>();
		if (!row) return { outcome: 'not-found' };
		return { outcome: 'ok', value: mapScenario(row, await readMoves([id.value])) };
	}

	async function create(input: unknown): Promise<ScenarioResult<PlanningScenario>> {
		const object = validateObject(input, ['name', 'moves']);
		if (object.outcome !== 'ok') return object;
		const name = validateName(object.value.name);
		if (name.outcome !== 'ok') return name;
		const moves = validateMoves(object.value.moves);
		if (moves.outcome !== 'ok') return moves;

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const statements = [
			binding
				.prepare(
					`INSERT INTO planning_scenarios (id, name, revision, created_at, updated_at)
					 VALUES (?, ?, 1, ?, ?)`
				)
				.bind(id, name.value, now, now),
			...moves.value.map((move, index) =>
				binding
					.prepare(
						`INSERT INTO planning_scenario_moves
						 (scenario_id, move_order, course_id, target_semester_id) VALUES (?, ?, ?, ?)`
					)
					.bind(id, index, move.courseId, move.targetSemesterId)
			)
		];
		await binding.batch(statements);
		return {
			outcome: 'ok',
			value: {
				id,
				name: name.value,
				revision: 1,
				createdAt: now,
				updatedAt: now,
				moves: moves.value
			}
		};
	}

	async function update(
		idInput: unknown,
		input: unknown
	): Promise<ScenarioResult<PlanningScenario>> {
		const id = validateId(idInput);
		if (id.outcome !== 'ok') return id;
		const object = validateObject(input, ['name', 'moves', 'revision']);
		if (object.outcome !== 'ok') return object;
		const name = validateName(object.value.name);
		if (name.outcome !== 'ok') return name;
		const moves = validateMoves(object.value.moves);
		if (moves.outcome !== 'ok') return moves;
		const revision = validateRevision(object.value.revision);
		if (revision.outcome !== 'ok') return revision;

		const now = new Date().toISOString();
		const nextRevision = revision.value + 1;
		const statements = [
			binding
				.prepare(
					`DELETE FROM planning_scenario_moves
					 WHERE scenario_id = ? AND EXISTS (
					   SELECT 1 FROM planning_scenarios WHERE id = ? AND revision = ?
					 )`
				)
				.bind(id.value, id.value, revision.value),
			...moves.value.map((move, index) =>
				binding
					.prepare(
						`INSERT INTO planning_scenario_moves
						 (scenario_id, move_order, course_id, target_semester_id)
						 SELECT ?, ?, ?, ? WHERE EXISTS (
						   SELECT 1 FROM planning_scenarios WHERE id = ? AND revision = ?
						 )`
					)
					.bind(id.value, index, move.courseId, move.targetSemesterId, id.value, revision.value)
			),
			binding
				.prepare(
					`UPDATE planning_scenarios SET name = ?, revision = ?, updated_at = ?
					 WHERE id = ? AND revision = ?`
				)
				.bind(name.value, nextRevision, now, id.value, revision.value)
		];
		const results = await binding.batch(statements);
		if ((results.at(-1)?.meta.changes ?? 0) === 0) {
			const exists = await binding
				.prepare(`SELECT 1 AS found FROM planning_scenarios WHERE id = ?`)
				.bind(id.value)
				.first<{ found: number }>();
			return exists ? { outcome: 'conflict' } : { outcome: 'not-found' };
		}
		const created = await binding
			.prepare(`SELECT created_at FROM planning_scenarios WHERE id = ?`)
			.bind(id.value)
			.first<{ created_at: string }>();
		return {
			outcome: 'ok',
			value: {
				id: id.value,
				name: name.value,
				revision: nextRevision,
				createdAt: created!.created_at,
				updatedAt: now,
				moves: moves.value
			}
		};
	}

	async function rename(
		idInput: unknown,
		input: unknown
	): Promise<ScenarioResult<PlanningScenario>> {
		const id = validateId(idInput);
		if (id.outcome !== 'ok') return id;
		const object = validateObject(input, ['name', 'revision']);
		if (object.outcome !== 'ok') return object;
		const name = validateName(object.value.name);
		if (name.outcome !== 'ok') return name;
		const revision = validateRevision(object.value.revision);
		if (revision.outcome !== 'ok') return revision;
		const now = new Date().toISOString();
		const changed = await binding
			.prepare(
				`UPDATE planning_scenarios SET name = ?, revision = revision + 1, updated_at = ?
				 WHERE id = ? AND revision = ?`
			)
			.bind(name.value, now, id.value, revision.value)
			.run();
		if ((changed.meta.changes ?? 0) === 0) {
			const exists = await binding
				.prepare(`SELECT 1 AS found FROM planning_scenarios WHERE id = ?`)
				.bind(id.value)
				.first<{ found: number }>();
			return exists ? { outcome: 'conflict' } : { outcome: 'not-found' };
		}
		return get(id.value);
	}

	async function remove(idInput: unknown, revisionInput: unknown): Promise<ScenarioResult<null>> {
		const id = validateId(idInput);
		if (id.outcome !== 'ok') return id;
		const revision = validateRevision(revisionInput);
		if (revision.outcome !== 'ok') return revision;
		const deleted = await binding
			.prepare(`DELETE FROM planning_scenarios WHERE id = ? AND revision = ?`)
			.bind(id.value, revision.value)
			.run();
		if ((deleted.meta.changes ?? 0) > 0) return { outcome: 'ok', value: null };
		const exists = await binding
			.prepare(`SELECT 1 AS found FROM planning_scenarios WHERE id = ?`)
			.bind(id.value)
			.first<{ found: number }>();
		return exists ? { outcome: 'conflict' } : { outcome: 'not-found' };
	}

	return { list, get, create, update, rename, delete: remove };
}
