import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { extractTextFromPdf } from './syllabus-parser';
import type {
	AcademicDigestAnalysis,
	AcademicDigestTrend,
	AcademicTranscriptCourse,
	Course,
	Semester
} from './store';

type ExtractedTranscript = {
	courses?: Partial<AcademicTranscriptCourse>[];
	insights?: string[];
};

export type TranscriptAnalysis = AcademicDigestAnalysis;

const termOrder = ['Spring', 'Summer', 'Fall'];

function percentToGpa(percent: number): number {
	if (percent >= 93) return 4;
	if (percent >= 90) return 3.7;
	if (percent >= 87) return 3.3;
	if (percent >= 83) return 3;
	if (percent >= 80) return 2.7;
	if (percent >= 77) return 2.3;
	if (percent >= 73) return 2;
	if (percent >= 70) return 1.7;
	if (percent >= 67) return 1.3;
	if (percent >= 60) return 1;
	return 0;
}

function percentToLetter(percent: number): string {
	if (percent >= 93) return 'A';
	if (percent >= 90) return 'A-';
	if (percent >= 87) return 'B+';
	if (percent >= 83) return 'B';
	if (percent >= 80) return 'B-';
	if (percent >= 77) return 'C+';
	if (percent >= 73) return 'C';
	if (percent >= 70) return 'C-';
	if (percent >= 67) return 'D+';
	if (percent >= 60) return 'D';
	return 'F';
}

function clampPercent(value: number | undefined, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(0, Math.min(100, Number(value)));
}

function weightedGpa(courses: AcademicTranscriptCourse[], field: 'currentPercent' | 'projectedPercent') {
	const totals = courses.reduce(
		(acc, course) => {
			const credits = course.credits || 3;
			acc.points += percentToGpa(course[field]) * credits;
			acc.credits += credits;
			return acc;
		},
		{ points: 0, credits: 0 }
	);

	return totals.credits > 0 ? Number((totals.points / totals.credits).toFixed(2)) : 0;
}

function labelForTerm(term: string): string {
	const [season, year] = term.split(/\s+/);
	const shortSeason = season === 'Summer' ? 'SU' : season?.slice(0, 1).toUpperCase();
	return `${shortSeason}${year?.slice(-2) ?? ''}`;
}

function sortTerm(a: string, b: string) {
	const [aSeason, aYear] = a.split(/\s+/);
	const [bSeason, bYear] = b.split(/\s+/);
	const yearDiff = Number(aYear) - Number(bYear);
	if (yearDiff !== 0) return yearDiff;
	return termOrder.indexOf(aSeason) - termOrder.indexOf(bSeason);
}

