import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { PDFParse } from 'pdf-parse';
import type { SyllabusExtractedData } from './store';

const FALLBACK_EXTRACTION: SyllabusExtractedData = {
	professor: {
		name: 'Not found',
		email: 'Not found',
		office: 'Not found',
		officeHours: 'Not found'
	},
	logistics: {
		classTime: 'Not found',
		room: 'Not found',
		attendance: 'Not found'
	},
	dates: [],
	grading: [],
	requiredMaterials: {
		textbookPdfUploaded: false
	},
	keyKnowledge: {
		source: 'summary + syllabus outline',
		topics: [],
		highlightedTopic: '',
		outline: []
	}
};

const syllabusSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['professor', 'logistics', 'dates', 'grading', 'requiredMaterials', 'keyKnowledge'],
	properties: {
		professor: {
			type: 'object',
			additionalProperties: false,
			required: ['name', 'email', 'office', 'officeHours'],
			properties: {
				name: { type: 'string' },
				email: { type: 'string' },
				office: { type: 'string' },
				officeHours: { type: 'string' }
			}
		},
		logistics: {
			type: 'object',
			additionalProperties: false,
			required: ['classTime', 'room', 'attendance'],
			properties: {
				classTime: { type: 'string' },
				room: { type: 'string' },
				attendance: { type: 'string' }
			}
		},
		dates: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['label', 'date', 'type', 'needsReview'],
				properties: {
					label: { type: 'string' },
					date: { type: 'string' },
					type: { type: 'string', enum: ['quiz', 'exam', 'deadline'] },
					needsReview: { type: 'boolean' }
				}
			}
		},
		grading: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['label', 'weight'],
				properties: {
					label: { type: 'string' },
					weight: { type: 'number' }
				}
			}
		},
		requiredMaterials: {
			type: 'object',
			additionalProperties: false,
			required: ['textbookTitle', 'textbookPdfUploaded', 'textbookPdfUrl'],
			properties: {
				textbookTitle: { type: 'string' },
				textbookPdfUploaded: { type: 'boolean' },
				textbookPdfUrl: { type: 'string' }
			}
		},
		keyKnowledge: {
			type: 'object',
			additionalProperties: false,
			required: ['source', 'topics', 'highlightedTopic', 'outline'],
			properties: {
				source: { type: 'string' },
				topics: { type: 'array', items: { type: 'string' } },
				highlightedTopic: { type: 'string' },
				outline: {
					type: 'array',
					items: {
						type: 'object',
						additionalProperties: false,
						required: ['range', 'topic'],
						properties: {
							range: { type: 'string' },
							topic: { type: 'string' }
						}
					}
				}
			}
		}
	}
} as const;

export async function extractTextFromPdf(file: File) {
	const buffer = Buffer.from(await file.arrayBuffer());
	const parser = new PDFParse({ data: buffer });
	try {
		const parsed = await parser.getText();
		return parsed.text.trim();
	} finally {
		await parser.destroy();
	}
}

export async function extractSyllabusWithAI(rawText: string): Promise<SyllabusExtractedData> {
	if (!env.OPENAI_API_KEY) {
		throw new Error('OPENAI_API_KEY is not set');
	}

	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	const completion = await client.chat.completions.create({
		model: env.OPENAI_SYLLABUS_MODEL || 'gpt-4.1-mini',
		messages: [
			{
				role: 'system',
				content:
					'You are a syllabus extraction agent. Extract only facts present in the syllabus. Do not invent missing values. Use "Not found" for missing strings, empty arrays for missing lists, and needsReview=true for uncertain dates.'
			},
			{
				role: 'user',
				content: `Extract student-useful syllabus details from this text. Keep dates in the syllabus wording when possible. Key knowledge must come from the course summary, description, learning outcomes, topic list, or weekly outline.\n\n${rawText}`
			}
		],
		response_format: {
			type: 'json_schema',
			json_schema: {
				name: 'syllabus_extraction',
				strict: true,
				schema: syllabusSchema
			}
		}
	});

	const content = completion.choices[0]?.message.content;
	if (!content) throw new Error('AI extraction returned no content');

	return normalizeExtraction(JSON.parse(content) as Partial<SyllabusExtractedData>);
}

export function normalizeExtraction(value: Partial<SyllabusExtractedData>): SyllabusExtractedData {
	return {
		professor: {
			name: value.professor?.name || FALLBACK_EXTRACTION.professor.name,
			email: value.professor?.email || FALLBACK_EXTRACTION.professor.email,
			office: value.professor?.office || FALLBACK_EXTRACTION.professor.office,
			officeHours: value.professor?.officeHours || FALLBACK_EXTRACTION.professor.officeHours
		},
		logistics: {
			classTime: value.logistics?.classTime || FALLBACK_EXTRACTION.logistics.classTime,
			room: value.logistics?.room || FALLBACK_EXTRACTION.logistics.room,
			attendance: value.logistics?.attendance || FALLBACK_EXTRACTION.logistics.attendance
		},
		dates: Array.isArray(value.dates)
			? value.dates
					.filter((date) => date.label && date.date)
					.map((date) => ({
						label: date.label,
						date: date.date,
						type: date.type === 'quiz' || date.type === 'exam' ? date.type : 'deadline',
						needsReview: Boolean(date.needsReview)
					}))
			: [],
		grading: Array.isArray(value.grading)
			? value.grading
					.filter((grade) => grade.label && Number.isFinite(grade.weight))
					.map((grade) => ({ label: grade.label, weight: grade.weight }))
			: [],
		requiredMaterials: {
			textbookTitle: value.requiredMaterials?.textbookTitle || '',
			textbookPdfUploaded: false,
			textbookPdfUrl: ''
		},
		keyKnowledge: {
			source: value.keyKnowledge?.source || FALLBACK_EXTRACTION.keyKnowledge.source,
			topics: Array.isArray(value.keyKnowledge?.topics) ? value.keyKnowledge.topics : [],
			highlightedTopic:
				value.keyKnowledge?.highlightedTopic || value.keyKnowledge?.topics?.[0] || '',
			outline: Array.isArray(value.keyKnowledge?.outline)
				? value.keyKnowledge.outline.filter((row) => row.range && row.topic)
				: []
		}
	};
}
