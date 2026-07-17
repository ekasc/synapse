import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
	chunksForExtractedPages,
	extractPageBatch,
	extractText,
	normalizeText,
	selectIndexedChunks,
	splitChunks,
	selectRepresentativeChunks,
	shouldSkipMaterial,
	CHUNK_SIZE,
	CHUNK_OVERLAP
} from './retrieval';

describe('PDF extraction', () => {
	it('processes PDF Uint8Array data without a browser worker URL', async () => {
		const bytes = new Uint8Array(await readFile('docs/database-diagram.pdf'));
		await expect(extractText(bytes, 'application/pdf')).resolves.toEqual(expect.any(String));
	});

	it('extracts a bounded page-aware batch', async () => {
		const bytes = new Uint8Array(await readFile('docs/database-diagram.pdf'));
		const batch = await extractPageBatch(bytes, 'application/pdf', 1, 1);
		expect(batch.pageCount).toBeGreaterThanOrEqual(1);
		expect(batch.endPage).toBe(1);
		expect(batch.pages[0]).toMatchObject({ pageNumber: 1 });
	});
});

describe('normalizeText', () => {
	it('replaces CRLF and CR with LF', () => {
		expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc');
	});

	it('collapses multiple spaces', () => {
		expect(normalizeText('a   b    c')).toBe('a b c');
	});

	it('collapses tabs into single space', () => {
		expect(normalizeText('a\t\tb')).toBe('a b');
	});

	it('collapses runs of 3+ newlines', () => {
		expect(normalizeText('a\n\n\n\nb')).toBe('a\n\nb');
	});

	it('trims leading and trailing whitespace', () => {
		expect(normalizeText('  hello world  ')).toBe('hello world');
	});

	it('handles empty string', () => {
		expect(normalizeText('')).toBe('');
	});
});

describe('indexed chunks', () => {
	function chunk(id: string, materialId: string, chunkIndex: number, text: string) {
		return {
			id,
			materialId,
			courseId: 'course-1',
			chunkIndex,
			pageStart: chunkIndex + 1,
			pageEnd: chunkIndex + 1,
			text,
			normalizedText: text.toLocaleLowerCase(),
			createdAt: '2026-01-01T00:00:00.000Z'
		};
	}

	it('creates stable page-aware chunk ids', () => {
		const chunks = chunksForExtractedPages(
			[{ pageNumber: 12, text: 'Linux event logging records system activity.' }],
			{ id: 'material-1', courseId: 'course-1' }
		);
		expect(chunks[0]).toMatchObject({
			id: 'material-1:p12:c0',
			chunkIndex: 12000,
			pageStart: 12,
			pageEnd: 12
		});
	});

	it('prefers exact topic passages and includes adjacent context', () => {
		const chunks = [
			chunk('c1', 'm1', 1, 'Background command line material'),
			chunk('c2', 'm1', 2, 'Linux event logging uses journalctl and files in var log'),
			chunk('c3', 'm1', 3, 'The next section discusses log rotation'),
			chunk('c4', 'm1', 4, 'Unrelated regular expressions')
		];
		const selected = selectIndexedChunks(chunks, 'Linux event logging', 10_000);
		expect(selected.map((item) => item.id)).toEqual(['c1', 'c2', 'c3']);
	});

	it('returns no passages when a topic has no lexical match', () => {
		const chunks = [chunk('c1', 'm1', 1, 'Regular expressions and shell variables')];
		expect(selectIndexedChunks(chunks, 'quantum mechanics')).toEqual([]);
	});

	it('samples the beginning, middle, and end for broad practice', () => {
		const chunks = Array.from({ length: 20 }, (_, index) =>
			chunk(`c${index}`, 'm1', index, `Passage ${index}`)
		);
		const selected = selectIndexedChunks(chunks, '', 10_000);
		expect(selected.map((item) => item.id)).toEqual(expect.arrayContaining(['c0', 'c10', 'c19']));
	});
});

