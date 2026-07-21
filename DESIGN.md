---
name: Synapse
description: A notebook for your degree.
---

# Design System: Synapse

## 1. Current Product State

Synapse has two connected surfaces:

- **Public cover page** at `/`: a field-notebook landing page that demonstrates the product idea with real academic data, syllabus extraction, query examples, and a timeline.
- **Notebook app** at `/app`: a persistent app shell with onboarding, dashboard, course management, course graph, syllabus intelligence, an academic calendar, practice questions, briefings, weekly digest, and settings.

The design system serves both surfaces. The cover page feels more editorial and artifact-heavy. The app is quieter, denser, and more tool-like while still using the same paper, ink, highlighter, and notebook materials.

## 2. Creative North Star

**The Field Notebook.**

Synapse should feel like a research notebook for a student's degree: cream paper, charcoal ink, hand-labeled sections, structured academic data, and a fluorescent highlighter used only when something truly matters.

The interface should not feel like a generic SaaS dashboard. The product's data is the visual design: course codes, real deadlines, extracted weights, professor details, graph edges, and week-by-week academic history.

### Key Characteristics

- Cream paper surface with subtle fiber noise
- Charcoal ink for primary text and strokes
- Fluorescent highlighter as the main signal, used sparingly
- Red pen only for corrections, uncertainty, and review marks
- Kalam for handwritten display text
- Inter for body text, navigation, controls, labels, and data
- Source Serif 4 for the brand wordmark (synapse.)
- JetBrains Mono for code, data, labels, and monospace detail
- Flat paper-on-paper surfaces with light borders
- Polaroid frames, tape strips, dashed stamps, and hand notes as supporting furniture
- No glassmorphism, gradient text, corporate metric cards, dark network graphics, or decorative blobs
- `--ease-out-quart` easing for all transitions

## 3. Colors

All tokens defined in `src/routes/layout.css`. The `--color-*` prefixed variables are the canonical values; the unprefixed aliases (`--paper`, `--ink`, etc.) are the ones used in components.

### Pale fills (subject / category tags)

- **Comp Sci** (`--subject-comp`, `#4a6fa5`): Programming, systems courses.
- **Math** (`--subject-math`, `#5a7a4a`): Mathematics, statistics.
- **CSIS** (`--subject-csis`, `#7a5a8a`): CSIS department courses.
- **Stat** (`--subject-stat`, `#3a8a7a`): Statistics-specific fills.
- **Econ** (`--subject-econ`, `#b08a3a`): Economics courses.
- **ISYS** (`--subject-isys`, `#b04a6a`): Information systems courses.
- **HUMN** (`--subject-humn`, `#6a5a8a`): Humanities courses.

### Accent

- **Highlighter** (`--highlight`, `#d8ff5c`): The single primary accent. Use behind key words, active states, selected links, and one critical extracted item. It should not dominate a viewport.
- **Highlighter Soft** (`--highlight-soft`, `#e6ff8a`): Softer support highlight for secondary emphasis.

### Secondary

- **Accent / Red** (`--accent`, `#b03a2e`): Left border on active sidebar link. Used sparingly for structural hierarchy.
- **Pen Red** (`--pen-red`, `#c2362a`): Reviewer's red pen. Used for corrections, uncertainty, circled items, or one margin note.
- **Warn** (`--warn`, `#c08a2e`): Warning and caution signals.
- **Ok** (`--ok`, `#5a7a4a`): Success and good-state signals.

### Neutrals

