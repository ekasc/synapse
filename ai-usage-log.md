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

**Key principle:** AI output is always reviewed. Nothing goes from prompt to submission without verification. The most valuable AI contribution was accelerating the scaffolding (proposal structure, graph canvas boilerplate, design system primitives) so I could focus on the parts that needed human judgment (architecture decisions, data model, quality control, deciding what NOT to change).

**Key principle (parallel agents):** When splitting work across multiple agents, use file-ownership partitioning, not issue-ownership partitioning. The contract between agents should be a stateless, well-defined surface (URL, API, file format), not implicit shared state. Both agents in this run were able to work independently because the deep-link contract was a single URL query param — neither needed to read the other's output to verify their work.