describe('shouldSkipMaterial', () => {
	it('accepts PDF mimetype', () => {
		expect(shouldSkipMaterial('application/pdf')).toBe(false);
	});

	it('accepts text mimetypes', () => {
		expect(shouldSkipMaterial('text/plain')).toBe(false);
		expect(shouldSkipMaterial('text/markdown')).toBe(false);
		expect(shouldSkipMaterial('text/csv')).toBe(false);
	});

	it('skips image, video, audio, and other binary types', () => {
		expect(shouldSkipMaterial('image/png')).toBe(true);
		expect(shouldSkipMaterial('video/mp4')).toBe(true);
		expect(shouldSkipMaterial('audio/mp3')).toBe(true);
		expect(shouldSkipMaterial('application/zip')).toBe(true);
		expect(shouldSkipMaterial('application/json')).toBe(true);
	});
});

describe('splitChunks', () => {
	const source = { materialId: 'm1', fileName: 'test.txt' };

	it('returns empty array for empty text', () => {
		expect(splitChunks('', source)).toHaveLength(0);
	});

	it('returns single chunk for short text', () => {
		const chunks = splitChunks('Hello world', source);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toBe('Hello world');
		expect(chunks[0].source).toEqual(source);
	});

	it('terminates after emitting the final overlapping chunk', () => {
		const chunks = splitChunks('x'.repeat(CHUNK_SIZE + 100), source);
		expect(chunks).toHaveLength(2);
		expect(chunks[1].text.length).toBe(CHUNK_OVERLAP + 100);
	});

	it('splits long text into multiple chunks', () => {
		const longText = 'word '.repeat(CHUNK_SIZE + 500);
		const chunks = splitChunks(longText, source);
		expect(chunks.length).toBeGreaterThan(1);
	});

	it('overlaps chunks correctly', () => {
		const longText = Array.from({ length: CHUNK_SIZE + 500 }, (_, index) =>
			String.fromCharCode(97 + (index % 26))
		).join('');
		const chunks = splitChunks(longText, source);
		expect(chunks).toHaveLength(2);
		expect(chunks[0].text.slice(-CHUNK_OVERLAP)).toBe(chunks[1].text.slice(0, CHUNK_OVERLAP));
	});

	it('assigns same source to all chunks', () => {
		const longText = 'word '.repeat(CHUNK_SIZE + 500);
		const chunks = splitChunks(longText, source);
		for (const chunk of chunks) {
			expect(chunk.source).toEqual(source);
		}
	});
});

describe('selectRepresentativeChunks', () => {
	function makeChunk(text: string, materialId: string, fileName: string) {
		return { text, source: { materialId, fileName } };
	}

	it('returns empty for no chunks', () => {
		expect(selectRepresentativeChunks([])).toHaveLength(0);
	});

	it('returns all chunks if within budget', () => {
		const chunks = [
			makeChunk('short text', 'm1', 'a.txt'),
			makeChunk('another short', 'm1', 'a.txt')
		];
		const result = selectRepresentativeChunks(chunks, 10_000);
		expect(result).toHaveLength(2);
	});

	it('selects first chunk of each file within budget', () => {
		const chunks = [
			makeChunk('a'.repeat(500), 'm1', 'a.txt'),
			makeChunk('b'.repeat(500), 'm2', 'b.txt'),
			makeChunk('c'.repeat(500), 'm3', 'c.txt')
		];
		const result = selectRepresentativeChunks(chunks, 2000);
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	it('handles single-file input', () => {
		const chunks = [makeChunk('chunk one', 'm1', 'a.txt'), makeChunk('chunk two', 'm1', 'a.txt')];
		const result = selectRepresentativeChunks(chunks, 100);
		expect(result).toHaveLength(2);
	});

	it('distributes budget across up to 4 files', () => {
		const chunks = [];
		for (let i = 0; i < 6; i++) {
			chunks.push(makeChunk('chunk from file ' + i, `m${i}`, `f${i}.txt`));
		}
		const result = selectRepresentativeChunks(chunks, 10_000);
		const fileCount = new Set(result.map((c) => c.source.materialId)).size;
		expect(fileCount).toBe(6);
	});
});
