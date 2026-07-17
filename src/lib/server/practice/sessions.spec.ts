import { describe, expect, it, vi } from 'vitest';
import { createPracticeSessionRepository } from './sessions';

function mockBinding(options?: {
	firstResults?: unknown[];
	allResults?: unknown[][];
	runChanges?: number;
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
			async first<T>() {
				return (firstResults.shift() ?? null) as T;
			},
			async all<T>() {
				return { results: (allResults.shift() ?? []) as T[] };
			},
			async run() {
				return { meta: { changes: options?.runChanges ?? 1 } };
			}
		};
		statements.push(statement);
		return statement;
	});
	const batch = vi.fn();
	return {
		binding: { prepare, batch } as unknown as D1Database,
		prepare,
		statements
	};
}

const validQuestion = {
	id: 'q1',
	courseCode: 'CSIS-2200',
	topic: 'Variables',
	question: 'What is a variable?',
	options: ['A', 'B', 'C', 'D'],
	correctIndex: 0,
	explanation: 'Variables store data',
	source: { materialId: 'm1', fileName: 'notes.pdf' }
};

const validFlashcard = {
	id: 'f1',
	courseCode: 'CSIS-2200',
	topic: 'Variables',
	front: 'What is a variable?',
	back: 'A storage location',
	source: { materialId: 'm1', fileName: 'notes.pdf' }
};

const validSource = {
	materialId: 'm1',
	fileName: 'notes.pdf',
	uploadedAt: '2026-01-01T00:00:00.000Z'
};

const validCreate = {
	courseId: 'course-1',
	courseCode: 'CSIS-2200',
	sourceMaterials: [validSource],
	questions: [validQuestion],
	flashcards: [validFlashcard]
};

