# Synapse · Handover

> Handoff for the work on `wip/weekly-push` over 2026-07-27 → 2026-07-28.
> The Bash permission classifier was unavailable for the entire session, so
> `pnpm check` / `pnpm test` / `pnpm lint` / `pnpm build` could not run inline.
> Every new module has a spec but no spec was executed.

## What's done (code complete, unverified)

### Stabilization — had to land first
- `userId` threaded through ~10 stale callers (index/generate/chat/digest-data/+page.server, all materials pages/routes, attachMaterialIndexes signature).
- `practice_material_chunks` INSERT now binds `user_id` (schema declares it `NOT NULL`).
- `push/subscriptions.ts` list returns `userId`; weekly-push cron prune uses it.
- Auth callback: read `synapse_oauth_redirect` **before** deleting it; `secure: !dev` for both session + OAuth cookies.
- `runMaterialIndexBatch` extracted from the index route so the browser loop and the new cron path share one implementation.
- `scripts/wrap-worker.mjs` already wrapped the worker; extended to branch on `controller.cron` (no replacement of `worker.js`).

### Item 2 — deferred Exam Prep features
- **Background indexing** — `src/lib/server/practice/background-index.ts` + `/api/material-index/run`, second cron `17 */6 * * *` in `wrangler.jsonc`. Bounded per run (`maxMaterials=4`, `maxBatchesPerMaterial=3`). Guarded by `BACKGROUND_INDEX_SECRET`.
- **OCR** — client-assisted. `src/lib/server/practice/ocr.ts` + `/api/courses/[id]/materials/[materialId]/ocr`; the Materials page renders each page of a `needs_ocr` PDF and posts the JPEG. Vision model selectable via `OCR_MODEL`; unconfigured → 503.
- **Vectorize** — `src/lib/server/practice/embeddings.ts`: chunks embedded with `@cf/baai/bge-small-en-v1.5` (384d), upserted to `VECTORIZE`, retrieved in `/api/practice/generate` with lexical fallback. Embedding failures never block the durable D1 write.
- 4 new/extended spec files (~30 tests) — written, **not run**.

### Item 3 — settings hole + doc decisions
- `src/routes/app/settings/+page.svelte` restored in the post-redesign visual language; sidebar entry added in `src/lib/sidebar/routes.ts`.
- `docs/landing-page-redesign.md` marked **superseded** (the WIP kept the field-notebook identity rather than adopting the catalog aesthetic the doc proposed).
- `docs/superpowers/specs/2026-07-16-practice-material-indexing-design.md` "Deferred Work" list updated: the three items struck through with implementation notes.

### Docs
- `ai-usage-log.md` entry #36 (full session record).
- Memory: `feedback_no_status_polling_agents`, `project_db_sync_workflow`, `reference_ai_usage_log`.

## What still needs doing

### A. Run verification (item 1's first half)
```
pnpm check
pnpm test           # expect ~600+ tests + ~30 new
pnpm lint
pnpm build
pnpm preview --test-scheduled
```

### B. Lint baseline (item 4)
- ~34 pre-existing ESLint errors in unrelated files. At minimum confirm my new code is lint-clean; then either fix mechanically or carve out a separate "lint cleanup" commit (per AGENTS.md the WIP deliberately avoided touching unrelated code).

### C. Decisions + one-time setup
| What | Command | Why |
|---|---|---|
| Create the Vectorize index | `pnpm exec wrangler vectorize create synapse-material-chunks --dimensions 384 --metric cosine` | Without this, semantic retrieval silently falls back to lexical. |
| Set the cron secret | `pnpm exec wrangler secret put BACKGROUND_INDEX_SECRET` | Without this, the new cron is a no-op. |
| Set a vision model | `pnpm exec wrangler vars put OCR_MODEL <model>` (and `OCR_MODEL=` in `.dev.vars`) | Without this, OCR is 503. The model picker was left empty intentionally — don't want to bake a guess into the codebase. |
| Sync the schema | `pnpm db:d1:push` | `d1-schema.ts` already declares `user_id` on `practice_material_indexes`/`practice_material_chunks`/`practice_sessions`; push will add the columns. (Journal only goes through 0008; 0009–0016 are records only — see [project memory] in `~/.claude/projects/-Users-ekassinghchhabra-Projects-ts-synapse/memory/`.) |
| Remove the audit bypass | edit `src/hooks.server.ts:45-52` — the `// TEMP: auth disabled for UI audit — REMOVE THIS BLOCK` block | Injecting `audit-user` into every unauthenticated request is unsafe; must go before deploy. |

### D. Commit (item 1's second half)
The diff is currently one giant working set. Suggested logical splits (in this order):

1. **Stabilize** — `userId` threading, chunks INSERT, auth fixes, prune fix, shared batch core.
2. **Background indexing** — module, route, cron, wrap-worker, wrangler.jsonc, `BACKGROUND_INDEX_SECRET`.
3. **Vectorize** — `embeddings.ts`, `selectSemanticChunks`, hybrid `generate` route, delete-route cleanup, `AI` + `VECTORIZE` bindings, `OCR_MODEL` var.
4. **OCR** — `ocr.ts`, `/ocr` route, Materials page button + loop, spec.
5. **Settings + docs** — restored page, sidebar entry, landing doc superseded, practice spec Deferred updates, ai-usage-log entry #36, `HANDOVER.md`.

### E. Cosmetic WIP gaps noticed, left for your call
- `.page-enter` and `.font-display` were removed from `src/routes/layout.css` but ~10 pages still reference them (chat, activity, digest, timer, semesters tree, materials page, CalendarWorkspace, SetupWizard).
- `migrations/meta/_journal.json` only registers through tag `0008_rich_ares`; the rest of the migrations dir is decorative given `pnpm db:d1:push` is the real sync path.
- The dev-only CSRF shortcut in `src/routes/auth/callback/+server.ts:24-29` (`if expectedState === undefined && NODE_ENV !== 'production'`) is intentional but worth a second look before the security review.

## Files changed (high-level)
- `src/lib/server/practice/`: `material-index.ts`, `indexing.ts` (new), `background-index.ts` (new) + spec, `embeddings.ts` (new) + spec, `ocr.ts` (new) + spec, `retrieval.ts` + spec additions.
- `src/routes/api/`: `material-index/run/+server.ts` (new), `courses/[id]/materials/[materialId]/index/+server.ts`, `courses/[id]/materials/[materialId]/ocr/+server.ts` (new), `practice/generate/+server.ts`, `courses/[id]/materials/+server.ts`, `weekly-push/run/+server.ts`, `auth/login/+server.ts`, `auth/callback/+server.ts`.
- `src/routes/app/settings/+page.svelte` (new), `src/routes/app/semesters/[semesterId]/courses/[courseId]/materials/+page.svelte`.
- `src/lib/sidebar/routes.ts`, `src/lib/server/push/subscriptions.ts`.
- `scripts/wrap-worker.mjs`, `wrangler.jsonc`, `worker-configuration.d.ts`, `.dev.vars`.
- `docs/landing-page-redesign.md`, `docs/superpowers/specs/2026-07-16-practice-material-indexing-design.md`, `ai-usage-log.md`.

## Branch state
Currently on `wip/weekly-push`; 161 files changed, +7135 / −9673, uncommitted. No commit was made this session — the user's order was 2 → 3 → 4 → 1 and they preferred committing last. Item 1 (verify + commit) is the only thing not yet touched beyond what's listed above.
