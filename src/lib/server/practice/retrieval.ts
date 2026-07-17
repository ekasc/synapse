import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import type { MaterialChunk } from './material-index';

const pdfjsGlobal = globalThis as typeof globalThis & {
	pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
};
pdfjsGlobal.pdfjsWorker ??= { WorkerMessageHandler };

export const CHUNK_SIZE = 2000;
export const CHUNK_OVERLAP = 200;
export const TOTAL_BUDGET = 30_000;
export const MAX_MATERIALS = 8;
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

export type TextChunk = {
	id?: string;
	text: string;
	source: {
		materialId: string;
		fileName: string;
		pageStart?: number;
		pageEnd?: number;
	};
};

export type ExtractedPage = {
	pageNumber: number | null;
	text: string;
};

export type ExtractionBatch = {
	pageCount: number;
	endPage: number;
	pages: ExtractedPage[];
};

export type MaterialContent = {
	id: string;
	fileName: string;
	mimeType: string;
	bytes: Uint8Array;
};

export async function extractPageBatch(
	content: Uint8Array,
	mimeType: string,
	startPage: number,
	batchSize: number
): Promise<ExtractionBatch> {
	if (mimeType === 'application/pdf') {
		const loadingTask = pdfjsLib.getDocument({ data: content.slice() });
		const doc = await loadingTask.promise;
		try {
			const endPage = Math.min(doc.numPages, startPage + batchSize - 1);
			const pages: ExtractedPage[] = [];
			for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
				const page = await doc.getPage(pageNumber);
				const textContent = await page.getTextContent();
				const items = textContent.items.filter(
					(item): item is typeof item & { str: string } => 'str' in item
				);
				pages.push({ pageNumber, text: items.map((item) => item.str).join(' ') });
			}
			return { pageCount: doc.numPages, endPage, pages };
		} finally {
			await loadingTask.destroy();
		}
	}

	if (startPage > 1) return { pageCount: 1, endPage: 1, pages: [] };
	const decoder = new TextDecoder('utf-8', { fatal: false });
	return {
		pageCount: 1,
		endPage: 1,
		pages: [{ pageNumber: null, text: decoder.decode(content) }]
	};
}

