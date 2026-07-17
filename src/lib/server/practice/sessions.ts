import { PRACTICE_TEXT_LIMITS } from './schema';
import type { MaterialSource, PracticeFlashcard, PracticeQuestion } from './schema';

export type PracticeSessionSource = {
	materialId: string;
	fileName: string;
	uploadedAt: string;
};

export type PracticeSession = {
	id: string;
	courseId: string;
	courseCode: string;
	sourceMaterials: PracticeSessionSource[];
	questions: PracticeQuestion[];
	flashcards: PracticeFlashcard[];
	score: number;
	currentQuestionIndex: number;
	missedQuestionIds: string[];
	currentCardIndex: number;
	cardSide: 'front' | 'back';
	status: 'in_progress' | 'completed' | 'paused';
	createdAt: string;
	updatedAt: string;
};

export type PracticeSessionSummary = {
	id: string;
	courseId: string;
	courseCode: string;
	sourceMaterials: PracticeSessionSource[];
	status: 'in_progress' | 'completed' | 'paused';
	score: number;
	questionCount: number;
	flashcardCount: number;
	topics: string[];
	createdAt: string;
	updatedAt: string;
};

export type SessionResult<T> =
	| { outcome: 'ok'; value: T }
	| { outcome: 'validation'; message: string }
	| { outcome: 'not-found' };

type SessionRow = {
	id: string;
	course_id: string;
	course_code: string;
	source_materials: string;
	questions: string;
	flashcards: string;
	score: number;
	current_question_index: number;
	missed_question_ids: string;
	current_card_index: number;
	card_side: string;
	status: string;
	created_at: string;
	updated_at: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object') return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function validateString(value: unknown, field: string, max = 128): SessionResult<string> {
	if (typeof value !== 'string')
		return { outcome: 'validation', message: `${field} must be a string` };
	const trimmed = value.trim();
	if (trimmed.length < 1 || trimmed.length > max)
		return { outcome: 'validation', message: `${field} must be 1 to ${max} characters` };
	return { outcome: 'ok', value: trimmed };
}

