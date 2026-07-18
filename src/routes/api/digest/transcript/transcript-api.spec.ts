import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	analyzeTranscriptFile,
	createAcademicDigestJob,
	getCourses,
	getSemesters,
	saveAcademicDigest,
	updateAcademicDigestJob
} = vi.hoisted(() => ({
	analyzeTranscriptFile: vi.fn(),
	createAcademicDigestJob: vi.fn(),
	getCourses: vi.fn(),
	getSemesters: vi.fn(),
	saveAcademicDigest: vi.fn(),
	updateAcademicDigestJob: vi.fn()
}));

vi.mock('$lib/server/digest-analytics', () => ({ analyzeTranscriptFile }));
vi.mock('$lib/server/store', () => ({
	createAcademicDigestJob,
	getCourses,
	getSemesters,
	saveAcademicDigest,
	updateAcademicDigestJob
}));

import { POST } from './+server';

describe('POST /api/digest/transcript', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCourses.mockResolvedValue([]);
		getSemesters.mockResolvedValue([]);
		analyzeTranscriptFile.mockResolvedValue({ courses: [], trend: [] });
		updateAcademicDigestJob.mockResolvedValue(null);
	});

	it('returns a job immediately and processes the digest in the background', async () => {
		const job = {
			id: 'digest-job-1',
			fileName: 'transcript.pdf',
			status: 'queued',
			error: null
		};
		createAcademicDigestJob.mockResolvedValue(job);
		let background: Promise<unknown> | undefined;

		const form = new FormData();
		form.append(
			'transcript',
			new File(['transcript'], 'transcript.pdf', { type: 'application/pdf' })
		);
		const request = new Request('http://localhost/api/digest/transcript', {
			method: 'POST',
			body: form
		});

		const response = await POST({
			request,
			platform: { ctx: { waitUntil: (promise: Promise<unknown>) => (background = promise) } }
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ ok: true, job });
		expect(background).toBeDefined();
		await background;
		expect(updateAcademicDigestJob).toHaveBeenNthCalledWith(1, job.id, {
			status: 'processing'
		});
		expect(saveAcademicDigest).toHaveBeenCalledWith({
			fileName: 'transcript.pdf',
			source: 'transcript-upload',
			analysis: { courses: [], trend: [] }
		});
		expect(updateAcademicDigestJob).toHaveBeenNthCalledWith(2, job.id, {
			status: 'completed'
		});
	});
});
