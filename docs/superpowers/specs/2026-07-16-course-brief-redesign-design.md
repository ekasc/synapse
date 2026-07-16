# Course Brief Page Redesign Design

## Scope

Tear down the current `/app/brief` page and rebuild it as a research notebook: library-first, with a sticky research-request slip at the top and a redesigned detail view on its own route.

The redesign covers three concerns, all approved:

1. **Visual refresh** — modernize the page within the existing Field Notebook system, using current design tokens and rules.
2. **Structural redesign** — the briefing detail view becomes a separate route with a hero, sticky sidebar, and narrative column. The library becomes a list of dated notebook entries.
3. **UX overhaul** — the form hides four of five fields behind a "more options" gate; the job tracker transforms the form in place; failure states are unified; the in-page text filter is removed.

`FEATURES.md` assigns Course Intelligence Brief (#4) and Frontend UI (#3) to Ekas. The redesign stays inside that scope. No backend changes, no schema changes, no changes to the briefing pipeline, prompt contract, D1 cache, or job runner. The server load in `+page.server.ts` is read but not modified beyond what the new detail route requires.

## Goals and Non-Goals

**Goals**

- The page reads as a research log, not a SaaS dashboard.
- The library is always visible above the fold. The form is a sticky header, not a takeover.
- A single highlighter strip is the loudest element on any detail view.
- A research job takes 1–3 minutes; the slip surfaces progress without hijacking the page.
- Every failure has one path: a retry button in the slip.

**Non-Goals**

- Comparing two briefs side by side.
- Sharing or exporting briefs.
- Tags, folders, or any classification beyond what already exists.
- Text search or filter on the library.
- New design tokens, new fonts, new colors.
- Touching Demi-owned code (AI syllabus parser, grade analytics, NL query, study timer, CSV import/export, shared DB infrastructure).

## Architecture

### Two routes, not one page with states

| Route | Purpose | Owns |
|---|---|---|
| `/app/brief` | The library | Form state, job polling, library rendering, empty state |
| `/app/brief/[code]` | A single brief | Read-only rendering of one `BriefingDetailViewModel`; delete + refresh actions |

The detail view is a separate route, not an in-page expansion of the library. This keeps the library-first metaphor clean and makes briefs URL-shareable and back-button friendly.

### Server load changes

`/app/brief` server load returns the full list of `BriefingDetailViewModel` items. **Sort changes from `code` ascending to `researchedAt` descending** so the most recent brief is first. This is a one-line change in `+page.server.ts`.

`/app/brief/[code]` is a new server load that takes the code from the URL, finds the matching `BriefingDetailViewModel`, and returns it. If no match, the page renders a "not found" empty state. If the load throws, the page renders an "error" empty state. The DB call goes through the existing `db.getBriefs()` — no new endpoint.

### Polling lives on the library only

`/app/brief/[code]` does not show job progress. If a user clicks a brief that doesn't exist yet (because a research job hasn't finished), the link won't work. The library's job tracker is the only place progress is shown. This is intentional: the user is on the library page during the 1–3 minute wait.

## The Library (`/app/brief`)

### Page regions

```
┌─────────────────────────────────────────────────────────────┐
│  ①  STICKY RESEARCH SLIP                                   │  ← always visible at top
│     • idle: form (compact)                                  │
│     • researching: job tracker (replaces form in place)     │
│     • succeeded: one-line confirmation                      │
├─────────────────────────────────────────────────────────────┤
│  ②  PAGE HEADER (only when entries exist)                  │  ← "Course Brief" + count
├─────────────────────────────────────────────────────────────┤
│  ③  THE NOTEBOOK                                            │  ← entries, most recent first
│     • empty state in the same column when no entries        │
└─────────────────────────────────────────────────────────────┘
```

The page is a single scroll. The slip is `position: sticky; top: 0` on desktop.

### The entry

```
┌──────────────────────────────────────────────────────────────────┐
│ ▌  MAR 12 2025 · 14:22                                            │
│ ▌  ─────────────────────────────────────────────────────────     │
│ ▌  CSIS 3375                                          [4.2 / 5]  │
│ ▌                                                              │   │
│ ▌  Data Mining                                                │   │
│ ▌                                                              │   │
│ ▌  Prof. Smith · Spring 2026 · 3 credits · 8 sources              │
└──────────────────────────────────────────────────────────────────┘
```

