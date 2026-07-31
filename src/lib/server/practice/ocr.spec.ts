import { describe, expect, it, vi } from 'vitest';
import { transcribePageImage } from './ocr';

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
	return {
		ok,
		status,
		json: async () => payload
	} as unknown as Response;
}

describe('transcribePageImage', () => {
	it('returns the trimmed transcription', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ choices: [{ message: { content: '  Chapter 1\nEvents are logged.\n' } }] })
		);

		const text = await transcribePageImage('QUJD', 'image/jpeg', {
			apiKey: 'key',
			model: 'vision-model',
			fetchImpl
		});

		expect(text).toBe('Chapter 1\nEvents are logged.');
	});

	it('sends a vision request with the embedded data url and configured model', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ choices: [{ message: { content: 'text' } }] })
		);

		await transcribePageImage('QUJD', 'image/jpeg', {
			apiKey: 'key-123',
			model: 'vision-model',
			fetchImpl
		});

		expect(fetchImpl).toHaveBeenCalledOnce();
		const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit | undefined];
		expect(String(url)).toContain('openrouter.ai');
		const headers = (init as RequestInit).headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer key-123');
		const body = JSON.parse((init as RequestInit).body as string) as {
			model: string;
			messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
		};
		expect(body.model).toBe('vision-model');
		const imagePart = body.messages[0].content.find((part) => part.type === 'image_url');
		expect(imagePart?.image_url?.url).toBe('data:image/jpeg;base64,QUJD');
	});

	it("returns '' when the page has no readable text", async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ choices: [{ message: { content: '[NO TEXT]' } }] })
		);

		const text = await transcribePageImage('QUJD', 'image/jpeg', {
			apiKey: 'key',
			model: 'vision-model',
			fetchImpl
		});

		expect(text).toBe('');
	});

	it("returns '' when the model returns no content", async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ choices: [{ message: {} }] }));

		const text = await transcribePageImage('QUJD', 'image/jpeg', {
			apiKey: 'key',
			model: 'vision-model',
			fetchImpl
		});

		expect(text).toBe('');
	});

	it('throws with the OpenRouter error message on failure', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ error: { message: 'model not found' } }, false, 404)
		);

		await expect(
			transcribePageImage('QUJD', 'image/jpeg', {
				apiKey: 'key',
				model: 'vision-model',
				fetchImpl
			})
		).rejects.toThrow('model not found');
	});
});