- **Paper** (`--paper`, `#f4ede0`): App and page background.
- **Paper Edge** (`--paper-edge`, `#e8dcc1`): Sidebar background, tape strips, page edges, minor surfaces.
- **Paper Shelf** (`--paper-shelf`, `#ebe0c8`): Search blocks, book spines, secondary card surfaces.
- **Ink** (`--ink`, `#1f1c14`): Primary text and strokes.
- **Ink Soft** (`--ink-soft`, `#4a4538`): Secondary text, subdued labels, helper copy.
- **Ink Faint** (`--ink-faint`, `#5e5849`): Dashed borders, guide marks, nonessential metadata.
- **Rule** (`--rule`, `#c4b494`): Borders, dividers, and separators.
- **Rule Soft** (`--rule-soft`, `#d8c8a4`): Subtle dividers and soft borders.
- **Rule Strong** (`--rule-strong`, `#1f1c14`): Emphasized borders (same as ink).
- **Tape** (`--tape`, `rgba(232, 220, 193, 0.85)`): Masking-tape strips.
- **Shadow Ink** (`--shadow-ink`, `rgba(26, 26, 23, 0.12)`): Light paper shadows.

### Rules

- Highlighter should stay rare. One highlighted phrase, row, path, or active state per local region is usually enough.
- Red should be rarer than highlighter. If red appears more than once or twice in a viewport, it is probably too much.
- Do not introduce new dominant accent families for app features.

## 4. Typography

### Fonts

- **Hand Font:** Kalam (`--font-hand`), weight 700. For brand marks, page titles, editorial section titles, stamps, and handwritten notes.
- **Body Font:** Inter (`--font-body`), weights 400, 500, 600. For nav, buttons, form controls, data rows, course nodes, helper text, and all dense app surfaces.
- **Mono Font:** JetBrains Mono (`--font-mono`), weights 400, 500, 600. For code, data labels, metadata, field names, uppercase detail, and small print.
- **Display Font:** Source Serif 4 (`--font-display`), weight 600. For the brand wordmark in the sidebar header (synapse.). Not used elsewhere.

### Usage

- Use Kalam for page titles, editorial labels, notebook markings, and stamp-like UI.
- Use Inter for all interactive controls, data, navigation, and body text.
- Use JetBrains Mono for small metadata, uppercase labels, field names, counts, and anything requiring a data-like appearance.
- Use Source Serif 4 only for the sidebar brand mark.
- Do not use Kalam for body paragraphs, sidebar nav, input text, or table-like data.
- Data distinction should come from weight, uppercase, letter spacing, color, and layout — not from switching to a different font family unnecessarily.

### Scale

- **Cover display:** Kalam 700, `clamp(3.6rem, 8vw, 6rem)`, tight line-height.
- **Section / page titles:** Kalam 700, roughly `2rem` to `3.6rem`.
- **App page titles:** Kalam 700, roughly `1.5rem` to `2rem`.
- **Sidebar brand:** Source Serif 4 600, `1.25rem`.
- **Sidebar nav:** Inter 500, `0.9rem`.
- **Body:** Inter 400, `0.9rem` to `1rem`.
- **Labels / data:** Inter or JetBrains Mono, `0.68rem` to `0.85rem`, uppercase where useful.
- **Small metadata / monospace:** JetBrains Mono, `0.68rem` to `0.78rem`.

## 5. Surfaces and Elevation

Synapse is flat by default. Paper sits on paper. Shadows should be subtle and purposeful.

### Surface Patterns

- **Paper background:** Used globally through `.paper` and `var(--paper)`.
- **Paper shelf:** Used in the sidebar, search blocks, and secondary card surfaces via `var(--paper-shelf)`.
- **Polaroid frame:** Off-white surface, 1px ink-tinted border, small inner padding, light paper shadow.
- **Tape strip:** `var(--paper-edge)` color with tiny shadow and inset border.
- **Dashed stamp:** Kalam label with dashed `var(--ink-faint)` border.
- **Hard extracted card:** Off-white card with ink border and small hard offset shadow, used for extracted structured data.
- **Canvas (graph):** Full-screen freeform surface, no padding, with floating toolbar and inspector.
- **Dialog / AlertDialog overlay:** `rgba(26, 26, 23, 0.38)` backdrop.
- **Dialog / AlertDialog content:** `var(--paper)` background, 1px `var(--ink)` border, no border-radius, subtle entrance animation.

### Corners

