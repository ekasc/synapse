# Practice Material Indexing and Topic Retrieval

**Date:** 2026-07-16
**Owner:** Ekas — Exam Prep (RAG)
**Status:** Approved in conversation; implementation pending

## Goal

Practice must extract supported course materials once, persist page-aware chunks, and retrieve a bounded set of relevant passages for each generation. A user may leave the focus blank for broad coverage or enter a specific topic. Large PDFs must be processed incrementally rather than reparsed in the generation request.

## Scope

This implementation provides resumable, client-driven indexing without adding Cloudflare Queues, Workflows, Vectorize, or another deployment. It supports PDFs up to 1,000 pages and the existing 50 MB upload limit by processing a bounded page batch per request. Indexing automatically continues while the Materials page is open and resumes when the page is revisited.

Autonomous background indexing after the browser closes, OCR for scanned PDFs, semantic embeddings, and documents over 1,000 pages are follow-up work.

## User Experience

### Materials

After upload, each supported material shows one of:

- **Waiting to index**
- **Indexing · N of M pages**
- **Ready · M pages**
- **Needs OCR**
- **Unsupported**
- **Indexing failed · Retry**
- **Too large · 1,000-page limit**

The Materials page starts or resumes indexing and processes one bounded batch at a time. Closing the page pauses work safely; returning resumes from the last completed page. Upload success is independent of indexing success, so the original file remains downloadable if extraction fails.

### Practice

Practice adds one optional body-text input labeled **Focus on a topic**. Examples are terse metadata, not placeholder prose. A blank focus requests broad coverage across ready materials. A non-empty focus retrieves passages matching that topic.

Generation is enabled when at least one material is ready. If materials are still indexing, the page explains that Practice will use only ready materials and links to Materials. If no indexed passage matches the requested topic, the API returns a clear 422 response rather than silently generating unrelated questions.

Question and flashcard citations include the file and page or page range when available.

## Persistence

Migration `0010_practice_material_index.sql` adds two Exam Prep-owned tables.

### `practice_material_indexes`

- `material_id` primary key
- `course_id`
- `status`: `pending | indexing | ready | needs_ocr | unsupported | failed | too_large`
- `page_count`
- `next_page`
- `character_count`
- `error_message`
- `index_version`
- `created_at`
- `updated_at`

Indexes support course/status lookup. The index version allows deterministic re-indexing when extraction or chunking changes.

### `practice_material_chunks`

- `id` primary key
- `material_id`
- `course_id`
- `chunk_index`
- `page_start`
- `page_end`
- `text`
- `normalized_text`
- `created_at`

A unique index on `(material_id, chunk_index)` makes each processed batch idempotent. Course/material indexes support bounded retrieval and deletion.

D1 is authoritative in deployed Workers. The existing local filesystem fallback stores equivalent index metadata and chunks beneath `.data/practice-index` for local Vite development.

## Extraction Pipeline

1. Material upload stores the original object in R2 as today.
2. The upload endpoint creates a `pending` index record for PDFs and supported text files. Other MIME types are marked `unsupported`.
3. The Materials page calls `POST /api/courses/[courseId]/materials/[materialId]/index`.
4. The endpoint validates material/course ownership and reads the current index checkpoint.
5. PDF.js opens the original as a `Uint8Array` using the in-process `WorkerMessageHandler`.
6. The first batch records `numPages`. PDFs over 1,000 pages are marked `too_large` before text extraction.
7. Up to 25 pages are extracted per request. Text files are processed in one request.
8. Each page is normalized and split into approximately 2,000-character chunks without losing page provenance.
9. The batch writes chunks idempotently and advances `next_page` only after successful writes.
10. Empty documents are marked `needs_ocr`; completed documents become `ready`.

A failed batch keeps its last completed checkpoint. Retry resumes from that checkpoint instead of deleting successful work.

## Retrieval

`POST /api/practice/generate` accepts:

```json
{
  "courseId": "course-id",
  "topic": "Linux event logging"
}
```

`topic` is optional, trimmed, and limited to 200 characters.

### Broad coverage

When topic is blank, retrieval samples ready chunks across materials and across the beginning, middle, and end of each document. It remains bounded by the existing 30,000-character generation context budget.

### Topic focus

When topic is present, retrieval:

1. Normalizes and tokenizes the query.
2. Scores chunks using exact phrase matches, significant token overlap, and token rarity within the candidate set.
3. Selects the highest-scoring seed chunks across materials.
4. Adds adjacent chunks where budget permits to preserve local context.
5. Deduplicates and orders the final context by material and page.

No positive match produces `No indexed passages matched this topic`. This lexical implementation is deterministic and has no embedding cost. Vectorize-backed semantic retrieval can replace the scorer later without changing the indexing or generation contracts.

## Trusted Citations

Each prompt context block receives a server-generated `chunkId`. The model cites only that `chunkId`. After validation, the server attaches trusted citation fields:

```json
{
  "materialId": "material-id",
  "fileName": "book.pdf",
  "pageStart": 142,
  "pageEnd": 144
}
```

The model does not author filenames or page numbers. Existing sessions remain valid because page fields are optional. New sessions preserve the enriched citation snapshot.

## Deletion and Rename

Deleting a material deletes its original R2 object, index record, and chunks. Local fallback files receive equivalent cleanup. Renaming changes the material metadata only; generation resolves the current trusted filename when creating citations. Existing saved sessions retain their historical filename snapshot.

## Limits and Failure Handling

- Existing upload limit: 50 MB
- PDF page limit: 1,000 pages
- PDF extraction batch: 25 pages per request
- Chunk target: approximately 2,000 characters
- Generation context: 30,000 characters
- Topic length: 200 characters
- Scanned/image-only PDFs: `needs_ocr`
- Encrypted or malformed PDFs: `failed` with a safe user-facing reason
- Generation never reparses original files
- Prompt-injection protections remain in the generation prompt

## Verification

Tests cover:

- Real-PDF page-aware extraction without browser worker URLs
- Stable chunk IDs and page provenance
- Idempotent batch retries and checkpoint advancement
- Page-limit, unsupported, empty/OCR, and malformed-document states
- Topic scoring, phrase preference, adjacency, deduplication, and no-match behavior
- Broad document coverage under the context budget
- Trusted citation enrichment
- Upload initialization, index API ownership, deletion cleanup, and generation API validation
- Legacy session compatibility with optional page fields
- Materials and Practice UI states
- Production build and Wrangler deployment dry-run

## Deferred Work

- Cloudflare Workflow or Queue consumer for autonomous indexing
- Direct/resumable R2 uploads above the current request limit
- OCR
- Vectorize embeddings and semantic retrieval
- Chapter/TOC and explicit page-range controls
- Multi-source citations per generated item
