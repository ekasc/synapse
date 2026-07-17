# Course Practice History and Material Scope

**Date:** 2026-07-17  
**Owner:** Ekas — Exam Prep (RAG)  
**Status:** Approved in conversation

## Goal

Make saved quizzes and flashcards recognizable and reusable inside their owning course workspace. Allow generation from one or more explicitly selected, ready course materials.

## Course Boundary

All history and generation remain under `/app/semesters/[semesterId]/courses/[courseId]/practice`. Session listing is filtered by the canonical route course ID. Material IDs submitted for generation must belong to that same course and have a ready Practice index. No global Practice library or additional navigation level is introduced.

## Saved Practice Library

Replace anonymous session chips with a `Saved practice` section. Each row derives metadata from the existing session snapshot and shows:

- focus topics, falling back to `Broad review`
- source filenames
- question and flashcard counts
- score and status
- last-updated date
- `Review quiz`, `Review flashcards`, and `Delete` actions

Review actions load the existing saved questions, flashcards, citations, and progress, then select the requested mode. No migration is required because summaries derive from the saved session JSON.

## Material-Specific Generation

The Practice page receives ready indexed material summaries from its course-scoped server loader. All ready materials are selected by default. Users may select one or more materials before generating and may combine that selection with the optional topic focus.

`POST /api/practice/generate` accepts an optional `materialIds` array containing 1–8 unique non-empty IDs. The endpoint rejects malformed, foreign-course, missing, or non-ready selections. Retrieval filters ready chunks to the validated material set before topic scoring or broad sampling. Saved session source snapshots continue to derive from generated items, so history accurately records the selected source files.

## Verification

- request validation for unique bounded material IDs
- endpoint ownership and ready-index filtering
- course-scoped session summaries with topics and both item counts
- review actions load the selected saved mode
- generation disabled when no ready material is selected
- full tests, production build, and Wrangler dry-run
