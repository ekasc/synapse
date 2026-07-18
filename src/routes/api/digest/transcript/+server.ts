import { json, type RequestEvent } from '@sveltejs/kit';
import { analyzeTranscriptFile } from '$lib/server/digest-analytics';
import {
	createAcademicDigestJob,
	getCourses,
	getSemesters,
	saveAcademicDigest,
	updateAcademicDigestJob
} from '$lib/server/store';

const MAX_TRANSCRIPT_BYTES = 20 * 1024 * 1024; // 20 MB

function fallbackFileName(value: FormDataEntryValue | null): string {
	if (value instanceof File && value.name.trim()) return value.name.trim();
	return 'Uploaded transcript';
}

async function processTranscript(jobId: string, transcript: File, fileName: string) {
	try {
		await updateAcademicDigestJob(jobId, { status: 'processing' });
		const analysis = await analyzeTranscriptFile(
			transcript,
			await getCourses(),
			await getSemesters()
		);
		await saveAcademicDigest({ fileName, source: 'transcript-upload', analysis });
		await updateAcademicDigestJob(jobId, { status: 'completed' });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Transcript digestion failed';
		await updateAcademicDigestJob(jobId, { status: 'failed', error: message });
	}
}

export async function POST({ request, platform }: RequestEvent) {
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
	if (!(transcript instanceof File)) {
		return json({ ok: false, error: 'Choose a transcript file to upload.' }, { status: 400 });
	}

	let job;
	try {
		job = await createAcademicDigestJob(fileName);
	} catch (error) {
		console.error('Could not create transcript digestion job:', error);
		return json(
			{
				ok: false,
				error: 'Could not start transcript digestion. Check that database migrations are current.'
			},
			{ status: 500 }
		);
	}
	const processing = processTranscript(job.id, transcript, fileName);
	if (typeof platform?.ctx?.waitUntil === 'function') platform.ctx.waitUntil(processing);
	else void processing;

	return json({ ok: true, job }, { status: 202 });
}
