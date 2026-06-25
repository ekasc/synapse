import { json, type RequestEvent } from '@sveltejs/kit';
import { mockExtractSyllabus, saveSyllabusImport } from '$lib/server/store';
import { extractSyllabusWithAI, extractTextFromPdf } from '$lib/server/syllabus-parser';

function getFileName(value: unknown) {
	if (typeof value !== 'object' || value === null) return 'CSIS 4495 Syllabus.pdf';
	const fileName = (value as { fileName?: unknown }).fileName;
	return typeof fileName === 'string' && fileName.trim()
		? fileName.trim()
		: 'CSIS 4495 Syllabus.pdf';
}

export async function POST({ request }: RequestEvent) {
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File)) {
			return json({ ok: false, error: 'Missing syllabus PDF' }, { status: 400 });
		}

		try {
			const rawText = await extractTextFromPdf(file);
			const extractedData = await extractSyllabusWithAI(rawText);
			return json(
				saveSyllabusImport({
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
	return json(mockExtractSyllabus(getFileName(body)));
}