All interactive components use **flat corners** (`border-radius: 0`). No rounded corners on buttons, inputs, menus, dialogs, chips, or toggles. This reinforces the paper-and-ink notebook feel.

## 6. Animations and Motion

All transitions use `var(--ease-out-quart)` for a natural, slightly decelerating feel.

| Component    | Animation                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Buttons      | Hover: lift `translateY(-1px)`. Active: press `translateY(2px)`. 0.12s transition on background, border-color, color, transform. |
| Checkbox     | On check: stamp-pop scale keyframe (0.85→1.12→1) over 0.2s. Active: scale(0.92).                                                 |
| Dialogs      | Entrance: fade in + scale(0.97→1) + translateY over 0.18s.                                                                       |
| DropdownMenu | Content entrance: scale(0.96) + translateY(-4px) over 0.12s, transform-origin top-right.                                         |
| Inputs       | Border-color and box-shadow transition on focus, 0.15s.                                                                          |
| Select       | Trigger border on focus, items background on highlight.                                                                          |
| ToggleGroup  | Active: press-down translateY(1px). Background/border/color transition on state change.                                          |
| Toolbar      | Child items fade to 0.7 opacity on hover.                                                                                        |
| Sidebar nav  | Hover: ink-left-border transition, background. Active: accent-left-border + bold weight.                                         |

`prefers-reduced-motion: reduce` is respected — all transitions are disabled when the user requests reduced motion.

## 7. Interactive Controls (bits-ui Primitives)

Reusable UI primitives live in `src/lib/components/ui/`. They wrap bits-ui components and apply uniform theme tokens.

### Button

- Variants: `primary`, `secondary` (default), `ghost`, `danger`.
- All use `border-radius: 0`, Inter font, 0.8rem size.
- Primary: `var(--ink)` background, `var(--paper)` text.
- Secondary: transparent, 1px ink-tinted border (`rgba(26,26,23,0.18)`).
- Ghost: no border, `var(--ink-soft)` text, hover shows subtle bg.
- Danger: `var(--pen-red)` border and text, hover fills with `var(--pen-red)`.
- Hover: lifts `translateY(-1px)`, shows `var(--highlight-soft)` background.
- Active: presses `translateY(2px)`.
- Disabled: `opacity: 0.4`, cursor not-allowed.
- Size variants: `sm` (2.25rem height, 0.72rem font) and `md` (2.5rem height).

### Checkbox

- Square 1.25rem × 1.25rem, `border-radius: 0`, `var(--ink)` border.
- Checked: `var(--highlight)` background, stamp-pop scale animation.
- Active: scale(0.92).
- Label in Inter, 0.82rem.

### Dialog / AlertDialog

- Overlay: `rgba(26,26,23,0.38)` backdrop, z-index 1100.
- Content: `var(--paper)` background, 1px `var(--ink)` border, no border-radius, centered.
- Entrance animation: 0.18s fade + scale-in using `var(--ease-out-quart)`.
- Title in Kalam, description in Inter.
- Close button: transparent with 2.25rem grid, focus-visible border + highlight outline.

### DropdownMenu

- Trigger: 2.5rem square, `rgba(26,26,23,0.18)` border, Inter.
- Content: `var(--paper)` background, 1px `var(--ink)` border, no border-radius.
- Entrance animation: 0.12s scale + translate, `transform-origin: top right`.
- Items: Inter 0.82rem, highlight background on selection.
- Danger items: `var(--pen-red)` color.

### Input / Textarea

- Full width, `min-height: 2.5rem`, `border-radius: 0`, `var(--paper)` background.
- Border: 1px `rgba(26,26,23,0.28)`.
- Focus: border → `var(--ink)`, `outline: 2px solid var(--highlight)`, outline-offset 1px.
- Transition: 0.15s on border-color and box-shadow.
- Disabled: `var(--paper-edge)` background, `var(--ink-soft)` text.
- Textarea: vertical resize only, `min-height: 5rem`.

### Select

