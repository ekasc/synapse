---
name: Synapse
description: A notebook for your degree.
---

# Design System: Synapse

## 1. Current Product State

Synapse currently has two connected surfaces:

- **Public cover page** at `/`: a field-notebook landing page that demonstrates the product idea with real academic data, syllabus extraction, query examples, and a timeline.
- **Notebook app** at `/app`: a persistent app shell with onboarding, dashboard, course management, and an interactive course graph editor.

The design system should serve both surfaces. The cover page may feel more editorial and artifact-heavy. The app should feel quieter, denser, and more tool-like while still using the same paper, ink, highlighter, and notebook materials.

## 2. Creative North Star

**The Field Notebook.**

Synapse should feel like a research notebook for a student's degree: cream paper, charcoal ink, hand-labeled sections, structured academic data, and a fluorescent highlighter used only when something truly matters.

The interface should not feel like a generic SaaS dashboard. The product's data is the visual design: course codes, real deadlines, extracted weights, professor details, graph edges, and week-by-week academic history.

### Key Characteristics

- Cream paper surface with subtle fiber noise
- Charcoal ink for primary text and strokes
- Fluorescent highlighter as the main signal, used sparingly
- Red pen only for corrections, uncertainty, and review marks
- Kalam for display and notebook markings
- Inter for body text, navigation, controls, labels, and data
- Flat paper-on-paper surfaces with light borders
- Polaroid frames, tape strips, dashed stamps, and hand notes as supporting furniture
- No glassmorphism, gradient text, corporate metric cards, dark network graphics, or decorative blobs

## 3. Colors

These tokens are implemented in `src/routes/layout.css` and should be treated as the source palette.

### Accent

- **Highlighter** (`#d8ff5c`): The single primary accent. Use behind key words, active states, selected links, and one critical extracted item. It should not dominate a viewport.
- **Highlighter Soft** (`#e6ff8a`): Softer support highlight for secondary emphasis.

### Secondary

- **Pen Red** (`#c2362a`): Reviewer's red pen. Use only for corrections, uncertainty, circled items, or one margin note.

### Neutrals

- **Paper** (`#f3ead7`): App and page background.
- **Paper Edge** (`#e8dcc1`): Sidebar background, tape strips, page edges, minor surfaces.
- **Ink** (`#1a1a17`): Primary text and strokes.
- **Ink Soft** (`#4a4a42`): Secondary text, subdued labels, helper copy.
- **Ink Faint** (`#9a958a`): Dashed borders, guide marks, nonessential metadata.
- **Tape** (`rgba(232, 220, 193, 0.85)`): Masking-tape strips.
- **Shadow Ink** (`rgba(26, 26, 23, 0.12)`): Light paper shadows.

### Rules

- Highlighter should stay rare. One highlighted phrase, row, path, or active state per local region is usually enough.
- Red should be rarer than highlighter. If red appears more than once or twice in a viewport, it is probably too much.
- Do not introduce new dominant accent families for app features. Feature categories may use pale fills, but the main signal remains highlighter.

## 4. Typography

### Fonts

- **Display Font:** Kalam, weight 700.
- **Body/Data Font:** Inter, weights 400, 500, 600.

### Usage

- Use Kalam for brand marks, page titles, editorial section titles, stamps, and handwritten notes.
- Use Inter for nav, buttons, form controls, data rows, course nodes, helper text, and dense app surfaces.
- Do not use Kalam for body paragraphs, sidebar nav, input text, or table-like data.
- Data distinction should come from weight, uppercase, letter spacing, color, and layout, not a separate monospace font.

### Current Scale

- **Cover display:** Kalam 700, `clamp(3.6rem, 8vw, 6rem)`, tight line-height.
- **Section/page titles:** Kalam 700, roughly `2rem` to `3.6rem`.
- **App page titles:** Kalam 700, roughly `1.5rem` to `2rem`.
- **Body:** Inter 400, roughly `1rem` to `1.125rem`.
- **Labels/data:** Inter 500 or 600, small size, uppercase where useful.

