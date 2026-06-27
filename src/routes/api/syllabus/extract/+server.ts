import { json, type RequestEvent } from '@sveltejs/kit';
import { mockExtractSyllabus, saveSyllabusImport } from '$lib/server/store';
import { extractSyllabusWithAI, extractTextFromPdf } from '$lib/server/syllabus-parser';

const MAX_SYLLABUS_BYTES = 20 * 1024 * 1024; // 20 MB

function getFileName(value: unknown) {
	if (typeof value !== 'object' || value === null) return 'CSIS 4495 Syllabus.pdf';
	const fileName = (value as { fileName?: unknown }).fileName;
	return typeof fileName === 'string' && fileName.trim()
		? fileName.trim()
		: 'CSIS 4495 Syllabus.pdf';
}

function getCourseId(value: unknown) {
	if (typeof value !== 'object' || value === null) return undefined;
	const courseId = (value as { courseId?: unknown }).courseId;
	return typeof courseId === 'string' && courseId.trim() ? courseId.trim() : undefined;
}

export async function POST({ request }: RequestEvent) {
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('multipart/form-data')) {
		const contentLength = Number(request.headers.get('content-length') ?? 0);
		if (Number.isFinite(contentLength) && contentLength > MAX_SYLLABUS_BYTES) {
			return json(
				{ ok: false, error: `PDF too large. Limit is ${MAX_SYLLABUS_BYTES / (1024 * 1024)} MB.` },
				{ status: 413 }
			);
		}

		const form = await request.formData();
		const file = form.get('file');
		const courseId = form.get('courseId');
		if (!(file instanceof File)) {
			return json({ ok: false, error: 'Missing syllabus PDF' }, { status: 400 });
		}
		if (file.size > MAX_SYLLABUS_BYTES) {
			return json(
				{ ok: false, error: `PDF too large. Limit is ${MAX_SYLLABUS_BYTES / (1024 * 1024)} MB.` },
				{ status: 413 }
			);
		}

		try {
			const rawText = await extractTextFromPdf(file);
			const extractedData = await extractSyllabusWithAI(rawText);
			return json(
				saveSyllabusImport({
					courseId: typeof courseId === 'string' ? courseId : undefined,
					fileName: file.name,
					rawText,
					extractedData,
					status: 'ready'
				})
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Could not extract syllabus';
			return json({ ok: false, error: message }, { status: 500 });
		}
	}

	const body: unknown = await request.json().catch(() => ({}));
	return json(mockExtractSyllabus(getFileName(body), getCourseId(body)));
}