- Trigger: same appearance as Input.
- Dropdown content: `var(--paper)`, 1px `var(--ink)` border, no border-radius.
- Items: Inter 0.78rem, `var(--highlight)` on hover/selected.
- Transition: 0.15s trigger border, 0.1s item background.

### ToggleGroup

- Horizontal inline-flex group, 0.25rem gap.
- Items: Inter uppercase, 0.75rem, `var(--rule)` border, `var(--paper)` bg.
- Hover: border → `var(--ink)`, text → `var(--ink)`.
- Selected (`[data-state='on']`): `var(--highlight)` background, `var(--ink)` text.
- Active: press-down `translateY(1px)`.
- All states transition with `var(--ease-out-quart)`.

### Toolbar

- Flex row, 0.4rem gap.
- Child items subtly fade on hover (opacity 0.7).

## 8. Current Landing Page (`/`)

The front page is a single-scroll editorial landing page with:

1. **Cover** — Highlit `synapse` brand, date stamp, mini course graph in a polaroid frame, GPA/prereq sparkline, CTA to open the notebook.
2. **The Mess** — Torn notebook artifact, calendar grid, sticky note, to-do list, coffee ring, red circled item. Copy about scattered academic data.
3. **The Mechanism** — Syllabus document, extract arrow, structured extracted card, highlighted deadline.
4. **Query** — Plain-English academic question, graph-backed answer, supporting fact cards.
5. **Timeline** — Six week log entries pairing Kalam event lines with Inter structured data.
6. **Closing CTA and Footer** — One-graph message, simple colophon.

The landing page is more expressive than the app; its job is to communicate the product concept.

## 9. App Shell (`/app`)

### Sidebar

- Fixed left sidebar on desktop (220px width, `var(--paper-shelf)` background), hidden on mobile.
- Brand mark `synapse.` uses Source Serif 4 (`--font-display`) in 1.25rem, with an accent red dot.
- Nav section labeled "Catalog" in JetBrains Mono uppercase (0.7rem).
- Nav items use Inter 0.9rem weight 500, with sidecar course count in mono.
- Active nav item: bold weight, `var(--paper)` background, `var(--accent)` (red) left border.
- Hover: subtle background shift to `var(--paper)`, ink left border.
- Below catalog nav, a dynamic term list displays semesters and course counts.
- On mobile: floating action button opens a popup nav.

### Main Area

- `var(--paper)` background through `.paper` class.
- Standard app pages use `2rem` horizontal padding.
- Canvas pages (`/app/courses`): full-width, no padding, fills viewport.
- App pages avoid landing-page-scale headings and decorative section scaffolding.

### Mobile Navigation

- Fixed fab button (bottom-right, 2.75rem square, `var(--ink)` border, `var(--paper)` background).
- Popup nav menu: `#fbf8f0` background, 1px `var(--rule)` border, item tap areas with Inter labels.
- Open state escapes on click-outside and Escape key.

## 10. App Pages (Implemented)

### Dashboard / Onboarding (`/app`)

Three states:

- Empty state: semester picker with dashed selectable term chips.
- Course entry/import flow.
- Dashboard grouped by semester with paper panels.

Small Kalam title, Inter subtitle, dashed chips, simple ink primary button.

### Courses / Knowledge Graph (`/app/courses`)

Full-screen canvas with course nodes, directed edges, pan/zoom, inspector, minimap, and floating toolbar. Most visually dense app surface.

### Courses / Manage (`/app/courses/manage`)

Edit dialog for adding and configuring courses within a semester.

### Course Detail (`/app/courses/[id]`)

Individual course page showing materials, files, and course-specific data.

### Syllabus Intelligence (`/app/syllabus`)

Full AI syllabus extraction feature:

- Upload PDF → AI extracts professor info, deadlines, grading schemes, topics.
- Two-column layout (upload + extraction result).
- Mock extraction when no API key is set.
- Textbook material upload support.

### Calendar (`/app/calendar`)

