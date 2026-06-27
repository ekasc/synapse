import { json, type RequestEvent } from '@sveltejs/kit';
import { analyzeTranscriptFile } from '$lib/server/digest-analytics';
import { getCourses, getSemesters, saveAcademicDigest } from '$lib/server/store';

const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024; // 20 MB

function fallbackFileName(value: FormDataEntryValue | null): string {
	if (value instanceof File && value.name.trim()) return value.name.trim();
	return 'Uploaded transcript';
}

export async function POST({ request }: RequestEvent) {
	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (Number.isFinite(contentLength) && contentLength > MAX_TRANSCRIPT_BYTES) {
		return json(
			{
				ok: false,
				error: `Transcript too large. Limit is ${MAX_TRANSCRIPT_BYTES / (1024 * 1024)} MB.`
			},
			{ status: 413 }
		);
	}

	const form = await request.formData();
	const transcript = form.get('transcript');
	if (transcript instanceof File && transcript.size > MAX_TRANSCRIPT_BYTES) {
		return json(
			{
				ok: false,
				error: `Transcript too large. Limit is ${MAX_TRANSCRIPT_BYTES / (1024 * 1024)} MB.`
			},
			{ status: 413 }
		);
	}
	const fileName = fallbackFileName(transcript);
	const analysis =
		transcript instanceof File
			? await analyzeTranscriptFile(transcript, await getCourses(), await getSemesters())
			: undefined;
	const digest = saveAcademicDigest({
		fileName,
		source: 'transcript-upload',
		analysis
	});

	return json({ ok: true, digest });
}