- **Subject stripe:** 4px wide, full row height, color from `--subject-*` tokens. Renders only on the left edge.
- **Date stamp:** top-left, JetBrains Mono, `--ink-faint`, uppercase, letter-spaced, format `MMM DD YYYY · HH:MM`.
- **Course code:** JetBrains Mono, `0.85rem`, uppercase, letter-spaced, `--ink`.
- **Course title:** Kalam 700, `1.4rem`, `--ink`. Dominant element of the row.
- **RMP chip:** right-aligned, Inter `0.78rem`. Background `--highlight-soft` if rating ≥ 4, `--paper-shelf` if 3–3.9, `--pen-red` background (white text) if < 3, `--paper-shelf` with "N/A" if no data. Format: `X.X / 5`.
- **Meta line:** Inter `0.82rem`, `--ink-soft`, separated by ` · `. Includes requested professor, term, credits (if available), source count.
- **Padding:** 1.25rem vertical, 1.5rem horizontal.
- **Separator:** 1px `--rule-soft` between entries.
- **Hover:** background shifts to `--paper-shelf`, subject stripe stays. Title gets `translateY(-1px)`.
- **Focus:** outline `2px var(--ink)`, offset 2px.
- **Click:** navigates to `/app/brief/[code]`.

The row deliberately does not show: thumbnails, logos, item-count badges, in-row buttons (refresh/delete live in the detail view), polaroid frames, or tape.

### Library header

- "Course Brief" in Kalam 700, `1.5rem`.
- Count in mono on the right.
- Subtitle in `--ink-soft`, `0.9rem`.
- Header only renders when at least one entry exists.

### Empty state

```
                       Your notebook is empty.                    ← Kalam 700
              Research a course to start your first brief.        ← Inter, ink-soft
                       e.g. CSIS 3375                             ← Mono, ink-faint
```

- Centered, `6rem` vertical padding.
- Single dashed border box (`--rule-soft`, 1px dashed). Not a polaroid, not a card.
- No illustration. Typography does the work.
- The form above is the only call to action.

### Sorting and filtering

- **Default sort:** most recently researched first (descending by `researchedAt`).
- **No client-side text filter.** The current in-page filter (5 fields) is removed.
- **No pagination.** Expected count is small (5–20 entries).

## The Research Request Slip

The slip is a single component with three states: **idle**, **researching**, **terminal** (succeeded, failed, conflict, expired, canceled). Transitions happen in place — same height, no layout shift, no popup.

### Idle state

```
┌──────────────────────────────────────────────────────────────────┐
│  RESEARCH REQUEST                                       MAR 12    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  CSIS 3375                                       [ Research → ]  │
│  ▸ more options (course name, professor, institution, notes)     │
└──────────────────────────────────────────────────────────────────┘
```

- **Container:** `var(--paper-shelf)` background, 1px `var(--rule)` border, no rounded corners.
- **Top label:** "RESEARCH REQUEST" in JetBrains Mono, `0.72rem`, uppercase, letter-spaced, `var(--ink-faint)`. Date stamp on the right.
- **Hairline rule:** 1px `var(--rule-soft)` below the label.
- **Course code input:** Inter, `1.1rem`, weight 500, no border, `var(--paper)` background. Full width, `min-height: 2.75rem`. Placeholder: "Course code (e.g. CSIS 3375, MATH 1130)".
- **Submit button:** primary, right-aligned, `min-width: 9rem`. Text: "Research →" when idle, "Researching…" when in-flight.
- **More options link:** small mono link below the input. Toggles a panel with the four optional fields.

### More options (expanded)