First-party calendar showing assignments, exams, quizzes, and deadlines across all courses.

### Weekly Digest (`/app/digest`)

AI-generated weekly summary of workload, deadlines, and study recommendations. Currently shows mock data.

### Weekly Plan (`/app/weekly`)

Deterministic seven-day planning view computed by a pure engine (`src/lib/dashboard/weekly.ts`) from live courses, calendar events, practice sessions, study sessions, materials, briefings, and the course graph. Shows the top three priorities with deterministic explanations, chronological deadlines, crunch windows, paused practice, study gaps, material-indexing and prerequisite warnings, plus an optional OpenRouter prose summary that degrades away without an API key. A Worker cron trigger (Mondays 15:00 UTC) pushes the digest to browsers subscribed via Web Push (RFC 8291/8292) from Settings; expired subscriptions are pruned automatically.

### Practice (`/app/practice`)

Grounded multiple-choice questions and flashcards generated from uploaded PDF and text course materials. Features course selection, answer explanations, source references, missed-question review, and score tracking.

### Course Brief (`/app/brief`)

Full async job-queue based LLM briefing system:

- Enter course code + optional professor/institution.
- Creates a D1-backed background job → polls every 2s → displays result.
- Caches briefings in D1 `prompt_cache` (7-day TTL) and `briefings` table.
- Manual delete clears associated jobs and cache entries.
- Powered by OpenRouter with configurable model via `OPENROUTER_MODEL`.

### Settings (`/app/settings`)

Application preferences. Currently hosts the Weekly Plan push subscription: enable/disable Web Push for the Monday digest, with clear unsupported, blocked, and subscribed states.

### Semesters (`/app/semesters`)

Manage academic terms: add, edit, reorder, delete semesters.

### Setup Wizard (`/app/setup`)

Onboarding flow for new users to set up semesters and courses.

## 11. Focus and Accessibility

- Buttons and links: `outline: 2px solid var(--ink)`, offset 2-3px.
- Inputs, textareas, selects: `outline: 2px solid var(--highlight)`, offset 1px.
- All interactive elements have `:focus-visible` support.
- WCAG 2.2 AA contrast maintained.
- SVG elements with semantic meaning include title/description.
- Decorative margin notes are hidden from assistive tech.
- `prefers-reduced-motion: reduce` disables transitions and animations.

## 12. Do's and Don'ts

### Do

- Use real academic data in demos and mockups.
- Keep the app interface clear, compact, and usable.
- Use highlighter for active selections and critical extracted facts.
- Use red pen for review or uncertainty only.
- Use JetBrains Mono for data labels, field names, and small metadata.
- Match existing app controls before inventing new ones.
- Keep feature pages scoped to their actual implemented state.
- Use `var(--ease-out-quart)` for all transitions.

### Don't

- Do not turn app pages into marketing sections.
- Do not add unrelated decorative illustrations.
- Do not introduce glass, gradients, glow effects, or dark mode.
- Do not use large metric-card dashboards.
- Do not use Kalam for dense data, navigation, or input text.
- Do not nest cards inside cards.
- Do not refactor adjacent feature designs when adding a new page.
- Do not introduce border-radius on interactive controls (keep flat).
- Do not use highlighter or red heavily — less is more.

## 13. Implementation Notes

Tokens and utility classes are defined in `src/routes/layout.css`. Bits-ui component wrappers in `src/lib/components/ui/`. Sidebar navigation routes defined in `src/lib/sidebar/routes.ts`.

When implementing new UI:

- Reuse the existing bits-ui components from `$lib/components/ui/`.
- Use CSS custom properties for all colors and fonts — do not hardcode.
- Apply `border-radius: 0` to all interactive elements.
- Use `var(--ease-out-quart)` for any CSS transitions.
- Do not introduce new animation libraries without evaluation.
- Respect `prefers-reduced-motion: reduce`.
- Add only the route and styles required for the feature being built.
- Keep feature pages scoped to their actual implemented state.