export function normalizeText(text: string): string {
	return text
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.replace(/\t+/g, ' ')
		.replace(/[^\S\n]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export async function extractText(content: Uint8Array, mimeType: string): Promise<string> {
	if (mimeType === 'application/pdf') {
		const doc = await pdfjsLib.getDocument({ data: content.slice() }).promise;
		let text = '';
		for (let i = 1; i <= doc.numPages; i++) {
			const page = await doc.getPage(i);
			const textContent = await page.getTextContent();
			const items = textContent.items.filter(
				(item): item is typeof item & { str: string } => 'str' in item
			);
			text += items.map((item) => item.str).join(' ') + '\n';
		}
		return text.trim();
	}

	const decoder = new TextDecoder('utf-8', { fatal: false });
	return decoder.decode(content);
}

export function splitChunks(
	text: string,
	source: { materialId: string; fileName: string }
): TextChunk[] {
	const normalized = normalizeText(text);
	if (normalized.length === 0) return [];

	const chunks: TextChunk[] = [];
	let start = 0;

	while (start < normalized.length) {
		let end = Math.min(start + CHUNK_SIZE, normalized.length);

		if (end < normalized.length && end - start === CHUNK_SIZE) {
			const breakChar = Math.max(
				normalized.lastIndexOf('\n\n', end),
				normalized.lastIndexOf('\n', end),
				normalized.lastIndexOf('. ', end),
				normalized.lastIndexOf(' ', end)
			);
			if (breakChar > start && breakChar < end) {
				end = breakChar + 1;
			}
		}

		const chunkText = normalized.slice(start, end).trim();
		if (chunkText.length > 0) {
			chunks.push({ text: chunkText, source });
		}

		if (end >= normalized.length) break;
		start = Math.max(start + 1, end - CHUNK_OVERLAP);
	}

	return chunks;
}

export function selectRepresentativeChunks(
	chunks: TextChunk[],
	totalBudget: number = TOTAL_BUDGET
): TextChunk[] {
	if (chunks.length === 0) return [];

	const perFile = new Map<string, TextChunk[]>();
	for (const chunk of chunks) {
		const key = chunk.source.materialId;
		if (!perFile.has(key)) perFile.set(key, []);
		perFile.get(key)!.push(chunk);
	}

	const selected: TextChunk[] = [];
	let remaining = totalBudget;

	const fileKeys = Array.from(perFile.keys());
	if (fileKeys.length === 1) {
		const fileChunks = perFile.get(fileKeys[0])!;
		for (const chunk of fileChunks) {
			const cost = chunk.text.length + 1;
			if (cost > remaining) break;
			if (selected.length === 0 || chunk.text !== selected[selected.length - 1].text) {
				selected.push(chunk);
				remaining -= cost;
			}
		}
		return selected;
	}

	const slots = Math.min(4, fileKeys.length);
	const selectedFileKeys = fileKeys.slice(0, slots);
	const budgetPerFile = Math.floor(remaining / selectedFileKeys.length);

	for (const key of selectedFileKeys) {
		const fileChunks = perFile.get(key)!;
		let fileBudget = budgetPerFile;
		for (const chunk of fileChunks) {
			const cost = chunk.text.length + 1;
			if (cost > fileBudget) break;
			if (selected.length === 0 || chunk.text !== selected[selected.length - 1].text) {
				selected.push(chunk);
				fileBudget -= cost;
				remaining -= cost;
			}
		}
	}

	if (remaining > 0 && fileKeys.length > slots) {
		for (let i = slots; i < fileKeys.length; i++) {
			const first = perFile.get(fileKeys[i])?.[0];
			if (!first) continue;
			const cost = first.text.length + 1;
			if (cost > remaining) break;
			selected.push(first);
			remaining -= cost;
		}
	}

	return selected;
}

export function chunksForExtractedPages(
	pages: ExtractedPage[],
	material: { id: string; courseId: string }
): MaterialChunk[] {
	const createdAt = new Date().toISOString();
	return pages.flatMap((page) => {
		const split = splitChunks(page.text, { materialId: material.id, fileName: '' });
		return split.map((chunk, localIndex) => {
			const pageKey = page.pageNumber ?? 0;
			const chunkIndex = pageKey * 1000 + localIndex;
			return {
				id: `${material.id}:p${pageKey}:c${localIndex}`,
				materialId: material.id,
				courseId: material.courseId,
				chunkIndex,
				pageStart: page.pageNumber,
				pageEnd: page.pageNumber,
				text: chunk.text,
				normalizedText: chunk.text.toLocaleLowerCase(),
				createdAt
			};
		});
	});
}

const STOP_WORDS = new Set([
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'for',
	'from',
	'in',
	'is',
	'of',
	'on',
	'or',
	'the',
	'to',
	'what',
	'with'
]);

function searchTokens(value: string): string[] {
	return Array.from(
		new Set(
			(value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
				(token) => token.length > 1 && !STOP_WORDS.has(token)
			)
		)
	);
}

function addWithinBudget(
	selected: MaterialChunk[],
	seen: Set<string>,
	chunk: MaterialChunk,
	remaining: { value: number }
) {
	const cost = chunk.text.length + 1;
	if (seen.has(chunk.id) || cost > remaining.value) return;
	selected.push(chunk);
	seen.add(chunk.id);
	remaining.value -= cost;
}

export function selectIndexedChunks(
	chunks: MaterialChunk[],
	topic = '',
	totalBudget: number = TOTAL_BUDGET
): MaterialChunk[] {
	if (chunks.length === 0 || totalBudget <= 0) return [];
	const selected: MaterialChunk[] = [];
	const seen = new Set<string>();
	const remaining = { value: totalBudget };
	const byMaterial = new Map<string, MaterialChunk[]>();
	for (const chunk of chunks) {
		const group = byMaterial.get(chunk.materialId) ?? [];
		group.push(chunk);
		byMaterial.set(chunk.materialId, group);
	}

	const trimmedTopic = topic.trim().toLocaleLowerCase();
	if (!trimmedTopic) {
		for (const group of byMaterial.values()) {
			const positions = Array.from(
				new Set([
					0,
					Math.floor(group.length / 4),
					Math.floor(group.length / 2),
					Math.floor((3 * group.length) / 4),
					group.length - 1
				])
			);
			for (const position of positions) addWithinBudget(selected, seen, group[position], remaining);
		}
		for (const chunk of chunks) addWithinBudget(selected, seen, chunk, remaining);
		return selected.sort((a, b) =>
			a.materialId === b.materialId
				? a.chunkIndex - b.chunkIndex
				: a.materialId.localeCompare(b.materialId)
		);
	}

	const tokens = searchTokens(trimmedTopic);
	if (tokens.length === 0) return [];
	const documentFrequency = new Map<string, number>();
	for (const token of tokens) {
		documentFrequency.set(
			token,
			chunks.reduce((count, chunk) => count + (chunk.normalizedText.includes(token) ? 1 : 0), 0)
		);
	}
	const scored = chunks
		.map((chunk) => {
			const exactPhrase = chunk.normalizedText.includes(trimmedTopic);
			let score = exactPhrase ? 100 : 0;
			let matchedTokens = 0;
			for (const token of tokens) {
				if (!chunk.normalizedText.includes(token)) continue;
				matchedTokens++;
				const frequency = documentFrequency.get(token) ?? chunks.length;
				score += 1 + Math.log((chunks.length + 1) / (frequency + 1));
			}
			const minimumMatches = tokens.length === 1 ? 1 : 2;
			return { chunk, score: exactPhrase || matchedTokens >= minimumMatches ? score : 0 };
		})
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex);

	if (scored.length === 0) return [];
	for (const { chunk } of scored.slice(0, 12)) {
		const group = byMaterial.get(chunk.materialId) ?? [];
		const position = group.findIndex((candidate) => candidate.id === chunk.id);
		if (position > 0) addWithinBudget(selected, seen, group[position - 1], remaining);
		addWithinBudget(selected, seen, chunk, remaining);
		if (position >= 0 && position < group.length - 1)
			addWithinBudget(selected, seen, group[position + 1], remaining);
	}
	return selected.sort((a, b) =>
		a.materialId === b.materialId
			? a.chunkIndex - b.chunkIndex
			: a.materialId.localeCompare(b.materialId)
	);
}

export function indexedChunksToContext(
	chunks: MaterialChunk[],
	fileNames: Map<string, string>
): TextChunk[] {
	return chunks.map((chunk) => ({
		id: chunk.id,
		text: chunk.text,
		source: {
			materialId: chunk.materialId,
			fileName: fileNames.get(chunk.materialId) ?? 'Course material',
			...(chunk.pageStart == null ? {} : { pageStart: chunk.pageStart }),
			...(chunk.pageEnd == null ? {} : { pageEnd: chunk.pageEnd })
		}
	}));
}

export function shouldSkipMaterial(mimeType: string): boolean {
	if (mimeType === 'application/pdf') return false;
	if (mimeType.startsWith('text/')) return false;
	return true;
}

export async function retrieveContext(materials: MaterialContent[]): Promise<TextChunk[]> {
	const allChunks: TextChunk[] = [];

	for (const material of materials) {
		const text = await extractText(material.bytes, material.mimeType);
		if (text.length === 0) continue;

		const chunks = splitChunks(text, {
			materialId: material.id,
			fileName: material.fileName
		});
		allChunks.push(...chunks);
	}

	return selectRepresentativeChunks(allChunks, TOTAL_BUDGET);
}