describe('practice session validation', () => {
	it.each([
		[null, 'plain object'],
		[[], 'plain object'],
		[
			{
				courseId: '  ',
				courseCode: 'CSIS-2200',
				sourceMaterials: [validSource],
				questions: [validQuestion],
				flashcards: [validFlashcard]
			},
			'courseId'
		],
		[
			{
				courseId: 'c',
				courseCode: '',
				sourceMaterials: [validSource],
				questions: [validQuestion],
				flashcards: [validFlashcard]
			},
			'courseCode'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: null,
				questions: [validQuestion],
				flashcards: [validFlashcard]
			},
			'sourceMaterials'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [],
				questions: [validQuestion],
				flashcards: [validFlashcard]
			},
			'sourceMaterials'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [validSource],
				questions: null,
				flashcards: [validFlashcard]
			},
			'questions'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [validSource],
				questions: [],
				flashcards: [validFlashcard]
			},
			'questions'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [validSource],
				questions: [validQuestion],
				flashcards: null
			},
			'flashcards'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [validSource],
				questions: [validQuestion],
				flashcards: []
			},
			'flashcards'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [validSource],
				questions: [validQuestion],
				flashcards: [validFlashcard],
				extra: true
			},
			'unsupported'
		],
		[
			{
				courseId: 'c',
				courseCode: 'CSIS-2200',
				sourceMaterials: [{ materialId: 'm1', fileName: 'n.pdf', uploadedAt: 't', extra: true }],
				questions: [validQuestion],
				flashcards: [validFlashcard]
			},
			'unsupported'
		]
	])('rejects invalid create input %#', async (input, message) => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create(input);
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain(message);
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects question with unsupported fields', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, extra: true }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('unsupported');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects question with courseCode mismatch', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, courseCode: 'OTHER-1234' }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation')
			expect(result.message).toContain('courseCode does not match');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects question with source materialId not in sourceMaterials', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, source: { materialId: 'unknown', fileName: 'notes.pdf' } }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation')
			expect(result.message).toContain('not found in sourceMaterials');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects question with source fileName mismatch', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, source: { materialId: 'm1', fileName: 'wrong.pdf' } }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('does not match');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('accepts generated explanations longer than metadata fields', async () => {
		const mock = mockBinding();
		const explanation = 'A detailed explanation grounded in the selected source passage. '.repeat(
			5
		);
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, explanation }]
		});
		expect(explanation.length).toBeGreaterThan(128);
		expect(result).toMatchObject({ outcome: 'ok' });
	});

	it('still rejects unbounded generated explanations', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, explanation: 'x'.repeat(4001) }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
	});

	it('accepts trusted page metadata on generated item sources', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [
				{
					...validQuestion,
					source: { ...validQuestion.source, pageStart: 12, pageEnd: 14 }
				}
			]
		});
		expect(result).toMatchObject({ outcome: 'ok' });
	});

	it('rejects invalid source page ranges', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [
				{
					...validQuestion,
					source: { ...validQuestion.source, pageStart: 14, pageEnd: 12 }
				}
			]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
	});

	it('rejects question with empty option', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, options: ['A', '', 'C', 'D'] }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('options[1]');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects duplicate question ids', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [validQuestion, { ...validQuestion, id: 'q1' }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('duplicate question id');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects duplicate flashcard ids', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			flashcards: [validFlashcard, { ...validFlashcard, id: 'f1' }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('duplicate flashcard id');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects duplicate source material ids', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			sourceMaterials: [validSource, { ...validSource, materialId: 'm1' }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation')
			expect(result.message).toContain('duplicate source materialId');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	it('rejects question with non-integer correctIndex', async () => {
		const mock = mockBinding();
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			questions: [{ ...validQuestion, correctIndex: 1.5 }]
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('correctIndex');
		expect(mock.prepare).not.toHaveBeenCalled();
	});

	const existingRow = {
		id: 'session-1',
		course_id: 'course-1',
		course_code: 'CSIS-2200',
		source_materials: '[]',
		questions: JSON.stringify([validQuestion, { ...validQuestion, id: 'q2' }]),
		flashcards: JSON.stringify([validFlashcard, { ...validFlashcard, id: 'f2' }]),
		score: 0,
		current_question_index: 0,
		missed_question_ids: '[]',
		current_card_index: 0,
		card_side: 'front',
		status: 'in_progress',
		created_at: 'created',
		updated_at: 'updated'
	};

	it.each([
		[{ foo: 'bar' }, 'unsupported'],
		[{ score: 'abc', status: 'in_progress' }, 'score'],
		[{ score: -1, status: 'in_progress' }, 'score'],
		[{ currentQuestionIndex: -1 }, 'currentQuestionIndex'],
		[{ missedQuestionIds: 'not-array' }, 'missedQuestionIds'],
		[{ currentCardIndex: -1 }, 'currentCardIndex'],
		[{ cardSide: 'other' }, 'cardSide'],
		[{ status: 'unknown' }, 'status']
	])('rejects invalid progress input %#', async (input, message) => {
		const mock = mockBinding({ firstResults: [existingRow] });
		const repo = createPracticeSessionRepository(mock.binding);
		const result = await repo.updateProgress('session-1', input);
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain(message);
	});

	it('rejects score exceeding question count', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: '[]',
			questions: JSON.stringify([validQuestion]),
			flashcards: JSON.stringify([validFlashcard]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing] });
		const result = await createPracticeSessionRepository(mock.binding).updateProgress('s1', {
			score: 5
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('exceed');
	});

	it('rejects missedQuestionIds with duplicates', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: '[]',
			questions: JSON.stringify([validQuestion, { ...validQuestion, id: 'q2' }]),
			flashcards: JSON.stringify([validFlashcard]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing] });
		const result = await createPracticeSessionRepository(mock.binding).updateProgress('s1', {
			missedQuestionIds: ['q1', 'q1']
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('unique');
	});

	it('rejects missedQuestionIds with unknown question id', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: '[]',
			questions: JSON.stringify([validQuestion]),
			flashcards: JSON.stringify([validFlashcard]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing] });
		const result = await createPracticeSessionRepository(mock.binding).updateProgress('s1', {
			missedQuestionIds: ['unknown']
		});
		expect(result).toMatchObject({ outcome: 'validation' });
		if (result.outcome === 'validation') expect(result.message).toContain('unknown question id');
	});

	it('accepts currentQuestionIndex at question count (completed sentinel)', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: '[]',
			questions: JSON.stringify([validQuestion]),
			flashcards: JSON.stringify([validFlashcard]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing], runChanges: 1 });
		const result = await createPracticeSessionRepository(mock.binding).updateProgress('s1', {
			currentQuestionIndex: 1
		});
		expect(result.outcome).toBe('ok');
	});

	it('accepts valid completed progress update', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: '[]',
			questions: JSON.stringify([validQuestion, { ...validQuestion, id: 'q2' }]),
			flashcards: JSON.stringify([validFlashcard, { ...validFlashcard, id: 'f2' }]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing], runChanges: 1 });
		const result = await createPracticeSessionRepository(mock.binding).updateProgress('s1', {
			score: 2,
			currentQuestionIndex: 2,
			missedQuestionIds: ['q1'],
			currentCardIndex: 1,
			cardSide: 'back',
			status: 'completed'
		});
		expect(result.outcome).toBe('ok');
		if (result.outcome !== 'ok') return;
		expect(result.value.score).toBe(2);
		expect(result.value.currentQuestionIndex).toBe(2);
		expect(result.value.currentCardIndex).toBe(1);
		expect(result.value.cardSide).toBe('back');
		expect(result.value.status).toBe('completed');
		expect(result.value.missedQuestionIds).toEqual(['q1']);
	});
});

