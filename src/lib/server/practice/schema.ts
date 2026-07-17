export type MaterialSource = {
	materialId: string;
	fileName: string;
	pageStart?: number;
	pageEnd?: number;
};

export type PracticeQuestion = {
	id: string;
	courseCode: string;
	topic: string;
	question: string;
	options: [string, string, string, string];
	correctIndex: 0 | 1 | 2 | 3;
	explanation: string;
	source: MaterialSource;
};

export type PracticeFlashcard = {
	id: string;
	courseCode: string;
	topic: string;
	front: string;
	back: string;
	source: MaterialSource;
};

export type GenerateRequest = {
	courseId: string;
	topic?: string;
	materialIds?: string[];
};

export type GenerateResponse = {
	questions: PracticeQuestion[];
	flashcards: PracticeFlashcard[];
};

export const PRACTICE_TEXT_LIMITS = {
	id: 128,
	courseCode: 20,
	topic: 256,
	question: 2000,
	option: 1000,
	explanation: 4000,
	flashcardFront: 2000,
	flashcardBack: 4000,
	chunkId: 256
} as const;

export const PRACTICE_JSON_SCHEMA = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'synapse.practice_generation.v1',
	type: 'object',
	additionalProperties: false,
	required: ['questions', 'flashcards'],
	properties: {
		questions: {
			type: 'array',
			minItems: 5,
			maxItems: 5,
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'id',
					'courseCode',
					'topic',
					'question',
					'options',
					'correctIndex',
					'explanation',
					'source'
				],
				properties: {
					id: { type: 'string', minLength: 1, maxLength: PRACTICE_TEXT_LIMITS.id },
					courseCode: {
						type: 'string',
						minLength: 1,
						maxLength: PRACTICE_TEXT_LIMITS.courseCode
					},
					topic: { type: 'string', minLength: 1, maxLength: PRACTICE_TEXT_LIMITS.topic },
					question: {
						type: 'string',
						minLength: 1,
						maxLength: PRACTICE_TEXT_LIMITS.question
					},
					options: {
						type: 'array',
						minItems: 4,
						maxItems: 4,
						items: {
							type: 'string',
							minLength: 1,
							maxLength: PRACTICE_TEXT_LIMITS.option
						}
					},
					correctIndex: { type: 'number', minimum: 0, maximum: 3 },
					explanation: {
						type: 'string',
						minLength: 1,
						maxLength: PRACTICE_TEXT_LIMITS.explanation
					},
					source: {
						type: 'object',
						additionalProperties: false,
						required: ['chunkId'],
						properties: {
							chunkId: {
								type: 'string',
								minLength: 1,
								maxLength: PRACTICE_TEXT_LIMITS.chunkId
							}
						}
					}
				}
			}
		},
		flashcards: {
			type: 'array',
			minItems: 8,
			maxItems: 8,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['id', 'courseCode', 'topic', 'front', 'back', 'source'],
				properties: {
					id: { type: 'string', minLength: 1, maxLength: PRACTICE_TEXT_LIMITS.id },
					courseCode: {
						type: 'string',
						minLength: 1,
						maxLength: PRACTICE_TEXT_LIMITS.courseCode
					},
					topic: { type: 'string', minLength: 1, maxLength: PRACTICE_TEXT_LIMITS.topic },
					front: {
						type: 'string',
						minLength: 1,
						maxLength: PRACTICE_TEXT_LIMITS.flashcardFront
					},
					back: {
						type: 'string',
						minLength: 1,
						maxLength: PRACTICE_TEXT_LIMITS.flashcardBack
					},
					source: {
						type: 'object',
						additionalProperties: false,
						required: ['chunkId'],
						properties: {
							chunkId: {
								type: 'string',
								minLength: 1,
								maxLength: PRACTICE_TEXT_LIMITS.chunkId
							}
						}
					}
				}
			}
		}
	}
} as const;

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
	return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
	return typeof v === 'number' && Number.isFinite(v);
}

export function validateGenerateRequest(body: unknown): GenerateRequest {
	if (!isRecord(body)) {
		throw new ValidationError('Request body must be a JSON object');
	}
	const { courseId, topic, materialIds } = body;
	if (!isString(courseId) || courseId.trim().length === 0) {
		throw new ValidationError('courseId is required and must be a non-empty string');
	}
	if (topic !== undefined && !isString(topic)) {
		throw new ValidationError('topic must be a string');
	}
	const normalizedTopic = isString(topic) ? topic.trim() : '';
	if (normalizedTopic.length > 200) {
		throw new ValidationError('topic must be 200 characters or fewer');
	}
	let normalizedMaterialIds: string[] | undefined;
	if (materialIds !== undefined) {
		if (!Array.isArray(materialIds) || materialIds.length < 1 || materialIds.length > 8) {
			throw new ValidationError('materialIds must contain 1 to 8 material ids');
		}
		normalizedMaterialIds = materialIds.map((value) => {
			if (!isString(value) || value.trim().length === 0) {
				throw new ValidationError('each materialId must be a non-empty string');
			}
			return value.trim();
		});
		if (new Set(normalizedMaterialIds).size !== normalizedMaterialIds.length) {
			throw new ValidationError('materialIds must not contain duplicates');
		}
	}
	return {
		courseId: courseId.trim(),
		...(normalizedTopic ? { topic: normalizedTopic } : {}),
		...(normalizedMaterialIds ? { materialIds: normalizedMaterialIds } : {})
	};
}