## 5. Surfaces and Elevation

Synapse is flat by default. Paper sits on paper. Shadows should be subtle and purposeful.

### Existing Surface Patterns

- **Paper background:** Used globally through `.paper`, with subtle SVG noise.
- **Paper edge:** Used in the app sidebar.
- **Polaroid frame:** Off-white surface, 1px ink-tinted border, small inner padding, light paper shadow.
- **Tape strip:** Paper-edge color with tiny shadow and inset border.
- **Dashed stamp:** Kalam label with dashed ink-faint border.
- **Hard extracted card:** Off-white card with ink border and small hard offset shadow, used for extracted structured data.
- **App panels:** Low-contrast borders, 4px to 8px radius depending on context, mostly no shadow.

### App Rule

In the app, prioritize utility over decoration. Use notebook artifacts as small cues, not as large theatrical set pieces.

## 6. Current Landing Page

The current `/` page has these sections:

1. **Cover**
   - Highlit `synapse` brand
   - Date stamp
   - Mini course graph in a polaroid frame
   - GPA/prereq sparkline
   - CTA to open the notebook

2. **The Mess**
   - Torn notebook artifact
   - Calendar grid, sticky note, to-do list, coffee ring, red circled item
   - Copy about scattered academic data

3. **The Mechanism**
   - Syllabus document artifact
   - Extract arrow
   - Structured extracted card
   - Highlights one extracted deadline

4. **Query**
   - Plain-English academic question
   - Graph-backed answer
   - Small supporting fact cards

5. **Timeline**
   - Six week log entries
   - Each entry pairs a Kalam event line with Inter structured data

6. **Closing CTA and Footer**
   - One-graph message
   - Simple colophon

The landing page can be more expressive than the app because its job is to communicate the product concept.

## 7. Current App Shell

The `/app` shell is a practical notebook workspace.

### Sidebar

- Fixed left sidebar on desktop, top-wrapping nav on small screens.
- Background uses `Paper Edge`.
- Brand `synapse` uses Kalam.
- `vol. 01` appears as a small tape-like label.
- Nav labels use Inter, not Kalam.
- Active nav uses highlighter fill with multiply blending.
- Current nav items: Dashboard, Courses, Calendar, Digest, Practice, Brief, Settings.

When adding the syllabus parser, add a **Syllabus** nav item between Courses and Calendar.

### Main Area

- Uses `.paper` background.
- Standard app pages use `2rem` padding and constrained content width.
- Full-canvas pages, currently `/app/courses`, remove padding and fill the viewport.
- App pages should avoid landing-page-scale headings and should not use decorative section scaffolding.

## 8. Current App Pages

### Dashboard / Onboarding

The `/app` page has three states:

- First-time semester picker
- Course entry/import flow
- Dashboard grouped by semester

Design pattern:

- Small Kalam title
- Inter subtitle
- Dashed selectable term chips
- Simple ink primary button
- Low-contrast paper panels for semester/course groups
- Transcript import area with Inter helper text

### Courses / Knowledge Graph

The `/app/courses` page is the most complete app surface.

Design pattern:

- Full-screen freeform canvas
- Floating toolbar with translucent paper background
- Course nodes as small bordered paper cards
- Pale tag fills for course categories
- Curved ink edges with optional arrowheads
- Highlighter marks selected/active graph state
- Inspector panel floats on the right
- Minimap floats bottom-right
- App controls use compact Inter labels

Expected interactions:

- Drag nodes
- Pan and zoom
- Link courses
- Select, multi-select, and box-select
- Undo/redo
- Duplicate/delete
- Organize and fit
- Sync with server

### Placeholder Pages

Calendar, Digest, Practice, Brief, and Settings currently exist as placeholder app pages.

Design pattern:

- Small Kalam page title
- Inter subtitle
- Dashed empty state panel
- One compact hint line

These should remain quiet until the feature is implemented.

## 9. Syllabus Intelligence Feature

This is the design direction for the AI syllabus parser feature.

### Purpose

Let users upload syllabus PDFs and extract structured academic data:

