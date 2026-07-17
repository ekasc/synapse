# Landing page → /app design alignment

> Plan written 2026-06-27. Owner: **Ekas** (per `FEATURES.md` — landing page lives under "Frontend UI"). Demi's features are not touched.

## 0. Assumptions to confirm before implementation

- **"the newer design in /app"** = the visual language of `src/routes/app/` (CatalogHeader, BookShelf, BookCard, TermList, SectionHead, subject color tokens, paper/ink/highlight tokens, font-hand/Inter, `--page-width: 1100px`). No separate design file exists under `/app`; the only place in the repo that fits the description is the in-app shell.
- **Scope**: rebuild the landing page in the quieter `/app` register while keeping its job — communicate the product idea. Do **not** import `/app`'s shell, sidebar, FAB, or auth-guarded layout. The landing stays a public, single scroll.
- **Demo data**: keep the existing in-page `weeks` and `queries` constants inside `+page.svelte`. No calls to Demi's API surfaces (syllabus, briefing, query, grade). No new Drizzle/code under `src/lib/server/`.
- **Out of scope** (flag, do not implement): Demi's features (syllabus parser, grade analytics, NL query, study timer, CSV, testing, AI-usage docs), D1 schema, API handlers, auth/middleware, `/app` layout, `DESIGN.md` text.
- **Svelte MCP is unavailable** in this environment. Verify with `pnpm exec vite build` and `pnpm exec svelte-check` (per memory: `vite build` is the reliable verify path on this machine when pnpm wrappers fail with `fetch failed`).

## 1. Current landing page (`src/routes/+page.svelte`, 1696 lines)

Six sections, all in the "field notebook" editorial register called out in `DESIGN.md §8`:

1. **Cover** — highlit `synapse` wordmark, hand-drawn mini graph in a polaroid, CTA.
2. **The Mess** — torn notebook + calendar + sticky + to-do + coffee ring + red circled item.
3. **The Mechanism** — syllabus PDF → arrow → extracted card (static SVG).
4. **Query** — animated plain-English question → graph-backed answer.
5. **Timeline** — six week log entries pairing Kalam with Inter.
6. **Closing CTA + Footer** — single-line pitch, colophon.

Job: communicate the product concept. Heavy on paper artifacts: stamps, polaroids, tape, hand arrows, dashed borders, ±1–3° rotations.

## 2. The "/app" design language (target)

- `CatalogHeader` — top bar, term label only, no app chrome.
- `BookCard` / `BookShelf` — courses as "books" with subject-colored spine, `StatusChip`, data labels.
- `SectionHead` — eyebrow + title + meta, Inter caps.
- `TermList` — semester list with Current/Past/Future roles.
- Tokens in `src/routes/layout.css`: `var(--paper)`, `var(--ink)`, `var(--ink-soft)`, `var(--rule)`, `var(--rule-soft)`, `var(--paper-shelf)`, `var(--highlight)`, `var(--subject-{comp,math,csis,stat,econ,isys,humn})`, `var(--font-hand)`, `var(--font-body)`, `var(--ease-out-quart)`, `var(--page-width: 1100px)`.
- App rhythm: `max-width: var(--page-width)`, `margin-inline: auto`, `padding-block: 2rem 4rem`, no entrance animations, no `01/02/03` scaffold, no glassmorphism, no big-number metric templates.

## 3. File-level scope

- **Edit**: `src/routes/+page.svelte` (full rewrite, 1696 → ~350–500 lines).
- **Edit**: `src/routes/layout.css` only if a missing token surfaces — otherwise do not touch shared tokens.
- **Reuse**: `src/lib/components/catalog/{CatalogHeader, BookCard, BookShelf, SectionHead, TermList, StatusChip, IndexBar}.svelte`. Pure presentational, shared within Frontend UI.
- **Do not create**: a new layout group, a new route, a new server load, or any new file under `src/lib/server/`.

## 4. New section order (single scroll, no numbered scaffold)

