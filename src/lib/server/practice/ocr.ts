const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const EMPTY_MARKER = '[NO TEXT]';

export const MAX_OCR_IMAGE_BASE64_CHARS = 2_000_000;

export type TranscriptionOptions = {
	apiKey: string;
	model: string;
	fetchImpl?: typeof fetch;
};

// Transcribes one rendered PDF page image through an OpenRouter vision model.
// Returns '' when the page has no readable text so callers can keep the
// material in needs_ocr rather than indexing noise.
export async function transcribePageImage(
	imageBase64: string,
	imageMimeType: string,
	options: TranscriptionOptions
): Promise<string> {
	const fetchToUse = options.fetchImpl ?? fetch;
	const response = await fetchToUse(OPENROUTER_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${options.apiKey}`,
			'HTTP-Referer': 'https://synapse.app',
			'X-Title': 'Synapse Exam Prep'
		},
		body: JSON.stringify({
			model: options.model,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text:
								'Transcribe all readable text from this course document page image. ' +
								'Preserve reading order and paragraph breaks. Output only the transcribed text, ' +
								`with no commentary. If the page contains no readable text, output exactly ${EMPTY_MARKER}.`
						},
						{
							type: 'image_url',
							image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
						}
					]
				}
			],
			temperature: 0,
			max_tokens: 4096
		}),
		signal: AbortSignal.timeout(120_000)
	});

	if (!response.ok) {
		const errorPayload = await response.json().catch(() => ({}));
		const message = (errorPayload as Record<string, unknown>)?.error
			? ((errorPayload as Record<string, unknown>).error as Record<string, unknown>)?.message
			: null;
		throw new Error(
			typeof message === 'string' ? message : `OpenRouter returned ${response.status}`
		);
	}

	const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
	const content = data.choices?.[0]?.message?.content?.trim() ?? '';
	if (!content || content === EMPTY_MARKER) return '';
	return content;
}