function validateSource(v: unknown, validSources: Map<string, MaterialSource>): MaterialSource {
	if (!isRecord(v)) throw new ValidationError('source must be an object');
	const { chunkId } = v;
	if (!isString(chunkId) || chunkId.length === 0) {
		throw new ValidationError('source.chunkId must be a non-empty string');
	}
	const source = validSources.get(chunkId);
	if (!source) {
		throw new ValidationError(`source.chunkId "${chunkId}" not found in selected context`);
	}
	return source;
}

function validateQuestion(
	v: unknown,
	idx: number,
	validSources: Map<string, MaterialSource>,
	expectedCourseCode: string
): PracticeQuestion {
	if (!isRecord(v)) throw new ValidationError(`questions[${idx}] must be an object`);
	const { id, courseCode, topic, question, options, correctIndex, explanation, source } = v;
	if (!isString(id) || id.length === 0) throw new ValidationError(`questions[${idx}].id required`);
	if (!isString(courseCode) || courseCode.length === 0)
		throw new ValidationError(`questions[${idx}].courseCode required`);
	if (courseCode !== expectedCourseCode)
		throw new ValidationError(`questions[${idx}].courseCode does not match selected course`);
	if (!isString(topic) || topic.length === 0)
		throw new ValidationError(`questions[${idx}].topic required`);
	if (!isString(question) || question.length === 0)
		throw new ValidationError(`questions[${idx}].question required`);
	if (!Array.isArray(options) || options.length !== 4 || !options.every(isString))
		throw new ValidationError(`questions[${idx}].options must be an array of 4 non-empty strings`);
	for (const o of options) {
		if (o.trim().length === 0)
			throw new ValidationError(`questions[${idx}].options contains empty option`);
	}
	if (
		!isNumber(correctIndex) ||
		correctIndex < 0 ||
		correctIndex > 3 ||
		!Number.isInteger(correctIndex)
	)
		throw new ValidationError(`questions[${idx}].correctIndex must be an integer 0-3`);
	if (!isString(explanation) || explanation.length === 0)
		throw new ValidationError(`questions[${idx}].explanation required`);

	return {
		id,
		courseCode,
		topic,
		question,
		options: options as [string, string, string, string],
		correctIndex: correctIndex as 0 | 1 | 2 | 3,
		explanation,
		source: validateSource(source, validSources)
	};
}

function validateFlashcard(
	v: unknown,
	idx: number,
	validSources: Map<string, MaterialSource>,
	expectedCourseCode: string
): PracticeFlashcard {
	if (!isRecord(v)) throw new ValidationError(`flashcards[${idx}] must be an object`);
	const { id, courseCode, topic, front, back, source } = v;
	if (!isString(id) || id.length === 0) throw new ValidationError(`flashcards[${idx}].id required`);
	if (!isString(courseCode) || courseCode.length === 0)
		throw new ValidationError(`flashcards[${idx}].courseCode required`);
	if (courseCode !== expectedCourseCode)
		throw new ValidationError(`flashcards[${idx}].courseCode does not match selected course`);
	if (!isString(topic) || topic.length === 0)
		throw new ValidationError(`flashcards[${idx}].topic required`);
	if (!isString(front) || front.length === 0)
		throw new ValidationError(`flashcards[${idx}].front required`);
	if (!isString(back) || back.length === 0)
		throw new ValidationError(`flashcards[${idx}].back required`);

	return {
		id,
		courseCode,
		topic,
		front,
		back,
		source: validateSource(source, validSources)
	};
}

export function validatePracticeResponse(
	data: unknown,
	validSources: Map<string, MaterialSource>,
	expectedCourseCode: string
): GenerateResponse {
	if (!isRecord(data)) throw new ValidationError('Response must be a JSON object');

	const { questions, flashcards } = data;

	if (!Array.isArray(questions)) throw new ValidationError('questions must be an array');
	if (questions.length !== 5) throw new ValidationError('exactly 5 questions expected');

	if (!Array.isArray(flashcards)) throw new ValidationError('flashcards must be an array');
	if (flashcards.length !== 8) throw new ValidationError('exactly 8 flashcards expected');

	return {
		questions: questions.map((q, i) => validateQuestion(q, i, validSources, expectedCourseCode)),
		flashcards: flashcards.map((f, i) => validateFlashcard(f, i, validSources, expectedCourseCode))
	};
}