```
┌──────────────────────────────────────────────────────────────────┐
│  RESEARCH REQUEST                                       MAR 12    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  CSIS 3375                                       [ Research → ]  │
│  ▾ less options                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Course name       [_____________________________________]   │ │
│  │ Professor name    [_____________________________________]   │ │
│  │ Institution       [_____________________________________]   │ │
│  │ Notes             [_____________________________________]   │ │
│  │                   [_____________________________________]   │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

- Four small inputs in a 2×2 grid on desktop; stacked on mobile.
- Each field has a small mono label above it (`0.7rem`, `var(--ink-faint)`, uppercase).
- All fields optional. Course code remains the only required input.
- Animation: 180ms `var(--ease-out-quart)` slide-down + fade-in.

The "more options" gate shrinks the form by ~60% in the common case. The common case is "I have a course code, research it." The four other fields help narrow the search and earn their space when needed.

### Researching state

```
┌──────────────────────────────────────────────────────────────────┐
│  RESEARCHING · CSIS 3375                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  ●━━━━●━━━━●━━━━●━━━━●━━━━○━━━━○━━━━○                              │
│  Checking instructor assignment evidence…         [ stop ]       │
└──────────────────────────────────────────────────────────────────┘
```

- **Label:** "RESEARCHING · CSIS 3375" in mono, uppercase.
- **Progress dots:** 8 dots in a row, connected by 1px hairline rules. Each dot is 8px diameter. Filled dots are `var(--ink)`, unfilled are `var(--rule)`. Last filled dot has a subtle pulsing animation (`@keyframes pulse`, already defined in current code).
- **Stage label:** Inter `0.95rem`, `var(--ink-soft)`. Updates as the job progresses through stages. Uses the same `stageLabel()` function as current code.
- **Cancel button:** small ghost button, right-aligned. Text: "stop".
- **Cache hit indicator:** small mono line below the stage label, "Loaded from saved research cache" — only if `cacheHit` is true.
- **Telemetry:** small mono line below, `8 searches · cost $0.04 · deepseek-v4` — only if telemetry is present.

### Succeeded state

```
┌──────────────────────────────────────────────────────────────────┐
│  ✓  CSIS 3375 ready — view brief →              MAR 12 14:31      │
└──────────────────────────────────────────────────────────────────┘
```

- 1-line height, no border bottom, thin top rule.
- Clicking "view brief →" navigates to `/app/brief/[code]`.
- The slip auto-collapses to nothing 4 seconds after the success poll returns.

### Failed / conflict / expired state

```
┌──────────────────────────────────────────────────────────────────┐
│  ✕  CSIS 3375 — official sources conflict          MAR 12 14:31   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Could not resolve official course evidence.    [ retry ]        │
└──────────────────────────────────────────────────────────────────┘
```

- Label uses `--pen-red`.
- Error message in Inter, `var(--ink-soft)`.
- Retry button is a small secondary button.
- Cancel button removed (job is terminal).
- Polling stops; user can edit inputs and retry.

### Canceled state

- Slip returns to idle with `jobErrorMsg = "Research canceled. You can retry when ready."`.

### Slip state transitions

| From | To | Trigger |
|---|---|---|
| idle → researching | submit click | Form valid (code non-empty), job created |
| researching → succeeded | poll returns success | After brief saved, navigate to detail |
| researching → failed | poll returns error | Show failed UI in slip |
| researching → conflict | poll returns conflict | Show conflict UI in slip |
| researching → expired | poll returns expired | Show expired UI in slip |
| researching → canceled | cancel button click | Show canceled UI; re-enable form |
| succeeded → idle | user navigates to detail | One-line confirmation appears, then collapses |

### Mobile slip

- Sticky at top, smaller padding (`0.75rem` instead of `1.25rem`).
- Submit button moves below the input (full-width).
- "More options" stays; expanded panel stacks fields.
- Progress dots compress to 6, or become a single progress bar.

## The Detail View (`/app/brief/[code]`)

Three regions: **hero**, **sticky right sidebar**, **narrative main column**.

### Hero

```
┌──────────────────────────────────────────────────────────────────┐
│  CSIS 3375                                              14:22    │
│  Data Mining                                                       │
│  University of the Fraser Valley                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  ▌  PREREQ: COMP 2110 with a grade of C- or better                │
└──────────────────────────────────────────────────────────────────┘
```

- **Container:** no border, no card, just spacing.
- **Course code:** JetBrains Mono, `0.85rem`, uppercase, letter-spaced, `var(--ink)`.
- **Course title:** Kalam 700, `clamp(2rem, 4vw, 3rem)`, `var(--ink)`. Dominant.
- **Institution:** Inter `1rem`, `var(--ink-soft)`.
- **Date:** mono, `0.78rem`, `var(--ink-faint)`, right-aligned, "Researched MMM DD, YYYY · HH:MM".
- **Highlighter strip:** the single most useful fact per brief — prereqs if known, otherwise a different fallback. `var(--highlight)` background, `var(--ink)` text, Kalam 700, `1.4rem`, full width, `0.6rem` vertical padding. **One highlighter per detail view, no exceptions.**

### Sticky right sidebar

```
┌─────────────────────────────┐
│ QUICK FACTS                 │
│ ─────────────────────────── │
│ Credits       3             │
│ Delivery      In-person     │
│ Prereqs       COMP 2110     │
│ Corequisites  —             │
│                             │
│ CURRENT OFFERING            │
│ ─────────────────────────── │
│ Spring 2026                 │
│ Prof. Smith                 │
│ CRN 12345                   │
│                             │
│ NEXT OFFERING (if any)      │
│ ─────────────────────────── │
│ Fall 2026                   │
│ TBD                         │
│                             │
│ RMP RATING                  │
│ ─────────────────────────── │
│ 4.2 / 5                     │
│ 78% would take again        │
│ 42 ratings                  │
└─────────────────────────────┘
```

- **Container:** `var(--paper)` background, 1px `var(--rule)` border, `0` radius. Padding `1.25rem`. `position: sticky; top: 5rem` on desktop.
- **Section labels:** mono `0.7rem`, uppercase, letter-spaced, `var(--ink-faint)`. Hairline rule below.
- **Key-value rows:** label in mono `0.78rem` `var(--ink-soft)`, value in Inter `1rem` `var(--ink)`. 2-column grid.
- **RMP rating:** big Kalam number, `2.2rem`. Color: `--ok` for ≥4, `--ink` for 3–3.9, `--pen-red` for <3.
- **"—"** in Inter, `var(--ink-faint)` for missing values. Never blank.
- The whole sidebar is one bordered region divided by hairline rules — no cards-within-cards.

### Narrative main column

Five sections in this order. Each section title is Kalam 700, `1.5rem`, `var(--ink)`, with a hairline rule below.

#### ① About this course

- Renders only if `description.text` exists.
- Body: Inter `1rem`, `var(--ink)`, `line-height: 1.6`, `max-width: 72ch`.

#### ② Instructor

```
INSTRUCTOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUESTED        Prof. Smith
FACULTY          csis.ufv.ca/smith

