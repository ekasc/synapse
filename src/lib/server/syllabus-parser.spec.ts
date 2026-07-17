import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { extractTextFromPdf } from './syllabus-parser';

describe('extractTextFromPdf', () => {
	it('extracts a real PDF from Uint8Array data without configuring a browser worker URL', async () => {
		const bytes = await readFile('docs/database-diagram.pdf');
		const file = new File([new Uint8Array(bytes)], 'database-diagram.pdf', {
			type: 'application/pdf'
		});

		await expect(extractTextFromPdf(file)).resolves.toEqual(expect.any(String));
	});
});