describe('practice session persistence contracts', () => {
	it('trims input, assigns server fields, and persists creation', async () => {
		const mock = mockBinding({ runChanges: 1 });
		const result = await createPracticeSessionRepository(mock.binding).create({
			...validCreate,
			courseId: '  course-1  ',
			courseCode: '  CSIS-2200  '
		});

		expect(result.outcome).toBe('ok');
		if (result.outcome !== 'ok') return;
		expect(result.value.courseId).toBe('course-1');
		expect(result.value.courseCode).toBe('CSIS-2200');
		expect(result.value.id).toMatch(/^[0-9a-f-]{36}$/i);
		expect(Number.isNaN(Date.parse(result.value.createdAt))).toBe(false);
		expect(result.value.score).toBe(0);
		expect(result.value.currentQuestionIndex).toBe(0);
		expect(result.value.currentCardIndex).toBe(0);
		expect(result.value.cardSide).toBe('front');
		expect(result.value.status).toBe('in_progress');
		expect(result.value.missedQuestionIds).toEqual([]);
		expect(result.value.questions).toEqual([validQuestion]);
		expect(result.value.flashcards).toEqual([validFlashcard]);
		expect(mock.prepare).toHaveBeenCalledOnce();
		expect(mock.statements[0].sql).toContain('INSERT INTO practice_sessions');
		const insertValues = mock.statements[0].values;
		expect(insertValues[0]).toMatch(/^[0-9a-f-]{36}$/i);
		expect(insertValues[1]).toBe('course-1');
		expect(insertValues[2]).toBe('CSIS-2200');
		expect(insertValues[3]).toBe(JSON.stringify([validSource]));
	});

	it('lists sessions newest first with summaries', async () => {
		const mock = mockBinding({
			allResults: [
				[
					{
						id: 's1',
						course_id: 'course-1',
						course_code: 'CSIS-2200',
						source_materials: JSON.stringify([validSource]),
						questions: JSON.stringify([validQuestion, validQuestion]),
						flashcards: JSON.stringify([validFlashcard]),
						score: 2,
						current_question_index: 1,
						missed_question_ids: '["q1"]',
						current_card_index: 1,
						card_side: 'front',
						status: 'in_progress',
						created_at: 'earlier',
						updated_at: 'later'
					}
				]
			]
		});
		const result = await createPracticeSessionRepository(mock.binding).list();
		expect(result.outcome).toBe('ok');
		if (result.outcome !== 'ok') return;
		expect(result.value).toHaveLength(1);
		expect(result.value[0]).toEqual({
			id: 's1',
			courseId: 'course-1',
			courseCode: 'CSIS-2200',
			sourceMaterials: [validSource],
			status: 'in_progress',
			score: 2,
			questionCount: 2,
			flashcardCount: 1,
			topics: ['Variables'],
			createdAt: 'earlier',
			updatedAt: 'later'
		});
		expect(mock.prepare).toHaveBeenCalledOnce();
		expect(mock.statements[0].sql).not.toContain('WHERE');
	});

	it('filters list by courseId', async () => {
		const mock = mockBinding({ allResults: [[]] });
		await createPracticeSessionRepository(mock.binding).list('course-2');
		expect(mock.statements[0].sql).toContain('WHERE course_id = ?');
		expect(mock.statements[0].values[0]).toBe('course-2');
	});

	it('gets a full session by id', async () => {
		const mock = mockBinding({
			firstResults: [
				{
					id: 's1',
					course_id: 'course-1',
					course_code: 'CSIS-2200',
					source_materials: JSON.stringify([validSource]),
					questions: JSON.stringify([validQuestion]),
					flashcards: JSON.stringify([validFlashcard]),
					score: 3,
					current_question_index: 2,
					missed_question_ids: '["q1"]',
					current_card_index: 1,
					card_side: 'back',
					status: 'paused',
					created_at: 'created',
					updated_at: 'updated'
				}
			]
		});
		const result = await createPracticeSessionRepository(mock.binding).get('s1');
		expect(result.outcome).toBe('ok');
		if (result.outcome !== 'ok') return;
		expect(result.value.id).toBe('s1');
		expect(result.value.score).toBe(3);
		expect(result.value.currentQuestionIndex).toBe(2);
		expect(result.value.missedQuestionIds).toEqual(['q1']);
		expect(result.value.currentCardIndex).toBe(1);
		expect(result.value.cardSide).toBe('back');
		expect(result.value.status).toBe('paused');
		expect(result.value.questions).toEqual([validQuestion]);
	});

	it('returns not-found for missing session', async () => {
		const mock = mockBinding({ firstResults: [null] });
		const result = await createPracticeSessionRepository(mock.binding).get('missing');
		expect(result).toEqual({ outcome: 'not-found' });
	});

	it('updates progress fields and returns merged session', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: JSON.stringify([validSource]),
			questions: JSON.stringify([validQuestion, { ...validQuestion, id: 'q2' }]),
			flashcards: JSON.stringify([validFlashcard, { ...validFlashcard, id: 'f2' }]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing], runChanges: 1 });
		const result = await createPracticeSessionRepository(mock.binding).updateProgress('s1', {
			score: 2,
			currentQuestionIndex: 1,
			missedQuestionIds: ['q1'],
			currentCardIndex: 1,
			cardSide: 'back',
			status: 'in_progress'
		});
		expect(result.outcome).toBe('ok');
		if (result.outcome !== 'ok') return;
		expect(result.value.score).toBe(2);
		expect(result.value.currentQuestionIndex).toBe(1);
		expect(result.value.missedQuestionIds).toEqual(['q1']);
		expect(result.value.currentCardIndex).toBe(1);
		expect(result.value.cardSide).toBe('back');
		expect(result.value.status).toBe('in_progress');
		expect(result.value.updatedAt).not.toBe('updated');
		expect(result.value.questions).toHaveLength(2);
		expect(result.value.flashcards).toHaveLength(2);
	});

	it('rejects progress indices beyond question/card count', async () => {
		const existing = {
			id: 's1',
			course_id: 'course-1',
			course_code: 'CSIS-2200',
			source_materials: '[]',
			questions: JSON.stringify([validQuestion]),
			flashcards: JSON.stringify([validFlashcard]),
			score: 0,
			current_question_index: 0,
			missed_question_ids: '[]',
			current_card_index: 0,
			card_side: 'front',
			status: 'in_progress',
			created_at: 'created',
			updated_at: 'updated'
		};
		const mock = mockBinding({ firstResults: [existing, existing] });
		const repo = createPracticeSessionRepository(mock.binding);
		const overIndex = await repo.updateProgress('s1', { currentQuestionIndex: 5 });
		expect(overIndex).toMatchObject({ outcome: 'validation' });
		const overCard = await repo.updateProgress('s1', { currentCardIndex: 5 });
		expect(overCard).toMatchObject({ outcome: 'validation' });
	});

	it('deletes an existing session', async () => {
		const mock = mockBinding({ runChanges: 1 });
		const result = await createPracticeSessionRepository(mock.binding).delete('s1');
		expect(result).toEqual({ outcome: 'ok', value: null });
		expect(mock.statements[0].sql).toContain('DELETE FROM practice_sessions WHERE id = ?');
	});

	it('returns not-found on delete for missing session', async () => {
		const mock = mockBinding({ runChanges: 0 });
		const result = await createPracticeSessionRepository(mock.binding).delete('missing');
		expect(result).toEqual({ outcome: 'not-found' });
	});
});