function mapSession(row: SessionRow): PracticeSession {
	return {
		id: row.id,
		courseId: row.course_id,
		courseCode: row.course_code,
		sourceMaterials: JSON.parse(row.source_materials),
		questions: JSON.parse(row.questions),
		flashcards: JSON.parse(row.flashcards),
		score: row.score,
		currentQuestionIndex: row.current_question_index,
		missedQuestionIds: JSON.parse(row.missed_question_ids),
		currentCardIndex: row.current_card_index,
		cardSide: row.card_side as 'front' | 'back',
		status: row.status as 'in_progress' | 'completed' | 'paused',
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function mapSummary(row: SessionRow): PracticeSessionSummary {
	const sourceMaterials: PracticeSessionSource[] = JSON.parse(row.source_materials);
	const questions: PracticeQuestion[] = JSON.parse(row.questions);
	const flashcards: PracticeFlashcard[] = JSON.parse(row.flashcards);
	const topics = Array.from(
		new Set([...questions, ...flashcards].map((item) => item.topic).filter(Boolean))
	);
	return {
		id: row.id,
		courseId: row.course_id,
		courseCode: row.course_code,
		sourceMaterials,
		status: row.status as 'in_progress' | 'completed' | 'paused',
		score: row.score,
		questionCount: questions.length,
		flashcardCount: flashcards.length,
		topics,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

const VALID_SESSION_FIELDS = [
	'courseId',
	'courseCode',
	'sourceMaterials',
	'questions',
	'flashcards'
] as const;

const VALID_PROGRESS_FIELDS = [
	'score',
	'currentQuestionIndex',
	'missedQuestionIds',
	'currentCardIndex',
	'cardSide',
	'status'
] as const;

function validateSource(
	entry: unknown,
	prefix: string,
	sourceLookup: Map<string, string>
): SessionResult<MaterialSource> {
	if (!isPlainObject(entry))
		return { outcome: 'validation', message: `${prefix}.source must be a plain object` };
	const keys = Object.keys(entry);
	if (keys.some((k) => !['materialId', 'fileName', 'pageStart', 'pageEnd'].includes(k)))
		return { outcome: 'validation', message: `${prefix}.source contains unsupported fields` };
	const materialId = validateString(
		(entry as Record<string, unknown>).materialId,
		`${prefix}.source.materialId`
	);
	if (materialId.outcome !== 'ok') return materialId;
	const fileName = validateString(
		(entry as Record<string, unknown>).fileName,
		`${prefix}.source.fileName`,
		256
	);
	if (fileName.outcome !== 'ok') return fileName;
	if (!sourceLookup.has(materialId.value))
		return {
			outcome: 'validation',
			message: `${prefix}.source.materialId "${materialId.value}" not found in sourceMaterials`
		};
	if (sourceLookup.get(materialId.value) !== fileName.value)
		return {
			outcome: 'validation',
			message: `${prefix}.source.fileName does not match source.materialId`
		};
	const { pageStart, pageEnd } = entry;
	if (
		pageStart !== undefined &&
		(typeof pageStart !== 'number' || !Number.isInteger(pageStart) || pageStart < 1)
	)
		return {
			outcome: 'validation',
			message: `${prefix}.source.pageStart must be a positive integer`
		};
	if (
		pageEnd !== undefined &&
		(typeof pageEnd !== 'number' || !Number.isInteger(pageEnd) || pageEnd < 1)
	)
		return {
			outcome: 'validation',
			message: `${prefix}.source.pageEnd must be a positive integer`
		};
	if (pageStart !== undefined && pageEnd !== undefined && Number(pageEnd) < Number(pageStart))
		return {
			outcome: 'validation',
			message: `${prefix}.source.pageEnd must not precede pageStart`
		};
	return {
		outcome: 'ok',
		value: {
			materialId: materialId.value,
			fileName: fileName.value,
			...(pageStart === undefined ? {} : { pageStart: Number(pageStart) }),
			...(pageEnd === undefined ? {} : { pageEnd: Number(pageEnd) })
		}
	};
}

function validateSourceMaterials(value: unknown): SessionResult<PracticeSessionSource[]> {
	if (!Array.isArray(value))
		return { outcome: 'validation', message: 'sourceMaterials must be an array' };
	if (value.length < 1 || value.length > 50)
		return { outcome: 'validation', message: 'sourceMaterials must contain 1 to 50 entries' };
	const items: PracticeSessionSource[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (!isPlainObject(entry))
			return { outcome: 'validation', message: 'each sourceMaterial must be a plain object' };
		const materialId = validateString(entry.materialId, 'materialId');
		if (materialId.outcome !== 'ok') return materialId;
		if (seen.has(materialId.value))
			return { outcome: 'validation', message: 'duplicate source materialId' };
		seen.add(materialId.value);
		const fileName = validateString(entry.fileName, 'fileName', 256);
		if (fileName.outcome !== 'ok') return fileName;
		const uploadedAt = validateString(entry.uploadedAt, 'uploadedAt');
		if (uploadedAt.outcome !== 'ok') return uploadedAt;
		const keys = Object.keys(entry);
		if (keys.some((k) => k !== 'materialId' && k !== 'fileName' && k !== 'uploadedAt'))
			return { outcome: 'validation', message: 'sourceMaterial contains unsupported fields' };
		items.push({
			materialId: materialId.value,
			fileName: fileName.value,
			uploadedAt: uploadedAt.value
		});
	}
	return { outcome: 'ok', value: items };
}

function validateQuestions(
	value: unknown,
	expectedCourseCode: string,
	sourceLookup: Map<string, string>
): SessionResult<PracticeQuestion[]> {
	if (!Array.isArray(value))
		return { outcome: 'validation', message: 'questions must be an array' };
	if (value.length < 1 || value.length > 50)
		return { outcome: 'validation', message: 'questions must contain 1 to 50 entries' };
	const items: PracticeQuestion[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (!isPlainObject(entry))
			return { outcome: 'validation', message: 'each question must be a plain object' };
		const keys = Object.keys(entry);
		if (
			keys.some(
				(k) =>
					![
						'id',
						'courseCode',
						'topic',
						'question',
						'options',
						'correctIndex',
						'explanation',
						'source'
					].includes(k)
			)
		)
			return { outcome: 'validation', message: 'question contains unsupported fields' };
		const id = validateString(entry.id, 'questions[].id');
		if (id.outcome !== 'ok') return id;
		if (seen.has(id.value))
			return { outcome: 'validation', message: `duplicate question id "${id.value}"` };
		seen.add(id.value);
		const courseCode = validateString(entry.courseCode, 'questions[].courseCode', 20);
		if (courseCode.outcome !== 'ok') return courseCode;
		if (courseCode.value !== expectedCourseCode)
			return {
				outcome: 'validation',
				message: 'questions[].courseCode does not match top-level courseCode'
			};
		const topic = validateString(entry.topic, 'questions[].topic', PRACTICE_TEXT_LIMITS.topic);
		if (topic.outcome !== 'ok') return topic;
		const question = validateString(
			entry.question,
			'questions[].question',
			PRACTICE_TEXT_LIMITS.question
		);
		if (question.outcome !== 'ok') return question;
		if (!Array.isArray(entry.options) || entry.options.length !== 4)
			return {
				outcome: 'validation',
				message: 'questions[].options must be an array of 4 strings'
			};
		const options: [string, string, string, string] = [null!, null!, null!, null!];
		for (let i = 0; i < 4; i++) {
			const opt = validateString(
				entry.options[i],
				`questions[].options[${i}]`,
				PRACTICE_TEXT_LIMITS.option
			);
			if (opt.outcome !== 'ok') return opt;
			options[i] = opt.value;
		}
		if (
			typeof entry.correctIndex !== 'number' ||
			!Number.isInteger(entry.correctIndex) ||
			entry.correctIndex < 0 ||
			entry.correctIndex > 3
		)
			return { outcome: 'validation', message: 'questions[].correctIndex must be an integer 0-3' };
		const explanation = validateString(
			entry.explanation,
			'questions[].explanation',
			PRACTICE_TEXT_LIMITS.explanation
		);
		if (explanation.outcome !== 'ok') return explanation;
		const source = validateSource(entry.source, 'questions[]', sourceLookup);
		if (source.outcome !== 'ok') return source;
		items.push({
			id: id.value,
			courseCode: courseCode.value,
			topic: topic.value,
			question: question.value,
			options,
			correctIndex: entry.correctIndex as 0 | 1 | 2 | 3,
			explanation: explanation.value,
			source: source.value
		});
	}
	return { outcome: 'ok', value: items };
}

function validateFlashcards(
	value: unknown,
	expectedCourseCode: string,
	sourceLookup: Map<string, string>
): SessionResult<PracticeFlashcard[]> {
	if (!Array.isArray(value))
		return { outcome: 'validation', message: 'flashcards must be an array' };
	if (value.length < 1 || value.length > 50)
		return { outcome: 'validation', message: 'flashcards must contain 1 to 50 entries' };
	const items: PracticeFlashcard[] = [];
	const seen = new Set<string>();
	for (const entry of value) {
		if (!isPlainObject(entry))
			return { outcome: 'validation', message: 'each flashcard must be a plain object' };
		const keys = Object.keys(entry);
		if (keys.some((k) => !['id', 'courseCode', 'topic', 'front', 'back', 'source'].includes(k)))
			return { outcome: 'validation', message: 'flashcard contains unsupported fields' };
		const id = validateString(entry.id, 'flashcards[].id');
		if (id.outcome !== 'ok') return id;
		if (seen.has(id.value))
			return { outcome: 'validation', message: `duplicate flashcard id "${id.value}"` };
		seen.add(id.value);
		const courseCode = validateString(entry.courseCode, 'flashcards[].courseCode', 20);
		if (courseCode.outcome !== 'ok') return courseCode;
		if (courseCode.value !== expectedCourseCode)
			return {
				outcome: 'validation',
				message: 'flashcards[].courseCode does not match top-level courseCode'
			};
		const topic = validateString(entry.topic, 'flashcards[].topic', PRACTICE_TEXT_LIMITS.topic);
		if (topic.outcome !== 'ok') return topic;
		const front = validateString(
			entry.front,
			'flashcards[].front',
			PRACTICE_TEXT_LIMITS.flashcardFront
		);
		if (front.outcome !== 'ok') return front;
		const back = validateString(
			entry.back,
			'flashcards[].back',
			PRACTICE_TEXT_LIMITS.flashcardBack
		);
		if (back.outcome !== 'ok') return back;
		const source = validateSource(entry.source, 'flashcards[]', sourceLookup);
		if (source.outcome !== 'ok') return source;
		items.push({
			id: id.value,
			courseCode: courseCode.value,
			topic: topic.value,
			front: front.value,
			back: back.value,
			source: source.value
		});
	}
	return { outcome: 'ok', value: items };
}

export function createPracticeSessionRepository(binding: D1Database) {
	async function list(courseId?: string): Promise<SessionResult<PracticeSessionSummary[]>> {
		let rows: SessionRow[];
		if (courseId) {
			const id = validateString(courseId, 'courseId');
			if (id.outcome !== 'ok') return id;
			rows = (
				await binding
					.prepare(
						`SELECT id, course_id, course_code, source_materials, questions, flashcards,
						 score, current_question_index, missed_question_ids, current_card_index,
						 card_side, status, created_at, updated_at
						 FROM practice_sessions WHERE course_id = ?
						 ORDER BY updated_at DESC, id`
					)
					.bind(id.value)
					.all<SessionRow>()
			).results;
		} else {
			rows = (
				await binding
					.prepare(
						`SELECT id, course_id, course_code, source_materials, questions, flashcards,
						 score, current_question_index, missed_question_ids, current_card_index,
						 card_side, status, created_at, updated_at
						 FROM practice_sessions ORDER BY updated_at DESC, id`
					)
					.all<SessionRow>()
			).results;
		}
		return { outcome: 'ok', value: rows.map(mapSummary) };
	}

	async function get(idInput: unknown): Promise<SessionResult<PracticeSession>> {
		const id = validateString(idInput, 'id');
		if (id.outcome !== 'ok') return id;
		const row = await binding
			.prepare(
				`SELECT id, course_id, course_code, source_materials, questions, flashcards,
				 score, current_question_index, missed_question_ids, current_card_index,
				 card_side, status, created_at, updated_at
				 FROM practice_sessions WHERE id = ?`
			)
			.bind(id.value)
			.first<SessionRow>();
		if (!row) return { outcome: 'not-found' };
		return { outcome: 'ok', value: mapSession(row) };
	}

	async function create(input: unknown): Promise<SessionResult<PracticeSession>> {
		if (!isPlainObject(input))
			return { outcome: 'validation', message: 'request must be a plain object' };
		if (
			Object.keys(input).some((key) => !(VALID_SESSION_FIELDS as readonly string[]).includes(key))
		)
			return { outcome: 'validation', message: 'request contains unsupported fields' };

		const courseId = validateString(input.courseId, 'courseId');
		if (courseId.outcome !== 'ok') return courseId;
		const courseCode = validateString(input.courseCode, 'courseCode', 20);
		if (courseCode.outcome !== 'ok') return courseCode;
		const sourceMaterials = validateSourceMaterials(input.sourceMaterials);
		if (sourceMaterials.outcome !== 'ok') return sourceMaterials;
		const sourceLookup = new Map(sourceMaterials.value.map((s) => [s.materialId, s.fileName]));
		const questions = validateQuestions(input.questions, courseCode.value, sourceLookup);
		if (questions.outcome !== 'ok') return questions;
		const flashcards = validateFlashcards(input.flashcards, courseCode.value, sourceLookup);
		if (flashcards.outcome !== 'ok') return flashcards;

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		await binding
			.prepare(
				`INSERT INTO practice_sessions
				 (id, course_id, course_code, source_materials, questions, flashcards,
				  score, current_question_index, missed_question_ids, current_card_index,
				  card_side, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, 0, 0, '[]', 0, 'front', 'in_progress', ?, ?)`
			)
			.bind(
				id,
				courseId.value,
				courseCode.value,
				JSON.stringify(sourceMaterials.value),
				JSON.stringify(questions.value),
				JSON.stringify(flashcards.value),
				now,
				now
			)
			.run();
		return {
			outcome: 'ok',
			value: {
				id,
				courseId: courseId.value,
				courseCode: courseCode.value,
				sourceMaterials: sourceMaterials.value,
				questions: questions.value,
				flashcards: flashcards.value,
				score: 0,
				currentQuestionIndex: 0,
				missedQuestionIds: [],
				currentCardIndex: 0,
				cardSide: 'front',
				status: 'in_progress',
				createdAt: now,
				updatedAt: now
			}
		};
	}

	async function updateProgress(
		idInput: unknown,
		input: unknown
	): Promise<SessionResult<PracticeSession>> {
		const id = validateString(idInput, 'id');
		if (id.outcome !== 'ok') return id;
		if (!isPlainObject(input))
			return { outcome: 'validation', message: 'request must be a plain object' };
		if (
			Object.keys(input).some((key) => !(VALID_PROGRESS_FIELDS as readonly string[]).includes(key))
		)
			return { outcome: 'validation', message: 'request contains unsupported fields' };

		const existing = await get(id.value);
		if (existing.outcome !== 'ok') return existing;

		const session = existing.value;
		const questionCount = session.questions.length;
		const flashcardCount = session.flashcards.length;

		let score = session.score;
		let currentQuestionIndex = session.currentQuestionIndex;
		let missedQuestionIds = session.missedQuestionIds;
		let currentCardIndex = session.currentCardIndex;
		let cardSide = session.cardSide;
		let status = session.status;

		if (input.score !== undefined) {
			if (!Number.isInteger(input.score) || (input.score as number) < 0)
				return { outcome: 'validation', message: 'score must be a non-negative integer' };
			if ((input.score as number) > questionCount)
				return {
					outcome: 'validation',
					message: `score must not exceed question count (${questionCount})`
				};
			score = input.score as number;
		}
		if (input.currentQuestionIndex !== undefined) {
			if (
				!Number.isInteger(input.currentQuestionIndex) ||
				(input.currentQuestionIndex as number) < 0 ||
				(input.currentQuestionIndex as number) > questionCount
			)
				return {
					outcome: 'validation',
					message: `currentQuestionIndex must be 0 to ${questionCount}`
				};
			currentQuestionIndex = input.currentQuestionIndex as number;
		}
		if (input.missedQuestionIds !== undefined) {
			if (
				!Array.isArray(input.missedQuestionIds) ||
				!input.missedQuestionIds.every((id: unknown) => typeof id === 'string')
			)
				return {
					outcome: 'validation',
					message: 'missedQuestionIds must be an array of strings'
				};
			const ids = input.missedQuestionIds as string[];
			if (new Set(ids).size !== ids.length)
				return { outcome: 'validation', message: 'missedQuestionIds must be unique' };
			const validIds = new Set(session.questions.map((q) => q.id));
			for (const id of ids) {
				if (!validIds.has(id))
					return {
						outcome: 'validation',
						message: `missedQuestionIds contains unknown question id "${id}"`
					};
			}
			missedQuestionIds = ids;
		}
		if (input.currentCardIndex !== undefined) {
			if (
				!Number.isInteger(input.currentCardIndex) ||
				(input.currentCardIndex as number) < 0 ||
				(input.currentCardIndex as number) >= flashcardCount
			)
				return {
					outcome: 'validation',
					message: `currentCardIndex must be 0 to ${flashcardCount - 1}`
				};
			currentCardIndex = input.currentCardIndex as number;
		}
		if (input.cardSide !== undefined) {
			if (input.cardSide !== 'front' && input.cardSide !== 'back')
				return { outcome: 'validation', message: 'cardSide must be front or back' };
			cardSide = input.cardSide as 'front' | 'back';
		}
		if (input.status !== undefined) {
			if (
				input.status !== 'in_progress' &&
				input.status !== 'completed' &&
				input.status !== 'paused'
			)
				return {
					outcome: 'validation',
					message: 'status must be in_progress, completed, or paused'
				};
			status = input.status as 'in_progress' | 'completed' | 'paused';
		}

		const now = new Date().toISOString();
		await binding
			.prepare(
				`UPDATE practice_sessions
				 SET score = ?, current_question_index = ?, missed_question_ids = ?,
				     current_card_index = ?, card_side = ?, status = ?, updated_at = ?
				 WHERE id = ?`
			)
			.bind(
				score,
				currentQuestionIndex,
				JSON.stringify(missedQuestionIds),
				currentCardIndex,
				cardSide,
				status,
				now,
				id.value
			)
			.run();

		return {
			outcome: 'ok',
			value: {
				...session,
				score,
				currentQuestionIndex,
				missedQuestionIds,
				currentCardIndex,
				cardSide,
				status,
				updatedAt: now
			}
		};
	}

	async function remove(idInput: unknown): Promise<SessionResult<null>> {
		const id = validateString(idInput, 'id');
		if (id.outcome !== 'ok') return id;
		const deleted = await binding
			.prepare(`DELETE FROM practice_sessions WHERE id = ?`)
			.bind(id.value)
			.run();
		if ((deleted.meta.changes ?? 0) > 0) return { outcome: 'ok', value: null };
		return { outcome: 'not-found' };
	}

	return { list, get, create, updateProgress, delete: remove };
}