function normalizeCourse(value: Partial<AcademicTranscriptCourse>, index: number) {
	const code = value.code?.trim() || `COURSE ${index + 1}`;
	const status = value.status === 'current' ? 'current' : 'finished';
	const letter = value.letter?.trim() || '';
	const currentRaw = Number(value.currentPercent);
	const projectedRaw = Number(value.projectedPercent);
	const missingCurrent =
		!Number.isFinite(currentRaw) || (currentRaw <= 0 && letter.toUpperCase() !== 'F');
	const missingProjected =
		!Number.isFinite(projectedRaw) || (projectedRaw <= 0 && letter.toUpperCase() !== 'F');
	const currentPercent = missingCurrent
		? status === 'current'
			? 88
			: clampPercent(projectedRaw, 88)
		: clampPercent(currentRaw, 88);
	const projectedPercent = missingProjected ? currentPercent : clampPercent(projectedRaw, currentPercent);

	return {
		id: value.id?.trim() || `${status}-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
		code,
		name: value.name?.trim() || code,
		term: value.term?.trim() || 'Imported term',
		credits: Number.isFinite(value.credits) && value.credits ? Number(value.credits) : 3,
		currentPercent,
		projectedPercent,
		status,
		letter: letter || percentToLetter(projectedPercent)
	} satisfies AcademicTranscriptCourse;
}

function coursesFromSetup(courses: Course[], semesters: Semester[]) {
	return courses.map((course, index) => {
		const semester = semesters.find((item) => item.id === course.semesterId);
		const currentPercent = clampPercent(course.signals?.currentGrade, 86 + (index % 5));
		const projectedPercent = clampPercent(course.signals?.projectedGrade, Math.min(96, currentPercent + 1));

		return normalizeCourse(
			{
				id: course.id,
				code: course.code,
				name: course.name,
				term: semester ? `${semester.term} ${semester.year}` : 'Imported term',
				credits: course.credits ?? 3,
				currentPercent,
				projectedPercent,
				status: 'current'
			},
			index
		);
	});
}

function buildTrend(courses: AcademicTranscriptCourse[]): AcademicDigestTrend[] {
	let cumulative: AcademicTranscriptCourse[] = [];
	return Array.from(new Set(courses.map((course) => course.term)))
		.sort(sortTerm)
		.map((term) => {
			const termCourses = courses.filter((course) => course.term === term);
			cumulative = [...cumulative, ...termCourses];
			return {
				label: labelForTerm(term),
				term,
				gpa: weightedGpa(cumulative, 'currentPercent'),
				credits: cumulative.reduce((sum, course) => sum + course.credits, 0),
				note: termCourses.some((course) => course.status === 'current')
					? 'Current projection'
					: 'Transcript history'
			};
		});
}

function buildAnalysis(
	courses: AcademicTranscriptCourse[],
	insights: string[],
	extractionSource: TranscriptAnalysis['extractionSource']
): TranscriptAnalysis {
	const currentCourses = courses.filter((course) => course.status === 'current');
	const finishedCourses = courses.filter((course) => course.status === 'finished');

	return {
		courses,
		trend: buildTrend(courses),
		insights,
		totalGpa: weightedGpa(courses, 'currentPercent'),
		projectedGpa: weightedGpa(courses, 'projectedPercent'),
		currentCourseCount: currentCourses.length,
		finishedCourseCount: finishedCourses.length,
		currentCredits: currentCourses.reduce((sum, course) => sum + course.credits, 0),
		finishedCredits: finishedCourses.reduce((sum, course) => sum + course.credits, 0),
		extractionSource
	};
}

function fallbackAnalysis(courses: Course[], semesters: Semester[], reason?: string): TranscriptAnalysis {
	const transcriptCourses = courses.length > 0 ? coursesFromSetup(courses, semesters) : [];
	const fallbackReason =
		reason === 'OPENROUTER_API_KEY is not set'
			? 'AI transcript extraction needs OPENROUTER_API_KEY in .env.'
			: reason
				? `AI transcript extraction was unavailable: ${reason}.`
				: 'AI transcript extraction was unavailable.';
	return buildAnalysis(
		transcriptCourses,
		[
			transcriptCourses.length > 0
				? `${fallbackReason} Showing backend analytics from setup courses.`
				: 'No academic history has been imported yet.'
		],
		'fallback'
	);
}

async function textFromFile(file: File) {
	if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
		return extractTextFromPdf(file);
	}

	if (file.type.startsWith('text/') || /\.(csv|txt)$/i.test(file.name)) {
		return file.text();
	}

	return '';
}

async function extractWithOpenRouter(file: File): Promise<ExtractedTranscript> {
	if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
	const isImage = file.type.startsWith('image/');

	const client = new OpenAI({
		baseURL: 'https://openrouter.ai/api/v1',
		apiKey: env.OPENROUTER_API_KEY,
		defaultHeaders: {
			'HTTP-Referer': 'http://127.0.0.1:5173',
			'X-Title': 'Synapse Academic Progress'
		}
	});

	const rawText = await textFromFile(file);
	const content: OpenAI.Chat.Completions.ChatCompletionMessageParam['content'] =
		rawText.length > 0
			? `Extract transcript courses from this text:\n\n${rawText.slice(0, 30000)}`
			: [
					{
						type: 'text' as const,
						text: 'Extract transcript courses from this image. Include only visible courses, terms, credits, grades, and whether each course is current or finished.'
					},
					{
						type: 'image_url' as const,
						image_url: {
							url: `data:${file.type || 'image/png'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
						}
					}
				];

	const request = {
		messages: [
			{
				role: 'system',
				content:
					'You are an academic transcript extraction agent. Return only facts visible in the transcript. Use current for in-progress courses and finished for courses with final grades. Convert letter grades to reasonable percent estimates only when no numeric percent is present.'
			},
			{
				role: 'user',
				content
			}
		],
		response_format: {
			type: 'json_schema',
			json_schema: {
				name: 'academic_transcript_extraction',
				strict: true,
				schema: {
					type: 'object',
					additionalProperties: false,
					required: ['courses', 'insights'],
					properties: {
						courses: {
							type: 'array',
							items: {
								type: 'object',
								additionalProperties: false,
								required: [
									'code',
									'name',
									'term',
									'credits',
									'currentPercent',
									'projectedPercent',
									'status',
									'letter'
								],
								properties: {
									code: { type: 'string' },
									name: { type: 'string' },
									term: { type: 'string' },
									credits: { type: 'number' },
									currentPercent: { type: 'number' },
									projectedPercent: { type: 'number' },
									status: { type: 'string', enum: ['current', 'finished'] },
									letter: { type: 'string' }
								}
							}
						},
						insights: { type: 'array', items: { type: 'string' } }
					}
				}
			}
		}
	} satisfies Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>;

	const primaryModel = env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
	const visionModel = env.OPENROUTER_VISION_MODEL || 'openai/gpt-4o-mini';
	let completion: OpenAI.Chat.Completions.ChatCompletion;
	try {
		completion = await client.chat.completions.create({
			model: primaryModel,
			...request
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (!isImage || primaryModel === visionModel || !message.includes('image input')) throw error;
		completion = await client.chat.completions.create({
			model: visionModel,
			...request
		});
	}

	const contentResult = completion.choices[0]?.message.content;
	if (!contentResult) throw new Error('AI transcript extraction returned no content');
	return JSON.parse(contentResult) as ExtractedTranscript;
}

export async function analyzeTranscriptFile(
	file: File,
	courses: Course[],
	semesters: Semester[]
): Promise<TranscriptAnalysis> {
	try {
		const extracted = await extractWithOpenRouter(file);
		const extractedCourses = extracted.courses
			?.map((course, index) => normalizeCourse(course, index))
			.filter((course) => course.code && course.term);

		if (!extractedCourses?.length) {
			return fallbackAnalysis(courses, semesters, 'no transcript courses were returned');
		}
		return buildAnalysis(
			extractedCourses,
			extracted.insights?.filter(Boolean) ?? ['Transcript was extracted with OpenRouter.'],
			'openrouter'
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown error';
		return fallbackAnalysis(courses, semesters, message);
	}
}

export function analyzeSetupCourses(courses: Course[], semesters: Semester[]): TranscriptAnalysis {
	if (courses.length === 0) return fallbackAnalysis(courses, semesters);
	return buildAnalysis(
		coursesFromSetup(courses, semesters),
		['Backend analytics digested imported setup courses.'],
		'fallback'
	);
}