WHAT STUDENTS SAY
"Engaging lectures; clear grading."                   ← positives
"Exams are tough but fair; weekly quizzes."

"Avoid if you can't keep up with the reading load."    ← concerns
"Office hours are limited."
```

- Requested + faculty as a 2-row key-value block.
- "WHAT STUDENTS SAY": positives and concerns as a single paragraph of inline quoted text, separated by `; `, no bullets. Each quote is a sentence. Positives in `var(--ink)`, concerns in `var(--ink-soft)`.
- Renders only if `studentSentiment` exists.

#### ③ Assessment

```
ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assessment              Weight
────────────────────    ──────
Assignments              25%
Midterm                  25%
Project                  20%
Final exam               30%

Passing requirements: Final ≥ 50%
```

- Assessment table: ruled paper style, no header background, 1px `var(--rule-soft)` between rows. Mono labels, Inter values, Inter weight values right-aligned.
- Passing requirements: mono label + Inter rule, one per line.
- Renders only if data exists.

#### ④ Research notes (contradictions + missing evidence)

- Section is a `<details>` element collapsed by default. Title: "RESEARCH NOTES (3)" with count.
- Contradictions: each line prefixed with a `⚠` glyph in `var(--warn)`. Text in `var(--ink-soft)`. One per line, `max-width: 72ch`.
- Missing evidence: each line prefixed with a `◇` glyph in `var(--ink-faint)`. Text in `var(--ink-soft)`. One per line.
- This is the only place where amber/warn colors appear in the detail view.

#### ⑤ Sources (footnotes)

- Numbered list. Mono number, Inter label, mono metadata (class · currentness), then URL on its own line in `var(--ink-soft)` with `↗` glyph.
- `<details>` collapsed by default. Title: "SOURCES (8)" with count.
- Each item is a real `<a>` to the source. Hover: underline, ink color.

### Action row (bottom of detail view)

```
                                                  [ Refresh research ]  [ Delete briefing ]
