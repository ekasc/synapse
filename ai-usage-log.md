# AI Usage Log — Synapse

Started: June 21, 2026
Tools used: **Hermes Agent** (primary, via Telegram & CLI), **Codex CLI** (occasional planning), **OpenCode Go** (current provider)

---

## 1. Initial Proposal Draft (June 7)

### Prompt (to Hermes Agent via Discord)

> "make a proposal draft for synapse based on this progress report"

**Context:** The instructor directed the team to switch from the original project idea (Capsule) to a new concept (Synapse) with limited time before the June 9 deadline.

**What came back:** 5-section structured proposal covering problem statement, target users, proposed solution, novelty, platform, and timeline. Written as markdown.

**What I changed:**

- Adjusted problem statement to reflect my own university experience
- Added competitor details I knew from using those tools
- Corrected the timeline to match actual team availability

---

## 2. Template Restructuring (June 7)

### Prompt (to Hermes Agent)

> "convert this to the provided template format"

**Context:** The prof gave a Word template with specific required sections (1. Introduction, 2. Background Research, 3. Innovation, 4. Architecture, 5. Timeline). The initial draft didn't match.

**What came back:** Full HTML + DOCX with cover page, table of contents, proper section numbering, Times New Roman 12pt, 1.5 spacing.

**What I changed:**

- Replaced the generated Background Research section with content Demi wrote independently
- Fixed formatting issues (the HTML-to-PDF pipeline had overflow problems on certain pages)

---

## 3. Humanization Pass (June 8)

### Prompt (to Hermes Agent)

> "remove the emdashes, its a dead ai giveaway"

**Context:** The AI-generated text had excessive em dashes (—) and promotional language ("groundbreaking," "pivotal") that made it obvious it was AI-written.

**What came back:** Clean text with em dashes replaced by standard punctuation, promotional language removed.

**What I changed:**

- Reviewed every section for remaining AI tells
- Replaced several formulaic paragraph structures with more natural alternatives

---

## 4. Course Graph Implementation (June 15)

### Prompt (to Hermes Agent via Telegram)

> "good. now implement the rest of the features"

**Context:** We had a working course graph page with basic node display. Needed multi-select drag, double-click create, inline editing, edge labels/types/direction, undo/redo, color tags, and minimap.

**What came back:** Full rewrite of `/app/courses/+page.svelte` (600+ lines) with:

- Freeform canvas with pan/zoom
- Interactive node editor with drag, multi-select, box-select
- Link tool to draw edges between courses
- Undo/redo (24-history stack)
- Inspector panel for inline editing
- Minimap overlay
- Color tags per course node

**What I changed:**

- Normalized the edge data shape to match the DB schema
- Adjusted the autosave debounce timing
- Fixed the edge path rendering for courses far apart
- Added TypeScript validation (initial generation had some `any` types that slipped through)

---

## 5. Graph API & Save Integration (June 15)

### Prompt (to Hermes Agent)

> "design it in such a way. an agent/llm call can also add nodes to the graph. along with specifying which one is a prereq or something else."

**Context:** The graph save API used generic types that would reject the richer edge metadata (labels, direction, type).

**What came back:**

- Updated `PUT /api/graph` to accept full edge shapes
- Save status pill (saved / saving / error) added to the toolbar
- Fixed TypeScript errors in `src/routes/api/courses/+server.ts` and `src/routes/api/semesters/+server.ts`

**What I changed:**

- Nothing significant — the generated code compiled clean. The main review was verifying the API accepted the shape I needed.

---

## 6. Course Intelligence Brief Feature (June 21)

### Prompt (to Hermes Agent via Telegram)

> "course brief"

**Context:** The user wanted me to build out the Course Intelligence Brief feature — a searchable page where you enter a course code and the system researches it (professor, RMP rating, workload, grade structure, prerequisites).

**What came back:**

- **`POST /api/brief`** — new API endpoint that checks cache first, then tries OpenRouter LLM call with the course-brief-prompt.md, then falls back to mock data
- **`getBriefs`/`getBrief`/`saveBrief`** — data store functions in `store.ts`
- **`+page.server.ts`** — loads cached briefs on page visit
- **`+page.svelte`** — full rewrite with search input, research button, loading spinner, cached list, detail view, error states

**What I changed:**

- Refined the Briefing type for consistency between store, API, and frontend
- Added source tracking showing what data was actually found vs missing
- API falls back gracefully if no `OPENROUTER_API_KEY` is set — returns demo data with a hint
- Results are cached in `.data/briefs.json`

**Verification:** `svelte-check` — 0 errors (3 warnings, all pre-existing)

---

## 7. Graph Page Layout Bug (June 22)

### Prompt (to OpenCode Go)

> "the graph page overlaps the sidebar and overflows"

**Context:** The course graph canvas page (`/app/courses`) was absolutely positioned with `inset: 0` but its parent `<main class="app-main">` had no `position: relative`, so the canvas stretched to the viewport and overlapped the 200px sidebar.

**What came back:** One-line CSS fix — added `position: relative` to `.app-main` in `src/routes/app/+layout.svelte`. The `.canvas-page` and `.editor-shell` (both `position: absolute; inset: 0`) were now constrained to the flex area beside the sidebar.

**What I changed:**

- Ran prettier on the layout file (formatting had drifted).

---

## 8. Impeccable Polish on Manage Page (June 22)

