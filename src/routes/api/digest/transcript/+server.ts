import { json, type RequestEvent } from '@sveltejs/kit';
import { analyzeTranscriptFile } from '$lib/server/digest-analytics';
import { getCourses, getSemesters, saveAcademicDigest } from '$lib/server/store';

function fallbackFileName(value: FormDataEntryValue | null): string {
	if (value instanceof File && value.name.trim()) return value.name.trim();
	return 'Uploaded transcript';
}

export async function POST({ request }: RequestEvent) {
	const form = await request.formData();
	const transcript = form.get('transcript');
	const fileName = fallbackFileName(transcript);
	const analysis =
		transcript instanceof File
			? await analyzeTranscriptFile(transcript, getCourses(), getSemesters())
			: undefined;
	const digest = saveAcademicDigest({
		fileName,
		source: 'transcript-upload',
		analysis
	});

	return json({ ok: true, digest });
}