1. **Top bar** — `CatalogHeader` with a generic pitch line (e.g. `a notebook for your degree`) instead of a term. See Risk R1.
2. **Hero** — two columns desktop, stacked mobile.
   - Left: `<h1>` in `font-hand`, one `<span class="highlighter">` sweep on a single word ("notebook" or "connected"). One short Inter sentence. One primary CTA → `/app`.
   - Right: a `BookShelf` of 3–4 hard-coded `BookCard`s (CSIS 4495, COMP 1710, MATH 1150, STAT 2000) with `spineColor` from `--subject-*`, `statusVariant` from a fixed Current/Past/Future set, `statusLabel` like "C25" / "F24". No polaroid, no tape, no rotation.
3. **What it does** — three `SectionHead`-style blocks. Each: eyebrow + Inter title + 1–2 sentence body. Topics: "every course on one shelf", "a graph behind your degree", "a query instead of a search bar."
4. **Query** — keep the rotating question/answer pattern, but render it in the `BookCard` shape: `meta = "QUERY"`, `title = question`, `detail = answer`. Keep the in-page `queries` array. Gate the 1400 ms autoplay on `prefers-reduced-motion: reduce`.
5. **Timeline** — render the six `weeks` as a 6-row table, not a hand column. Each row: `meta = week 0n`, `title = entry`, `detail = data`. `var(--rule-soft)` between rows. No Kalam voice here — `DESIGN.md` says app pages avoid landing-page-scale headings and decorative section scaffolding.
6. **Closing CTA + colophon** — single `BookCard` button (or `btn btn-primary`) → `/app`. Colophon: `synapse · vol. 01 · fall '25 → spring '27`, `var(--ink-faint)`, JetBrains Mono caps + letter-spacing.

## 5. What gets cut

- `mini-graph` SVG, cover polaroid, dashed stamp, hand-drawn arrow, coffee ring, red-circle decoration, torn notebook, "The Mess" / "The Mechanism" framing.
- Autoplay reveal (kept, but gated by `prefers-reduced-motion`).
- Giant highlit wordmark → single `font-hand` `<h1>` with one targeted highlight sweep (≤10 % of viewport per `DESIGN.md`).
- Inline duplicated tokens in `<style>` already defined in `layout.css`.

## 6. Style/structure rules

- All sections use tokens from `layout.css` (no new colors, no new fonts).
- One highlighter accent per section at most. Red pen only on the closing row if at all, never in `cover`.
- `max-width: var(--page-width)`, `margin-inline: auto`, `padding-block: 2rem 4rem` — match `/app` page rhythm.
- No glassmorphism, no `01 / 02 / 03` labels, no entrance scroll animations, no parallax.
- No em dashes. `font-hand` reserved for the brand line; everything else Inter.
- Svelte 5 idioms: `$state` / `$derived` / `$effect` / `$props`. No stores added. `resolveRoute('/app')` is the only navigation target.

## 7. Demo data