### Prompt (to OpenCode Go, via Impeccable audit results)

> "yes" (in response to suggested Impeccable skill fixes for `/app/courses/manage`)

**Context:** Impeccable flagged two issues on the manage page: cramped `.table-wrap` padding, and a hairline border + wide shadow on the `fab-btn` (AI tell).

**What came back:** Two surgical CSS changes — added `padding: 0.25rem` to `.table-wrap` to inset the table from the border, reduced `.fab-btn` border from `1.5px` to `1px` and shadow blur from `16px` to `8px`.

**What I changed:**

- Nothing. The fixes were minimal and exactly right.

---

## 9. Impeccable Shape on Dashboard (June 22)

### Prompt (to OpenCode Go)

> "read the dashboard page. run the impeccable shape skill on it"

**Context:** The dashboard (`/app` step 3) was a flat list of semester cards with a course count summary. Felt generic and not aligned with the notebook aesthetic.

**What came back:**

- A short design brief framed around "deadlines this week" as the primary signal (daily check-in use case, semester focus, not cross-section hub).
- Full implementation of the two-zone layout: status bar (deadline count + secondary stats) + collapsible semester list with course rows and deadline dot indicators.
- Custom `CourseData` interface, `SvelteSet` for the expanded set, computed values for `deadlinesThisWeek` and `activeCount`.
- Replaced `as any` casts with the typed interface, used `resolveRoute()` on `goto()` calls to satisfy the SvelteKit eslint rule.

**What I changed:**