- Professor information
- Office hours and contact details
- Exam dates
- Quiz dates
- Assignment deadlines
- Grading schemes and weights
- Course topics and learning objectives

### Placement

Add a new app page:

- Route concept: `/app/syllabus`
- Sidebar label: `Syllabus`
- Page title: `Syllabus Intelligence`
- Subtitle: `Upload a course outline. Extract dates, weights, and instructor details.`

### Layout

Use a two-column app layout on desktop and a single column on mobile.

Left column:

- Upload panel with dashed PDF drop zone
- Selected file row
- Extraction checklist
- Primary button: `extract syllabus`

Right column:

- Structured extracted-data panel
- Groups for Professor, Important dates, Grading scheme, and Topics found
- Confidence/status row such as `AI extraction confidence 92%`
- Secondary action such as `Ready to import`

Bottom area:

- Extracted timeline strip showing exams, quizzes, and major deadlines
- Use one highlighter mark for the most important or next upcoming item
- Use red pen only to mark uncertain dates or fields requiring review

### Visual Treatment

- The upload area may use a polaroid-style document frame.
- Extracted data may use the hard extracted-card style from the landing page.
- Do not use big metric cards for counts.
- Do not show the AI as a mascot or chat bubble.
- The page should feel like reviewing a marked-up syllabus, not configuring a generic file uploader.

### Example Data

Use realistic academic data in demos:

- `CSIS 4495 Syllabus.pdf`
- `Prof. Anika Sharma`
- `Office hours: Tue 2:00-4:00`
- `Project proposal: Sep 27`
- `Midterm exam: Oct 18`
- `Final exam: Dec 12`
- `Quizzes: 15%`
- `Assignments: 30%`
- `Midterm: 20%`
- `Final: 35%`

## 10. Controls

### Buttons

- Primary action: ink background, paper text, small radius.
- Secondary action: transparent paper, ink border.
- Active tool state: highlighter background.
- Disabled state: reduced opacity.

### Inputs

- Off-white or paper background.
- Thin ink-tinted border.
- Clear focus state using ink border.
- Inter text.

### Chips and Tabs

- Dashed or thin borders.
- Uppercase Inter labels.
- Highlighter fill for selected state.

### Empty States

- Dashed border panel.
- Small icon or symbol may be used, but keep it restrained.
- One clear message and one hint line.

## 11. Do's and Don'ts

### Do

- Use real academic data in demos and mockups.
- Keep the app interface clear, compact, and usable.
- Use highlighter for active selections and critical extracted facts.
- Use red pen for review or uncertainty only.
- Match existing app controls before inventing new ones.
- Keep feature pages scoped to their actual implemented state.

### Don't

- Do not turn app pages into marketing sections.
- Do not add unrelated decorative illustrations.
- Do not introduce glass, gradients, glow effects, or dark mode.
- Do not use large metric-card dashboards.
- Do not use Kalam for dense data or navigation.
- Do not nest cards inside cards.
- Do not refactor adjacent feature designs when adding a new page.

## 12. Accessibility

- Maintain WCAG 2.2 AA contrast.
- Keep `Ink` and `Ink Soft` as the main text colors.
- Use `Ink Faint` only for nonessential metadata and borders.
- Do not rely on color alone for extraction confidence, error, or review states.
- Ensure upload controls are keyboard-accessible.
- Every SVG with semantic meaning needs a title and description.
- Decorative margin notes and arrows should be hidden from assistive technology.
- Honor `prefers-reduced-motion: reduce`.

## 13. Implementation Notes

The current codebase already defines the shared tokens and utility classes in `src/routes/layout.css`.

When implementing new UI:

- Reuse `paper`, `font-hand`, `font-body`, `font-mono`, `stamp`, `polaroid`, `tape`, `highlighter`, and existing app button/chip patterns.
- Prefer the existing `/app` layout behavior.
- Add only the route and styles required for the feature being built.
- Keep Syllabus Intelligence independent from the course graph editor until import behavior is explicitly implemented.