- Keep the existing `weeks` and `queries` arrays in the page.
- Do **not** add a `+page.server.ts` for the landing page (none today; introducing one is feature work I haven't been asked for and would need schema coordination).
- Hard-code 3–4 `BookCard` course items in the hero. No new data source.

## 8. Implementation steps with verification

1. **Spike: import check** — confirm the catalog components import from `$lib/components/catalog/*` in a route outside `/app`.
   _Verify:_ `pnpm exec svelte-kit sync && grep -n CatalogHeader src/routes/+page.svelte` resolves cleanly.
2. **Skeleton** — replace `+page.svelte` with `<CatalogHeader>` + empty `<main class="page">` mirroring the `/app` page rhythm.
   _Verify:_ `pnpm exec vite build 2>&1 | tail -8`.
3. **Hero section** — `font-hand` h1 with a single highlight sweep + Inter paragraph + CTA + `BookShelf` of 3–4 `BookCard`s with subject spines.
   _Verify:_ dev-server screenshot at 390×1100 (mobile) and 1440×900 (desktop) via Playwright MCP. Acceptance: no element uses a token that isn't in `layout.css`; highlighter appears on exactly one element.
4. **"What it does"** — three `SectionHead`-shaped blocks, all Inter, all referencing real design tokens.
   _Verify:_ visual diff vs. `/app` page rhythm — `gap`, `padding-block`, `max-width` match `app/+page.svelte`.
5. **Query** — re-skin to `BookCard` layout, gate autoplay on `prefers-reduced-motion`.
   _Verify:_ DevTools "Emulate CSS prefers-reduced-motion: reduce" (`mcp__chrome_devtools__emulate`) and confirm the reveal doesn't run.
6. **Timeline** — render the six `weeks` as a single block with `var(--rule-soft)` row dividers.
   _Verify:_ the `weeks[0..5]` array still appears in source; visually it reads as a table, not a hand column.
7. **Closing CTA + colophon** — single button (preferred) or `BookCard` → `/app`.
   _Verify:_ clicking it routes to `/app`.
8. **Final verification**:
   - `pnpm exec vite build 2>&1 | tail -8` clean.
   - `pnpm exec svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20` reports no new errors (pre-existing checker debt ignored per memory).
   - Visual: take desktop + mobile screenshots and compare spacing against `/app`.
   - Ownership: `git status --porcelain | grep -E 'src/lib/server|src/routes/api|src/routes/app'` should be empty after this work.

## 9. Risks and open questions

- **R1. `CatalogHeader` is hard-wired to a term.** Two options: (a) leave it and pass a generic "synapse" string as `term`; (b) skip the header and render a thin top bar inline. Default: (a). One less file change.
- **R2. The "Mess" and "Mechanism" sections are the most product-distinctive on the current page.** Cutting them is a real content loss. **Decision needed** before implementation: keep them (softer variant) or cut them (full `/app`-look variant).
- **R3. 1400 ms autoplay on Query.** I will gate it on `prefers-reduced-motion`, but you may want to remove autoplay entirely on the public page (cleaner, accessible by default). Easy to flip.
- **R4. Closing CTA shape.** `BookCard` keeps the page in one component family but is sized for a list. A plain `<a class="btn btn-primary">` matching `/app`'s buttons is louder and more honest. Default: button.
- **R5. Svelte MCP unavailable.** Can't run `svelte-autofixer` per agent guidelines. Mitigation: `svelte-check` + `vite build` in step 8.
- **R6. Hero `BookShelf` data is hand-tuned.** Three to four fake course codes that may not match any real semester. Acceptable for a marketing page; flagged for review.

## 10. Open decisions (need a user answer before implementation)

1. **Scope** — Full `/app`-look rebuild (default) or Softer-tone variant that keeps the Mess/Mechanism?
2. **CatalogHeader on the landing** — pass a generic term (default) or inline a thin top bar?
3. **Query autoplay** — keep gated on `prefers-reduced-motion` (default) or remove entirely?
4. **Closing CTA shape** — `btn btn-primary` (default) or `BookCard`?

---

# Appendix A — Three landing-page variations

Three different ways to rebuild `/` in the `/app` design language. They share the same component vocabulary (`CatalogHeader`, `BookCard`, `BookShelf`, `SectionHead`, `IndexBar`, `StatusChip`, `TermList`) and the same token discipline from `layout.css`. They differ on **what the page makes the reader look at first**.

## What is held constant across all three

- File rewritten: `src/routes/+page.svelte` only.
- No new Drizzle, no new API routes, no new files under `src/lib/server/`. (Ekas-only.)
- `var(--page-width)` 1100 px, `margin-inline: auto`, `padding-block: 2rem 4rem` (matches `/app`).
- One highlighter accent per section max. Red pen used at most once across the whole page.
- No em dashes, no `01/02/03` numbered scaffold, no glassmorphism, no entrance scroll animations, no parallax.
- `font-hand` only on the brand line. Everything else Inter.
- Svelte 5: `$state` / `$derived` / `$effect` / `$props`. No stores.
- Single scroll, no auth, no sidebar, no FAB. Same single CTA target: `resolveRoute('/app')`.
- Existing in-page `weeks` and `queries` constants stay where they are.
- "What gets cut" from the current landing is the same in all three: `mini-graph` SVG, cover polaroid, dashed stamp, hand arrow, coffee ring, red-circled decoration, "The Mess" / "The Mechanism" framing, autoplay (gated or removed).

## What differs

The hero strategy, the number of in-page sections, how the page talks to the reader, and how much product UI is shown vs. how much is described in prose.

---

## Variation A — "The Catalog" (mirror the dashboard)

**Hero strategy**: Show the product UI. The first thing the reader sees after the top bar is a real `BookShelf` of four `BookCard`s with subject-colored spines, with the headline + CTA sitting _above_ the shelf like a column header. The landing is literally the `/app` dashboard, minus the sidebar, onboarding, and FAB.

**Tone**: Quiet, tool-like, confident. "We have an opinion about what a course list should look like. Here it is."

**Sections, in order**:

1. **Top bar** — `CatalogHeader` with `term="synapse"` (the in-app component, repurposed as a brand bar).
2. **Hero (single column, max-width 720px)** — `<h1 class="font-hand">` reading `synapse` with a single `<span class="highlighter">` sweep on the word `notebook`. One Inter sentence: "every course, grade, and deadline on one connected page." Primary CTA → `/app`.
3. **Demo shelf** — `BookShelf` with four `BookCard`s. Hard-coded course list, e.g. CSIS 4495 (Current, `csis` spine), COMP 1710 (Current, `comp`), MATH 1150 (Current, `math`), STAT 2000 (Past, `stat`). Each with `statusLabel = "F25"` / `"S25"` and `statusVariant` set appropriately. No section title — the shelf _is_ the demo.
4. **What it does** — three `SectionHead` blocks (eyebrow + Inter title + body): "every course on one shelf", "a graph behind your degree", "a query instead of a search bar".
5. **Closing CTA + colophon** — single `<a class="btn btn-primary">` → `/app`. Colophon in JetBrains Mono caps.

**Component usage**: `CatalogHeader`, `BookShelf`, `BookCard` (4×), `StatusChip` (transitively via `BookCard`), `SectionHead` (3×).

**Things deliberately NOT used**: `IndexBar`, `TermList`, the `weeks` and `queries` arrays. (This variation doesn't tell the editorial story; it just shows the shelf.)

**Pros**: Closest to `/app`. Cheapest to build. Reads as the actual product. Shows the subject color system at a glance. Strongest "I trust this product" signal.

**Cons**: Doesn't communicate _what Synapse does_ on the public page. A first-time visitor who has never seen a course-management tool won't know the graph or query features exist without reading the "What it does" prose. Loses all of the editorial storytelling.

**Profile**: Best for a recruiting/demo audience that already understands the problem space (CS students shopping for an academic tool). The same page a hiring manager sees; the same page a TA might open.

---

## Variation B — "The Walkthrough" (real product steps, in order)

**Hero strategy**: Show the product doing the thing. The first thing the reader sees is a single highlighted `BookCard` for the user's "current" course, with the rest of the page walking through how a course goes from _uploaded syllabus_ → _extracted deadlines_ → _in the shelf_ → _queried_ → _summarized in a digest_. Each step is a small composition of `/app` components. The page is a guided tour using only `/app` building blocks.

**Tone**: Instructional, evidence-driven. "Here is exactly what synapse does, in the order it does it, with the real pieces shown."

**Sections, in order**:

1. **Top bar** — `CatalogHeader` with `term="synapse"`.
2. **Hero (two columns)** — left: `<h1 class="font-hand">synapse</h1>` + one Inter sentence + CTA. Right: a single `BookCard` standing in for the user's current course (CSIS 4495, `csis` spine, `statusVariant="warn"`, `statusLabel="F25"`, `statusValue={81.2}` for a running grade). One highlight sweep on the word `connected` in the h1.
3. **Step 1 — upload** — `SectionHead` "01 / upload a syllabus" eyebrow + title + body. Below: a `BookShelf single` containing a `BookCard` whose `meta` is `SYLLABUS`, `title` is `CSIS 4495-071 · fall '25`, `detail` is `extracted: 14 deadlines, 4 weights`, `statusVariant="ok"`. (Slight `01` numeric eyebrow here is a _narrative_ number for a step in a story, not a section scaffold — flag for review.)
4. **Step 2 — extract** — `SectionHead` "02 / deadlines land on the shelf" + body. Below: a row of three `BookCard`s with `meta = DEADLINE`, `title = assignment name`, `detail = due date`, `statusVariant` set to `crit`/`warn`/`ok` by proximity. A `StatusChip` `crit`/`warn`/`ok` does the actual signaling.
5. **Step 3 — graph** — `SectionHead` "03 / the graph connects them" + body. Below: a `BookShelf single` of 4 `BookCard`s for CSIS 4495, COMP 1710, MATH 1150, STAT 2000, with subject spines. The visual story is "they are books on a shelf, and behind the scenes they have edges" — no SVG. The shelf _is_ the graph visualization, expressed through the data.
6. **Step 4 — query** — `SectionHead` "04 / ask plain English" + body. Below: the existing in-page `queries` array, but each entry is a `BookCard` with `meta = QUERY`, `title = question`, `detail = answer`, `statusVariant="ok"`. No autoplay. Static list, click to expand.
7. **Step 5 — digest** — `SectionHead` "05 / the weekly digest" + body. Below: the existing in-page `weeks` array rendered as six `BookCard`s with `meta = week 0n`, `title = entry`, `detail = data`. `statusVariant` rotates `ok/warn/crit` based on a fixed map.
8. **Closing CTA + colophon** — `<a class="btn btn-primary">` → `/app`. Colophon.

**Component usage**: `CatalogHeader`, `BookCard` (~15–18×), `BookShelf`, `StatusChip` (transitively), `SectionHead` (5×). Reuses the in-page `weeks` and `queries` constants. No `IndexBar`, no `TermList`.

**Pros**: Most informative page. Uses every product capability at least once. Reuses the existing demo data — no invented content. Steps map 1:1 to Demi's feature set (without naming it as "Demi's features").

**Cons**: Longest page. The `01..05` eyebrows are a numbered scaffold, which `DESIGN.md` explicitly bans. **Decision needed**: rename them (e.g. `step 1 of 5`, or replace eyebrows with verb-only labels `upload`, `extract`, `connect`, `query`, `digest`). Also the most work to build.

**Profile**: Best for a CSIS 4495-071 course audience (the class this project is for). Most aligned with the "demo the product" job the original landing had, but using `/app` building blocks.

---

## Variation C — "The Summary" (IndexBar-first, app rhythm)

**Hero strategy**: Treat the landing as a one-page summary of an active Synapse instance. The first thing the reader sees is an `IndexBar` of three or four cells (current term, courses, deadlines this week, hours studied) that look exactly like the cells at the top of `/app`. Headline + CTA sit below the index bar, not above. The rest of the page is two `SectionHead` blocks and a closing CTA — shorter than A, much shorter than B.

**Tone**: Confident, dense, "this is what your degree looks like, condensed." Reads like a status page.

**Sections, in order**:

1. **Top bar** — `CatalogHeader` with `term="synapse"`.
2. **Index strip** — `IndexBar` with 4 cells: `current term = fall '25`, `courses = 5`, `deadlines this week = 3 (crit)`, `hours studied = 12.5`. The `crit` tone on the deadlines cell is the one red-pen moment allowed. No section title.
3. **Hero (single column)** — `<h1 class="font-hand">synapse</h1>` with a single highlight sweep on `one connected page`. One Inter sentence. CTA → `/app`.
4. **Demo shelf** — `BookShelf` of 4 `BookCard`s (same as Variation A). Quick visual proof of the subject color system.
5. **What it does** — two `SectionHead` blocks, not three: "every course on one shelf" and "ask plain English". The graph step is implied by the shelf; the digest step is implied by the index strip. No "What it does" section on graph or digest.
6. **Closing CTA + colophon** — `<a class="btn btn-primary">` → `/app`. Colophon.

**Component usage**: `CatalogHeader`, `IndexBar`, `BookShelf`, `BookCard` (4×), `StatusChip` (transitively), `SectionHead` (2×). Does **not** use `weeks` / `queries` (the data is summarized into the index strip instead).

**Pros**: Shortest page. Highest information density. The `IndexBar` is the most `/app`-native way to show data, and it puts Synapse's "we know your degree" claim front and center. One red-pen moment is well-used.

**Cons**: The `IndexBar` numbers (5 courses, 12.5 hours) are _hand-tuned_ on a public page — that risks looking like a metric-card hero, which `DESIGN.md` bans. **Mitigation**: the cells are peers in a row, not stacked, and the page never leads with a single big number. But this is the riskiest variation relative to `DESIGN.md` rules. Also loses the editorial story entirely.

**Profile**: Best for an audience that skims (recruiters, advisors, the instructor grading the project). Reads in 10 seconds, says everything.

---

# Side-by-side

|                                   | **A. The Catalog**            | **B. The Walkthrough**                     | **C. The Summary**                                    |
| --------------------------------- | ----------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| First thing the reader sees       | `BookShelf` of 4 `BookCard`s  | Hero + single `BookCard` of current course | `IndexBar` of 4 cells                                 |
| Page length                       | Medium (~5 sections)          | Long (~8 sections)                         | Short (~6 sections, but compact)                      |
| Component count                   | 4 unique                      | 4 unique, ~18 instances                    | 5 unique, ~7 instances                                |
| Uses in-page `weeks` / `queries`? | No                            | Yes                                        | No                                                    |
| Editorial storytelling            | None                          | Heavy (5 steps)                            | Minimal (2 sections)                                  |
| Risk of violating `DESIGN.md`     | Low                           | Medium (`01..05` eyebrows — needs a call)  | Medium (IndexBar is one step from a metric-card hero) |
| Audience fit                      | CS students, TAs              | CSIS 4495-071 course demo                  | Recruiters, advisors, instructor                      |
| Build effort                      | Smallest                      | Largest                                    | Small–medium                                          |
| What it sacrifices                | Product story                 | The "keep it short" rule                   | Real data on the page                                 |
| What it wins                      | Trust via showing the product | Comprehensiveness                          | Brevity + density                                     |

# Combinations worth considering

- **A + C**: take A's full shelf, prepend C's `IndexBar` strip, drop one of A's three "What it does" sections. This is the "status page + shelf" landing. ~6 sections.
- **A + B-lite**: take A's full shelf, then do only B's Step 4 (Query) and Step 5 (Digest) using the in-page arrays, renumbered as `query` and `digest` eyebrows (no numbers). The "what + how" landing. ~7 sections.
- **C standalone with a shelf**: Variation C, but replace the second "What it does" block with one `BookShelf` of 4 `BookCard`s, removing the standalone hero shelf. Avoids two shelves on one page.

# My recommendation if you can't pick

**Variation A** if you want the safest move that looks most like `/app`. **Variation C** if you want the most app-native and the shortest. **Variation B** only if the CSIS 4495-071 demo story is the page's primary job.

If you say "go with A" (or B or C), I implement steps 1–8 of §8 in this document with the chosen variation. If you say "mix" with a combination, I do the same with the merged version.

# Open decisions specific to the variations

1. **Variation pick** — A, B, C, or a combination (A+C, A+B-lite, C-with-shelf).
2. **If B**: rename the `01..05` eyebrows to `step 1 of 5` (or drop the numbers entirely)? `DESIGN.md` bans numbered scaffolds; B's eyebrows are arguably a numbered scaffold.
3. **If C**: confirm hand-tuned `IndexBar` numbers (5 courses, 12.5 hours) are acceptable on a public, unauthenticated landing. Alternative: render the `IndexBar` empty-with-placeholder-dashes until the data is real, but that conflicts with the page being a marketing demo.
4. **Hero highlight word** — `notebook` (A default), `connected` (B default), `one connected page` (C default). Or another word you prefer.