- Adjusted the lint fixes (`SvelteSet` doesn't need `$state` wrapping, switched from `new Set()` to `.add()`).
- Reverted `<a href>` to `<button onclick={() => goto(resolveRoute(...))}>` since the eslint rule flagged bare hrefs.
- Tuned the responsive media query to scope the step-2 form `.course-row` flex-wrap so it doesn't apply to the dashboard's course rows.

---

## 10. Dashboard Depth Pass (June 22)

### Prompt (to OpenCode Go)

> "make it better. fix the layout. dont make it a boring dashboard. it should actually have some depth"

**Context:** The redesigned dashboard was functional but flat. Wanted it to feel like a notebook spread, not a generic dashboard.

**What came back:**

- Replaced the status bar with a "notebook spread header" — `Dashboard` in Kalam with a highlighter sweep behind it (`::before` with `mix-blend-mode: multiply`), a circled red-pen deadline count, and meta stamps below.
- Replaced semester cards with journal-style "entries" — current semester has a tape strip across the top-left corner (`.entry-tape` using `var(--tape)`).
- Course rows: code in bold mono, name in soft ink, red dot indicator with a soft glow halo via `box-shadow`.
- Action footer mounted inside a `.polaroid` frame.
- Replaced `wizard-btn` usages with the new global `btn btn-primary btn-sm` / `btn btn-secondary btn-sm` classes.

**What I changed:**

- Verified the `SvelteSet` behavior with `.add()` / `.delete()` works correctly with Svelte 5 reactivity.
- Scoped mobile media queries so the step-2 form's `.course-row` flex-wrap doesn't cascade to dashboard rows.

---

## 11. Full App UI Overhaul (June 22)

### Prompt (to OpenCode Go, multi-part)

> "improve all the ui drastically. right now its like a basic draft. suggest changes." → "all of themcontinuecontinue"

**Context:** Critiqued the entire app as flat, generic, and underusing the notebook design system. Listed P0–P4 priorities (sidebar + page headers, surface texture, button hierarchy, motion, strategic color). User said "all of them."

**What came back:**

- **Sidebar overhaul** — replaced 8 Unicode symbols (◫, ◰, ⛁, etc.) with proper inline SVG line icons (16px, 1.5px stroke, ink-colored). Added an ink bar that animates in on the active item, a highlighter sweep behind the "synapse" brand, subtle paper noise texture on the sidebar background. Smart active detection via `isActive(href, pathname)` so sub-routes (like `/app/courses/manage`) still highlight the parent nav item.
- **Page header system** — added `.page-cover`, `.page-cover-row`, `.page-cover-stamps` to layout.css. Every page now opens with a `field 0X` + descriptive stamp in Kalam (slightly rotated via `.stamp-rot-l`/`.stamp-rot-r`), then the page title in Kalam, then the subtitle. Each page got a unique stamp pair ("field 01 · weekly", "field 04 · the calendar", "field 05 · study", etc.).
- **Surface texture** — added `.surface` (notebook page) and `.surface-polaroid` (taped polaroid frame) classes. Added `.tape-corner` utility with `.tape-corner-tl` / `.tape-corner-tr` variants and `.tape-tilt-l` / `.tape-tilt-r` for slight rotation. Applied tape corners to: digest overview bar, digest card, calendar upcoming panel, practice question card, practice quiz result, brief detail, brief search, settings list.
- **Button hierarchy** — added `.btn` base + `.btn-primary` (filled ink), `.btn-secondary` (outline + highlighter on hover), `.btn-ghost` (text only, used for "cancel", "back"), `.btn-danger` (pen-red), `.btn-sm`. Replaced all `wizard-btn` / `add-btn` / `action-btn` / `modal-btn` / `back-link` usages in dashboard, manage, brief with the new global classes.
- **Motion** — added `.page-enter` class with staggered fade-in (children fade up 4px, 40ms apart, capped at 360ms via `nth-child` selectors). Applied to all page roots. Flashcard rewritten as a real 3D flip with `transform-style: preserve-3d` and 0.55s cubic-bezier; both faces always rendered, back face rotated 180° via CSS. Quiz feedback icon now has a `qFeedback` keyframe (scale 0.4 → 1.25 → 1) on reveal.
- **Strategic color** — highlighter sweep on the "Dashboard" title via `::before`, `.hl-sweep` class on the calendar "Upcoming" heading, red pen accents on delete actions in manage.

**What I changed:**

- Added lint fixes for new code (resolved `goto(resolveRoute(...))` pattern, removed `$state` from `SvelteSet`).
- Reduced max-widths on settings (520→560), practice (640→660), digest (680→720) for better reading line lengths.
- All page titles now use `clamp(2rem, 3.5vw, 2.6rem)` instead of fixed `2rem` for nicer scaling across viewports.
- Verified the `SvelteSet` initial empty state works correctly with the `expandedSemesters.size === 0` guard in the `$effect`.
- The `flashcard` div needed an `onkeydown` handler to be keyboard-accessible (was a `<button>` before; now a `<div role="button">` with proper Enter/Space handling).

**What I didn't change:**

- The wizard onboarding (steps 1 & 2) intentionally kept the older `wizard-btn` class and styling — it's a transient state, not a primary surface.
- The graph canvas page (`/app/courses`) — the SvelteFlow toolbar and node styling are already very bespoke; touching them wasn't in scope.
- The practice page's `.wizard-btn` class kept inline (steps 1 & 2, 539) — same reason.

---

## 12. UX Audit and Parallel Implementation (June 22)

### Prompt (to OpenCode Go, multi-turn)

> "read all the ui. and then tell me does it make any sense? as a new user who doesnt know much about it. also, find inconsistencies" → "dont worry about the dummy data. its there to see how the app would look with the backend connected. now tell me what needs attention" → "implement all of them. divide them in two groups. those groups MUST not edit the same files. then spawn 2 sub agents to run in parallel to complete those 2 groups."

**Context:** After the UI overhaul, I asked the AI to read every page from a new user's perspective and find inconsistencies. The audit found 14 issues, mostly stemming from a fundamental mismatch between the data model (rich `signals` with status, deadlines, risk, grade, topics) and the actual UI (no path to set any of them, hardcoded mock data on three pages, calendar showing March 2026 in June, etc.). The user said the mock data is intentional for design review, so the focus narrowed to: make the data model reachable from the UI, fix the UI vocabulary, wire up empty states, and fix structural issues.

Then the user said: implement all of them, in two parallel sub-agents, with non-overlapping file ownership.

**What came back:**

A 14-item issue list, organized by impact:

- **Data layer issues**: signals not persisted, active count always 0, manage modal missing signal fields, manage tag values hardcoded
- **Graph issues**: 12-button toolbar, no page-cover header, broken notebook aesthetic, no `?nodeId` deep-link
- **Dashboard issues**: wizard uses different button styles than the rest of the app, "0 deadlines" without a CTA, dead-link course rows, wizard CTA inconsistency
- **Layout/secondary pages**: sidebar Graph/Courses confusing, settings "coming soon" but still in nav, calendar/digest/practice have no server data files, brief back button uses custom class

**File-ownership split:**

| Group                  | Files owned                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — Data + graph**   | `lib/server/store.ts`, `lib/components/course-flow/types.ts`, `api/courses/+server.ts`, `app/courses/manage/+page.svelte`, `app/courses/+page.svelte`, `course-flow/CourseNode.svelte`                                                                       |
| **B — UI + secondary** | `app/+layout.svelte`, `app/+page.svelte`, `app/brief/+page.svelte`, `app/calendar/+page.svelte` + new `+page.server.ts`, `app/digest/+page.svelte` + new `+page.server.ts`, `app/practice/+page.svelte` + new `+page.server.ts`, `app/settings/+page.svelte` |

The two groups coordinated via a single contract: the deep-link URL `/app/courses?nodeId=<course.id>`. Group A implemented the reader on the graph side; Group B implemented the emitter on the dashboard side. Both worked independently without touching the other's files.

**Group A results:**

- Extended `Course` type with `signals: CourseSignal` (status, riskLevel, currentGrade, topics). The signals field is optional, so existing `.data/courses.json` entries without it still work via the `computeCourseSignals` defaults.
- Manage modal now collects status / risk level / current grade / topics, plus a tag input that allows custom values via `<input list="known-tags">` + `<datalist>`.
- `CourseNode.svelte` shows current grade and topic chips when present.
- Graph page got a `.page-cover` header with `field 03 · the graph` stamps and the canvas is now wrapped in `.surface-polaroid` with a tape corner.
- Toolbar collapsed from 12 buttons to 5 essential (add, organize, fit, health, help) plus graph-mode tabs. The rest moved into a `⋯` "more" popover.
- Added `$effect` reading `$page.url.searchParams.get('nodeId')` to deep-link into a specific node on mount.

**Group B results:**

- Sidebar renamed `Graph` → `Graph editor` to clarify the relationship with `Courses` (the manage table).
- Removed `Settings` from the sidebar (chose option (a) — the page was all "coming soon" placeholders, so removing the nav entry was the right call). Page is still routable but not advertised.
- Replaced all 3 `wizard-btn` instances in the dashboard file with `btn btn-primary`. Removed the unused `.wizard-btn` CSS block.
- Dashboard's `<button class="entry-item">` now navigates to `/app/courses?nodeId=${course.id}` via `goto(resolveRoute(...))`.
- Created `+page.server.ts` for calendar, digest, practice. Each returns empty data shapes (`{ events: [] }`, `{ digests: [], overview: null }`, `{ questions: [], flashcards: [], courses: [] }`). The three `+page.svelte` files now read from `data` and show polaroid-framed empty states when there's no data.
- Brief back button migrated to `btn btn-ghost btn-sm font-mono`. Removed `.back-btn` CSS.
- Dashboard's circled deadline count is now a button linking to `/app/courses/manage`. Hover state added.

**What I changed after both agents finished:**

- Ran `pnpm prettier --write .` to fix any formatting drift between the two agents. Clean.
- Ran `pnpm eslint .` — 34 errors, all pre-existing (`{#each}` block keys, unused `_` in for-loops, unused `data` prop destructure). None introduced by the agents.
- Verified the deep-link contract on both sides: `grep nodeId` shows the dashboard emits `/app/courses?nodeId=${course.id}` and the graph reads it from `$page.url.searchParams`. The two implementations match.

**Lessons:**

- File-ownership partitioning for parallel agents is cleanest when the project has well-bounded modules. Synapse's pages are mostly self-contained, so a "data layer vs. UI" split worked well. A more interconnected frontend would have needed different boundaries.
- The URL contract (deep-link via query param) is a good pattern for inter-agent coordination. It's stateless, has a single source of truth (the URL), and can be implemented independently on both sides.
- The agents correctly flagged pre-existing lint errors as not their problem. Useful behavior — they didn't try to fix unrelated issues.

**Verification:** `pnpm prettier --check` clean. `pnpm eslint` shows 34 pre-existing errors in non-touched files. Both agents' files are clean.

---

## 13. Academic Catalog UI Direction (June 24)

### Prompt (to OpenCode Go, multi-turn)

> "make the ui feel more academic / catalog-like" → follow-up feedback rejecting notebook ornaments like stamps, hand-drawn arrows, date tapes, page footers, and small decorative labels.

**Context:** The app had gone through a Field Notebook visual direction, but it was drifting into decorative UI. I wanted the product to feel like an academic catalog: structured, mature, readable, and intentional, without fake notebook artifacts.

**What came back:** A full visual direction shift across `/app/*`:

- New catalog design primitives: `CatalogHeader`, `IndexBar`, `BookCard`, `BookShelf`, `SectionHead`, `StatusChip`, `TermBlock`, `TermList`
- Reworked global tokens in `src/routes/layout.css`
- Font system using Kalam for brand/title accents, Source Serif 4 for display, JetBrains Mono for data labels, and Inter for body text
- Sidebar redesigned into a paper-shelf catalog layout with a red left-border active state
- Dashboard, Calendar, Digest, Practice, Brief, Manage Courses, Semesters, and Syllabus brought into the same page-cover/catalog system

**What I changed:**

- Rejected the first pass of decorative notebook elements because they looked too gimmicky.
- Asked for smaller UI to be removed or scaled up; labels under readable size were not acceptable.
- Asked to remove misleading fake metadata like fake dates, fake "today" badges, or untrusted deadline counts.
- Removed Settings from the sidebar because it was a dead placeholder route.

**Verification:** Prettier and focused lint/type checks were run during the implementation. Impeccable audit later reported 0 findings on the `/app` routes.

---

## 14. Course Detail Page + Material Uploads (June 25)

### Prompt (to OpenCode Go)

> "courses need their own detail page. also each course should have materials. also when i click into a course i need to go back to where i came from."

**Context:** The course graph and manage table listed courses, but there was no per-course destination. Users needed a detail page that showed course status, topics, graph relationships, and uploaded course files. The back behavior also needed to return to the exact origin page instead of always going to one hardcoded page.

**What came back:**

- New dynamic route: `src/routes/app/courses/[id]/+page.svelte`
- New loader: `src/routes/app/courses/[id]/+page.server.ts`
- Detail page sections: course cover, status strip, topics, incoming/outgoing graph connections, materials, and activity
- Backref design using `?from=` query param, validated as an internal path and defaulting to `/app/courses/manage`
- Links from Dashboard, Manage Courses, and Course Graph now include `?from=<current path>`
- New `Material` type and file storage functions in `src/lib/server/store.ts`
- New upload/list/delete API: `/api/courses/[id]/materials`
- New download API: `/api/courses/[id]/materials/[materialId]/download`
- Materials UI with drag/drop upload, multi-file selection, list, file-kind chip, download link, size/date metadata, and delete button

**What I changed:**

- Required any file type, not just PDFs, because course materials include slides, docs, images, and other formats.
- Chose `?from=` over browser history because direct deep links still need a deterministic fallback.
- Kept the implementation local-file based under `.data/uploads/` rather than introducing cloud storage before it was needed.
- Kept Demi-owned backend/AI logic out of scope except for shared store additions needed by the UI.

**Verification:**

- Uploaded a test text file through the API and received `200`
- Listed course materials and confirmed the uploaded file appeared
- Downloaded the uploaded file and confirmed contents matched
- Deleted the material and confirmed list returned empty
- Checked nonexistent course upload returns `404`
- Focused eslint and `svelte-check` clean for the new route/API files

---

## 15. Demi PR Merge and Conflict Reconciliation (June 25)

### Prompt (to OpenCode Go)

> "i want to merge the pr demi made. and make sure there are no conflicts. she added her stuff using the older ui. i want to keep her backend as it is and keep the current state of my code. ask me questions if needed"

**Context:** Demi's PR #4 (`codex/syllabus-intelligence-ui`) added syllabus parser/backend work, but also included an older UI version. My local app already had the newer catalog UI and manually integrated compatible syllabus backend pieces. The goal was to merge her PR without losing my current UI.

**What came back:**

- Inspected PR #4 changed files and identified the risky overlaps:
  - `src/routes/app/+layout.svelte`
  - `src/routes/app/syllabus/+page.svelte`
  - `src/lib/server/store.ts`
  - `package.json`
  - `pnpm-lock.yaml`
- Imported/kept Demi backend pieces:
  - `openai`
  - `pdf-parse`
  - `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` env examples
  - `src/lib/server/syllabus-parser.ts`
  - `/api/syllabus`, `/api/syllabus/extract`, `/api/syllabus/textbook`
  - syllabus import types and store functions
- Preserved current catalog UI versions of the layout and syllabus page
- Committed the current local work before merging the remote PR
- Merged PR #4 on GitHub
- Fetched `origin/main`, merged it locally, resolved conflicts in favor of the current UI and already-merged backend
- Pushed final `main` back to GitHub

**What I changed:**

- I chose not to run a blind `git pull` because the working tree had many uncommitted UI changes and the PR touched the same files.
- I asked the agent to follow the safest path: commit first, merge PR remotely, fetch, merge locally, resolve conflicts deliberately.
- I kept Demi's backend/API behavior but rejected older UI chunks from her PR.

**Verification:**

- `git status` clean before final push
- No conflict markers found
- Focused eslint clean for merged syllabus backend + syllabus UI
- Focused `svelte-check` clean for merged files
- Syllabus endpoints returned `200` after the merge:
  - `GET /api/syllabus`
  - `POST /api/syllabus/extract`

---

## Summary of AI Usage Pattern

| Phase                            | Tool         | Prompt Count | AI Output                        | Human Review                                     |
| -------------------------------- | ------------ | ------------ | -------------------------------- | ------------------------------------------------ |
| Proposal drafting                | Hermes Agent | ~4           | Structured text                  | Heavy edits, replaced entire sections            |
| Proposal formatting              | Hermes Agent | ~2           | HTML/DOCX                        | Template verification, spacing fixes             |
| Course graph UI                  | Hermes Agent | ~2           | 600+ lines Svelte                | Type fixes, edge validation                      |
| API integration                  | Hermes Agent | ~1           | Type definitions                 | Reviewed and accepted                            |
| Course brief                     | Hermes Agent | ~1           | Full feature + API               | Type alignment, fallback handling                |
| Layout bug fix                   | OpenCode Go  | 1            | One-line CSS fix                 | Ran prettier                                     |
| Manage page polish               | OpenCode Go  | 1            | Two CSS tweaks                   | None needed                                      |
| Dashboard shape                  | OpenCode Go  | 1            | Brief + impl                     | Lint adjustments, semantic checks                |
| Dashboard depth                  | OpenCode Go  | 1            | Full restyle                     | Mobile media query scoping                       |
| App UI overhaul                  | OpenCode Go  | 1            | All P0–P4 priorities             | Lint, a11y on flashcard, intentional non-changes |
| UX audit + 2-agent parallel impl | OpenCode Go  | 3            | 14-issue list, 2 parallel agents | File-ownership check, contract verification      |
| Academic catalog UI direction    | OpenCode Go  | ~4           | App-wide catalog redesign        | Rejected gimmicks, preserved trusted data only   |
| Course detail + materials        | OpenCode Go  | ~2           | Detail route + upload APIs       | File type scope, backref design, API tests       |
| Demi PR merge reconciliation     | OpenCode Go  | ~3           | Safe merge + conflict resolution | Preserved current UI, verified backend endpoints |

**Key principle:** AI output is always reviewed. Nothing goes from prompt to submission without verification. The most valuable AI contribution was accelerating the scaffolding (proposal structure, graph canvas boilerplate, design system primitives) so I could focus on the parts that needed human judgment (architecture decisions, data model, quality control, deciding what NOT to change).

**Key principle (parallel agents):** When splitting work across multiple agents, use file-ownership partitioning, not issue-ownership partitioning. The contract between agents should be a stateless, well-defined surface (URL, API, file format), not implicit shared state. Both agents in this run were able to work independently because the deep-link contract was a single URL query param — neither needed to read the other's output to verify their work.

---

## 16. Full Course Briefing Rewrite — D1, Async Jobs, Web Search (June 25)

### Prompt (to Codex, multi-turn)

> "implement the course briefing feature end to end. you can use my openrouter api key to make it works. do not read the key. i will be using cloudflare D1 for this."

**Context:** The Course Brief feature was using a flat JSON file store and had hardcoded fallback data. Needed a real database, proper async job queue, and LLM integration.

**What came back across ~15 turns:**

**D1 Infrastructure:**
- New D1 schema (`briefings`, `briefing_jobs`, `prompt_cache`, `insights` tables)
- D1 client helper with full CRUD (`getBriefs`, `saveBrief`, `deleteBrief` — also cleans jobs + cache)
- Drizzle config for D1 migrations
- Migration files for all tables, applied to both local and remote D1

**Async Job Queue:**
- `createBriefingRunner()` in `src/lib/server/briefing/runner.ts` with `claimNextJob`, `createJob`, `completeJob`, `failJob`, `getJobs`, `getJob`, `getAllJobs`, `cancelJob` + prompt cache (7-day TTL)
- `POST /api/briefing/jobs` — creates a job, fires background processing via `platform.ctx.waitUntil`
- `GET /api/briefing/jobs?courseCode=X` — list jobs for a course
- `GET /api/briefing/jobs/[id]` — poll single job status
- Output validation module (`src/lib/server/briefing/validation.ts`)

**Frontend:**
- Full async UI: create job → poll every 2s → 3-step visual progress tracker (Queued → Researching → Complete) with animated pulse dot
- Delete button with confirmation two-step flow
- Retry button on failure

**LLM Integration:**
- Switched from `process.env` → `$env/dynamic/private`
- Fixed `response_format` incompatibility with DeepSeek models
- Added `plugins: [{ id: "web" }]` for actual web search
- Fixed response parsing: `content` fallback → `reasoning`, JSON extraction by brace matching (handles thinking tokens)

**What I changed:**
- Fixed `platform.ctx.waitUntil` being a no-op in dev mode (fired promise directly)
- Removed `lastSuccess` shortcut that bypassed job creation
- Fixed cache key to use stable context hash (excluded timestamp)
- Fixed `clearInterval` before `pollTimer = null` ordering
- Rewrote Drizzle row mapping after understanding D1 ORM field name conventions
- Removed both hardcoded fallbacks and mock syllabus data entirely

**Verification:** Build clean, svelte-check clean. Remote D1 has all tables created and migrated.

---

## 17. Bits-UI Theme Alignment + Design System Audit (June 25)

### Prompt (to Codex)

> "make all the interactive components match the theme. it includes all bitsui primitives"

**Context:** The bits-ui component wrappers (Button, Checkbox, Dialog, AlertDialog, DropdownMenu, Input, Select, Textarea, ToggleGroup, Toolbar) had inconsistent styling: hardcoded `#fbf8f0` backgrounds, non-zero border-radius, wrong font families, and mismatched focus rings.

**What came back:** All 10 components updated to use the Field Notebook design system tokens (`var(--paper)`, `var(--ink)`, `var(--highlight)`, `var(--ink-soft)`), flat corners (`border-radius: 0`), consistent focus styles (highlight for inputs, ink for buttons), and proper transitions with `var(--ease-out-quart)`.

**What I changed:**
- ToggleGroup selected state: solid ink bg → highlighter yellow per DESIGN.md
- Button primary hover: hardcoded `#2a2a27` → `var(--ink)` with opacity
- Input disabled bg: hand-mixed rgba → `var(--paper-edge)`

**Follow-up: Delight skill (June 25):**
- Checkbox: stamp-pop scale animation on check
- Dialog/AlertDialog: gentle fade-in entrance animation
- DropdownMenu: scale + translate entrance
- Input/Textarea: border + shadow transition on focus
- Select: item background transition on hover
- ToggleGroup: press-down on active items
- Toolbar: subtle opacity fade on child hover

**Verification:** Build clean.

---

## 18. DESIGN.md Rewrite — Full Catalog App Description (June 25)

### Prompt (to Codex)

> "i dont think the design.md file reflects what we have right now. update it to match the design"

**Context:** The DESIGN.md was written when most app pages were placeholders. It still described the Syllabus Intelligence feature as a future direction, listed Calendar/Digest/Practice as placeholder pages, and didn't document the actual interactive controls, theme tokens, or sidebar behavior.

**What came back:** Complete DESIGN.md rewrite:
- Colors section: added `--paper-shelf`, `--rule` variants, `--subject-*` fills, `--ease-out-quart`, `--sidebar-width`
- Typography: added `--font-display` (Source Serif 4) and `--font-mono` (JetBrains Mono) usage rules
- New sections: "Animations and Motion" (every component's transition documented), "Interactive Controls" (bits-ui primitive specs)
- App Shell: accurate sidebar description (paper-shelf bg, accent-red active border, no "vol. 01" tape)
- App Pages: all 10 implemented pages described with real features, none called "placeholder"
- Focus/Accessibility: documented the highlight/ink split for focus rings
- Implementation notes: references bits-ui components

**Verification:** Build clean.

---

## 19. Full UI Audit — Hardcoded Colors, Breakpoints, CSS Quality (June 25–26)

### Prompt (to Codex)

> "do an audit of the ui. find any inconsistencies, bad code, hacky fixes, etc. find and fix all of them. refer to your agents.md file"

**Context:** The UI had accumulated inconsistencies from rapid iteration — unused imports, hardcoded colors, non-standard breakpoints, redundant CSS variable fallbacks, missing overflow protection.

**What came back across 3 rounds:**

**Round 1 — CSS consolidation:**
- Replaced `#fbf8f0` → `var(--surface-paper)`, `#2e2e28` → `var(--ink)` with opacity
- Added CSS variables: `--surface-paper`, `--border-faint`, `--border-soft`, `--border-input`, `--backdrop-overlay`, `--backdrop-faint`
- Semantic z-index scale through `--z-*` variables in layout.css
- Removed Tailwind CSS entirely (not actually used, was ~800KB dependency)
- All 10+ transitions without easing updated to use `var(--ease-out-quart)`
- Kalam 400 font import removed (only 700 used)

**Round 2 — Breakpoints + structure:**
- Standardized from 13 disjoint breakpoints to 3: 640px / 768px / 1024px
- Fixed sidebar/FAB overlap at 768px (sidebar hides at 767px)
- Unified max-widths: 1100px (list pages), 900px (detail pages), 500px (flashcard)
- Fixed unused imports, removed dead CSS classes, collapsed malformed button HTML

**Round 3 — Overflow:**
- Syllabus grid column `minmax(480px, 1.4fr)` → `1fr` (was overflowing 1100px container)
- Added `overflow: hidden` + `text-overflow: ellipsis` to sidebar labels, code cells, material actions
- Added `overflow-wrap: break-word` to brief field values, practice questions, calendar items
- Calendar day nav buttons: removed from tiny 1.75rem square constraint, given proper padding

**Verification:** Build clean. 0 theming issues found in subsequent re-audit.

---

## 20. Calendar Intelligence System — Google Removal, CRUD, Grade Analytics (June 25–26)

### Prompt (to Codex, multi-turn)

> "remove the google calendar integration. instead of that, make your own calendar integration. it must play into the AI intelligence system."

**Context:** The Google Calendar integration (OAuth, sync, token refresh) was complex, fragile, and duplicative of Google's own strengths. Needed a purpose-built calendar system with grade awareness and AI context generation.

**What came back:**

**Google removal:**
- Deleted all Google API routes (authorize, callback, disconnect, status, sync)
- Deleted `src/lib/server/google/calendar.ts`
- Removed GoogleTokenStore, GoogleSyncedEvent, all Google functions from store.ts
- Removed Google UI from settings page and calendar page
- Cleaned env vars from `.env`, `.env.example`, `env.d.ts`, `wrangler.jsonc`

**Enhanced calendar_events schema:**
- Added `grade_weight` (integer, percentage of final grade)
- Added `status` (pending / completed / at_risk)
- Added `notes` (free text)
- D1 migration applied to both local and remote

**Calendar intelligence module (`src/lib/server/calendar/intelligence.ts`):**
- Crunch detection: clusters events within 4 days, calculates density score + total grade weight at stake
- Grade stakes: per-event weight, impact per point, links to course grades
- Study gaps: long gaps between events for same course → review suggestions
- Full context string: human-readable summary for AI features (digest, practice, brief)

**Mindblowing calendar UI:**
- Grade weight bars in month grid cells
- Crunch zone cards in sidebar (red-bordered, events listed, weight at stake)
- Weight visualization bar charts
- Status badges (done/at-risk) in popovers and sidebar
- Quick action buttons: ✓ mark complete, ! flag at-risk, × delete
- Enhanced add form with grade weight % and Study Session type
- Calendar grid always renders even without events
- Removed cluttered course legend (sidebar filter chips suffice)

**What I changed:**
- Fixed multiple `{@const}` scoping issues in Svelte 5 template
- Fixed orphaned `{/if}` from removed empty state
- Removed outer `events.length > 0` guard hiding the entire sidebar
- Added welcoming empty state in sidebar when no events exist
- Made click-any-day popover open even for days without events
- Added permanent "+ event" button in calendar header

**Verification:** Build clean. All 29 calendar features verified.

---

## 21. Activity Page — Job History, Running Indicator, Sidebar Badge (June 26)

### Prompt (to Codex)

> "make a route for all the ai tasks ever executed, currently running and a option to stop them. also, this route should be accessible from the sidebar. while the job is running the sidebar must have an appropriate icon depicting a job is running. after the job is done, it must turn into a number."

**Context:** There was no unified view of AI task status. Jobs were created per-course on the Brief page but there was no way to see all jobs, cancel a stuck one, or know if a new result was waiting.

**What came back:**

**Infrastructure:**
- `getAllJobs()` in runner — returns last 100 jobs across all courses
- `cancelJob()` — cancels queued/running jobs
- `GET /api/briefing/activity` — list all jobs
- `POST /api/briefing/activity` with `{ action: 'cancel', jobId }` — cancel endpoint

**Activity page (`/app/activity`):**
- Full job list with status indicators (queued/running/succeeded/failed/canceled)
- Timestamps with relative time ("3m ago", "2h ago")
- Error messages displayed inline
- Cancel button (only on queued/running jobs)
- Auto-polls every 5s when active jobs exist, stops when idle
- Marks jobs as read on visit via localStorage

**Sidebar badge system (`+layout.svelte`):**
- Polls activity API every 10s
- **Job running**: pulsing amber dot next to "Activity"
- **Completed + unread**: red badge with count
- "Read" state tracked via `localStorage.getItem('activity_last_read')`
- Works on both desktop sidebar and mobile FAB nav

**Code quality fixes (round 2 — "make sure its not hacky"):**
- Activity page: removed dead `statusVariant()` function, fixed loading flicker on polling refetches
- Activity API: added JSON parse error handling, jobId type/empty validation
- Layout: added error logging to catch block, fixed interval leak (cleanup uses local id ref), fixed fragile localStorage fallback
- Fixed infinite loop bug: `$effect` tracked `jobs` as reactive dependency because `loadJobs()` read `jobs.length` — replaced with `onMount` for initial load

**Verification:** Build clean. 19/19 requirement audit checks pass.

---

## 22. AI Usage Log Update (June 26)

### Prompt (to Codex)

> "update the ai usage log accordingly after reading it"

**Context:** Entries 16–21 needed to be appended to the log after the session's work was complete.

**What came back:** This entry.

---

## 23. Course Briefing Prompt + Web Search Hardening (June 26)

### Prompt (to Codex, multi-turn)

> "harden and improve the course research prompt itself. leave the least chance for an error. im using deepseek v4 flash with it so adjust accordingly"

> "the model is missing obvious stuff from a web search..."

> "refer to this https://openrouter.ai/docs/guides/features/server-tools/web-search"

**Context:** The Course Briefing agent was too willing to stop after the first official catalog result. In the CSIS 3560 / Gabriel Vitus / Douglas College test case, it leaned on an old 2021 outline, failed to work hard enough on professor/RMP evidence, and treated OpenRouter-injected search snippets as if they were user-provided context. The app was also still using the older OpenRouter plugin-style web search format.

**What changed:**
- Moved the briefing instructions into `src/lib/server/briefing/prompt.ts` as a shared prompt module used by both briefing endpoints.
- Reworked the system prompt for DeepSeek v4 Flash: JSON-only output, no markdown, no extra keys, compact fields, no invented facts, and explicit null/empty-array behavior.
- Added mandatory search coverage: course + institution, course outline/syllabus, timetable/section instructor, professor + institution, professor + course, professor + RateMyProfessor.
- Added exact dynamic search targets to the user prompt so cases like `CSIS 3560`, `Gabriel Vitus`, and `Douglas College` force professor-specific and RMP-specific searches before the model can conclude "not verified".
- Added a minimum-effort gate: the model must not finalize after only finding the catalog page, and missing professor/RMP attempts must be represented as `found: false` source entries instead of silently disappearing.
- Added source-recency rules: dated old term pages like `/202130` are historical unless the user asked for that term, and old historical pages cannot fill current instructor, weekly hours, grading, delivery mode, or restrictions.
- Added explicit professor-preservation rules: if a professor is supplied but not verified for the course, the output should keep the name as `Professor Name (provided, not verified for this course)` instead of replacing it with `Not found`.
- Added web-search context rules so OpenRouter-injected snippets are treated as search results, not as user instructions or reliable current truth.
- Switched OpenRouter web search from legacy `plugins: [{ id: "web" }]` to the documented server tool shape: `tools: [{ type: "openrouter:web_search", parameters: ... }]`.
- Configured the web tool to use Exa, request more total search results, medium search context, and exclude `cliffsnotes.com`.

**What I changed during review:**
- Removed the old `COURSE_BRIEFING_WEB_PLUGIN` path entirely from briefing endpoints.
- Updated both `POST /api/briefing/jobs` and `POST /api/brief` to use the shared `COURSE_BRIEFING_WEB_TOOL`.
- Kept validation as the final safety net: `extractBriefingJson()` and `validateBriefingPayload()` still reject malformed JSON, missing found sources, fake found URLs, and unsupported output shapes before storage.

**Verification:** `vitest` passed for briefing prompt, validation, and runner specs. `vite build` passed; the remaining warnings were pre-existing Svelte warnings in calendar, landing, and course-detail pages.

---

## Summary of AI Usage Pattern (Updated June 26)

| Phase | Tool | Prompt Count | AI Output | Human Review |
|-------|------|--------------|-----------|-------------|
| ... | ... | ... | (entries 1–15 unchanged) | ... |
| Course Brief → D1 + async jobs | Codex | ~15 | D1 schema, job queue runner, full-stack async UI, LLM integration | Web search format fix, reasoning response parsing, cache key stability, interval lifecycle |
| Bits-ui theme alignment | Codex | 2 | 10 components rewired to design tokens | ToggleGroup selected state, Button primary hover, Input disabled bg |
| DESIGN.md rewrite | Codex | 1 | Full 13-section design document | Every section updated to match actual codebase |
| UI audit + repair | Codex | ~6 | CSS consolidation, breakpoints, overflow, unused code removal | Reverted one wrong grid cell fix, kept Google blue as intentional brand color |
| Calendar intelligence | Codex | ~8 | Google removal, D1 CRUD, crunch/gap/stakes engine, enhanced UI | Multiple template scoping fixes, sidebar visibility bug, popover accessibility |
| Activity page + sidebar badge | Codex | ~3 | Runner functions, API endpoint, activity page, sidebar polling/badge system | Fixed infinite $effect loop, added input validation, fixed interval leak |
| AI usage log | Codex | 1 | This entry | All session entries verified against what shipped |
| Course briefing prompt hardening | Codex | ~6 | Shared prompt module, strict research protocol, OpenRouter server-tool web search | Adjusted for DeepSeek Flash, stale-source handling, professor/RMP search coverage, validation-backed output |

**Key principle (this session):** The most valuable pattern was the D1-backed async job queue — it made the entire app's AI features (briefing, future digest, practice) follow the same reliable pattern: create job → poll → display result. Everything after that was scaffolding on the same foundation.

**Key principle (briefing hardening):** For research-style AI features, the prompt should force search coverage and evidence accounting, but the application still needs schema validation and source checks after generation. The model is allowed to say "not found"; it is not allowed to skip the search categories that would prove that.
