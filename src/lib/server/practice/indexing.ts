import type { MaterialRecord } from '$lib/server/r2';
import {
	PDF_BATCH_SIZE,
	PDF_PAGE_LIMIT,
	type MaterialIndexRecord,
	type MaterialIndexRepository
} from './material-index';
import { chunksForExtractedPages, extractPageBatch } from './retrieval';
import { indexChunksSemantically, type SemanticPipeline } from './embeddings';

export function safeExtractionError(cause: unknown): string {
	const message = cause instanceof Error ? cause.message.toLocaleLowerCase() : '';
	if (message.includes('password')) return 'This PDF is password protected.';
	if (message.includes('invalid pdf') || message.includes('missing pdf'))
		return 'This PDF could not be read.';
	return 'Text extraction failed. Retry indexing or upload a different file.';
}

export type IndexBatchInput = {
	repository: MaterialIndexRepository;
	userId: string;
	material: Pick<MaterialRecord, 'id' | 'courseId' | 'mimeType' | 'fileName'>;
	bytes: Uint8Array;
	pipeline?: SemanticPipeline | null;
};

// Runs one bounded extraction batch for a material and persists its chunks.
// Extraction failures throw with the raw error; callers map them through
// safeExtractionError before surfacing user-facing messages.
export async function runMaterialIndexBatch(input: IndexBatchInput): Promise<MaterialIndexRecord> {
	const { repository, userId, material, bytes } = input;
	const index = await repository.setStatus(userId, material.id, material.courseId, 'indexing');
	const mimeType =
		material.mimeType === 'application/pdf' || material.fileName.toLowerCase().endsWith('.pdf')
			? 'application/pdf'
			: material.mimeType;
	const batch = await extractPageBatch(bytes, mimeType, index.nextPage, PDF_BATCH_SIZE);
	if (batch.pageCount > PDF_PAGE_LIMIT) {
		return repository.setStatus(userId, material.id, material.courseId, 'too_large', {
			pageCount: batch.pageCount,
			errorMessage: `PDFs are limited to ${PDF_PAGE_LIMIT.toLocaleString()} pages.`
		});
	}

	const chunks = chunksForExtractedPages(batch.pages, {
		id: material.id,
		courseId: material.courseId
	});
	const characterCount =
		index.characterCount + chunks.reduce((total, chunk) => total + chunk.text.length, 0);
	const complete = batch.endPage >= batch.pageCount;
	const status = complete ? (characterCount === 0 ? 'needs_ocr' : 'ready') : 'indexing';
	const saved = await repository.saveBatch(userId, {
		materialId: material.id,
		courseId: material.courseId,
		pageCount: batch.pageCount,
		nextPage: complete ? batch.pageCount + 1 : batch.endPage + 1,
		characterCount,
		status,
		chunks
	});
	await indexChunksSemantically(input.pipeline ?? null, chunks);
	return saved;
}