```

- Right-aligned, ghost buttons, Inter `0.82rem`. "Delete" uses `--pen-red` color.
- Delete requires confirmation: changes to "Delete this briefing? [cancel] [delete]" inline.
- Refresh pre-fills the form on the library page and starts a new job for the same code.

### Mobile detail view

- Hero stays the same (responsive title size).
- Sidebar becomes a "Quick facts" section at the top of the main column, above the narrative. Not sticky.
- Sections in main column stack normally.
- Highlighter strip stays full width.

## Polling

- **Interval:** 5 seconds (changed from 2 seconds in the current implementation).
- **Timeout:** 4 minutes. After 48 polls (5s × 48 = 240s, with some margin), the slip shows the timeout UI.
- **Endpoint:** `/api/briefing/jobs/[jobId]` — same as current code, unchanged.
- **Polling lives on `/app/brief` only.** The detail view does not poll.

The 5s interval is a deliberate tradeoff. A research job takes 1–3 minutes. 2s polling is more responsive but generates 30–90 requests per job. 5s polling generates 12–36 requests per job, which is gentler on the D1-backed queue and the user sees a 3–5s lag at most between stage transitions. The lag is invisible to the user because the slip already shows the most recent persisted stage on every poll.

## State Management

### Library page

Local component state only. No global stores.

**Form state:**
- `courseCode`, `courseName`, `professorName`, `institution`, `additionalNotes`
- `moreOptionsOpen`

**Polling state:**
- `activeJobId`, `jobStatus`, `jobStage`, `stageUpdatedAt`
- `jobErrorMsg`, `pollTimer`, `pollCount`, `pollTimedOut`
- `cacheHit`, `jobTelemetry`

**UI state:**
- `deleting`, `confirmDeleteCode`

Form state is ephemeral (lost on navigation). Library state comes from the server load.

### Detail page

Local component state:
- `deleting`, `confirmDeleteCode`

No polling, no form state.

### Cache invalidation

- After `succeeded`: navigate to `/app/brief/[code]`. The library load runs on next visit.
- After `delete`: `goto('/app/brief')` triggers a fresh load.
- The D1 cache (7-day TTL) is unchanged.

## Error Handling

| Failure | Where shown | UX |
|---|---|---|
| Empty course code on submit | Form input border | Red border, mono hint. No submission. |
| Server returns 5xx on job create | Slip (form → failed state) | "Couldn't start research. [retry]" |
| Job returns `failed` | Slip transforms to failed state | "Briefing failed. [retry]" |
| Job returns `conflict` | Slip transforms to conflict state | Server error message, "[retry]" |
| Job returns `expired` | Slip transforms to expired state | "Briefing expired. [retry]" |
| Polling times out (4 min) | Slip holds researching state with timeout message | "Briefing is taking longer than expected. [retry] [stop]" |
| Job is canceled by user | Slip transforms to canceled state | "Research canceled. You can retry when ready." Form re-enabled. |
| Fetch error during polling | Silent (keep polling) | Up to 4 min, then timeout UI |
| Brief not found (`/app/brief/[code]`) | Detail view renders "not found" empty state | Polaroid with "Briefing not found" + return link |
| Server load error on detail page | Detail view renders "error" empty state | Polaroid with "Could not load" + return link |
| Server load error on library | Library renders error empty state | Polaroid with "Could not load your notebook" + reload link |

**Slip failure treatment** is unified: any non-recoverable state shows the same slip layout. Label changes color, error message replaces stage label, retry button replaces cancel. No error modals, no toast notifications, no extra UI.

## Accessibility

- **Keyboard:** the slip is fully keyboard-navigable. `Tab` from code → more options → submit. `Enter` submits. `Escape` while in an input blurs it. The job tracker's cancel is keyboard-reachable.
- **Live region:** the slip has `aria-live="polite"` and `aria-label="Briefing job status"` so screen readers announce stage changes.
- **Focus management:** when a job succeeds and the page navigates, focus moves to the detail view's hero. When a job fails and the slip transforms, focus stays in the slip so the user can retry.
- **Contrast:** all colors are existing tokens with WCAG AA contrast against `var(--paper)`. The highlighter strip uses `--ink` text on `--highlight` background, which has 11.6:1 contrast.
- **Reduced motion:** all slip transitions respect `prefers-reduced-motion: reduce`. The 180ms expand/collapse and the progress-dot pulse both disable.

## Testing

Existing tests in `src/routes/app/brief/`:
- `brief-page.svelte.spec.ts` — basic page render
- `brief-v4-rendering.svelte.spec.ts` — V4 schema rendering

**Tests to add or extend:**

1. **Library rendering** (vitest + @testing-library/svelte):
   - Empty state renders when no briefs.
   - Entry renders with all meta fields.
   - Multiple entries sort by `researchedAt` desc.
   - Subject color stripe uses correct `--subject-*` token.
   - RMP chip color matches rating threshold.

2. **Slip behavior**:
   - Form renders idle by default.
   - "More options" expands the optional fields.
   - Submit disabled when course code empty.
   - Form transforms to job tracker on submit.
   - Cancel button stops polling.
   - Failed/conflict/expired/canceled states render correct UI.
   - Timeout renders after polling exceeds 4 min (mock the timer).

3. **Detail view**:
   - Hero renders code, title, institution, date.
   - Highlighter strip shows the correct fact (prereq if known, else fallback).
   - Sidebar renders all quick facts with "—" for missing values.
   - RMP rating color matches threshold.
   - "About" section renders only if description exists.
   - "Research notes" details element collapses/expands with correct count.
   - "Sources" details element shows count in summary.
   - Delete confirmation toggle works.
   - Refresh action navigates back with pre-filled form.

4. **Navigation**:
   - Clicking an entry navigates to `/app/brief/[code]`.
   - Back button on detail returns to library.
   - Successful job navigates to detail.
   - Delete returns to library.

5. **Responsive** (visual regression if Playwright is available):
   - Mobile layout: slip collapses, sidebar becomes inline.
   - Tablet: library cards full width, sidebar inline.
   - Desktop: full layout.

**No backend changes.** No new endpoints, no new briefing fields, no schema changes. The server load in `+page.server.ts` may need a small addition to support the `[code]` route — see implementation plan.

## File Map

**New files:**
- `src/routes/app/brief/[code]/+page.svelte` — detail view component
- `src/routes/app/brief/[code]/+page.server.ts` — detail view server load
- `src/routes/app/brief/[code]/+page.svelte.spec.ts` — detail view tests (optional)
- `src/lib/components/brief/NotebookEntry.svelte` — single entry row
- `src/lib/components/brief/ResearchSlip.svelte` — slip with all states
- `src/lib/components/brief/JobTracker.svelte` — researching/terminal slip body (used inside ResearchSlip)
- `src/lib/components/brief/DetailHero.svelte` — hero region
- `src/lib/components/brief/DetailSidebar.svelte` — sticky right sidebar
- `src/lib/components/brief/DetailNarrative.svelte` — main column sections
- `src/lib/components/brief/EmptyState.svelte` — library empty state
- `src/lib/components/brief/ActionRow.svelte` — bottom of detail view

**Modified files:**
- `src/routes/app/brief/+page.svelte` — replace with library page
- `src/routes/app/brief/+page.server.ts` — unchanged
- `src/lib/sidebar/routes.ts` — no change (route stays `/app/brief`)

**Deleted:**
- Inline `BookShelf`, `SectionHead` usage in the library (replaced by `NotebookEntry`).
- The 5-field always-visible form (replaced by slip).
- The in-page text filter.

## Component Boundaries

Each new component has one clear job:

| Component | Job | Inputs | Depends on |
|---|---|---|---|
| `ResearchSlip` | The sticky form/tracker container | `onSubmit` callback | `JobTracker`, design tokens |
| `JobTracker` | The researching/terminal states | `job`, `onCancel`, `onRetry` | `stageLabel` |
| `NotebookEntry` | A single library entry | `brief` | design tokens |
| `DetailHero` | The hero region | `brief` | design tokens |
| `DetailSidebar` | The sticky sidebar | `brief` | design tokens |
| `DetailNarrative` | The main column sections | `brief` | design tokens |
| `EmptyState` | The empty library message | — | design tokens |
| `ActionRow` | Bottom of detail view | `code`, `onRefresh`, `onDelete` | `Button` |

No component reaches into another component's state. All data flows through props and server loads.

## Risks and Tradeoffs

1. **Polling 5s instead of 2s.** A 3–5s lag at most between stage transitions. The slip shows the most recent persisted stage on every poll, so the user sees continuous progress. If a user reports this as too slow, revert to 2s.

2. **Removing the in-page text filter.** Users who relied on filtering by professor or institution lose that capability. Mitigation: the OS/browser search, future global search. If usage shows the filter was essential, add it back as a single search input above the entries.

3. **Detail view as a separate route.** Adds a server load and a navigation. Mitigation: the route is server-rendered from the same D1 list, so the cost is one DB read on entry click. Acceptable.

4. **Highlighter strip in the hero.** The "single most useful fact" is subjective. The spec uses prereqs as the primary, with a fallback chain (delivery, credits, etc.). If a different fact is more useful for some users, the strip should adapt based on the brief.

5. **No filter on the library.** The library is a notebook. Searching through it is a different problem. If the user base grows beyond 20 entries, add a search field.

## Open Questions

None. All decisions captured above.
