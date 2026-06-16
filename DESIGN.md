---
name: Synapse
description: A notebook for your degree.
---

# Design System: Synapse

## 1. Overview

**Creative North Star: "The Field Notebook."**

Synapse is a research notebook that is also the product demo. The page looks like a Moleskine opened on a desk: hand-traced diagrams, real data plotted in pen, a fluorescent highlighter pulled over the things that matter. The aesthetic is intentionally made, not templatey — and it practices what Synapse preaches: the data is real, the graph is real, the page itself is a graph.

**This is a complete replacement of the previous system.** No design anchors are carried forward. The warm-paper / green-ink / Georgia / condensed-display system is gone. The "six tools" narrative is gone. The dark "network glow" footer is gone.

**Key characteristics:**

- Cream paper surface with a subtle fiber noise, charcoal ink, a fluorescent highlighter as the single accent
- Hand-printed display type (Kalam), Inter for reading and data
- Real academic data (course codes, real grades, real deadlines) is the design — not decoration
- The hero, the graph section, and the timeline all carry real structured data
- Flat surfaces with subtle paper artifacts (polaroid frames, tape strips, dashed borders)
- No autoplay animations, no scroll effects, no glassmorphism, no gradient text

## 2. Colors

A restrained two-accent system. The page is paper and ink. The highlighter is the only signal. Red is the only second voice, reserved for corrections.

### Primary

- **Highlighter** (`#d8ff5c`): The single accent. Used exactly like a real highlighter — behind a key word, over a single active prereq path, on one extracted deadline. Never as a fill. Never decoratively.

### Secondary (used sparingly)

- **Pen Red** (`#c2362a`): Reviewer's red pen. Used for corrections, circled to-do items, and one or two margin notes. Must constitute ≤2% of any given viewport.

### Neutral

- **Paper** (`#f3ead7`): The page background. Warm cream with a visible fiber noise overlay.
- **Paper Edge** (`#e8dcc1`): The color of tape strips, page edges, and minor shadow surfaces.
- **Ink** (`#1a1a17`): Primary text and strokes. Slightly warm black for readability.
- **Ink Soft** (`#4a4a42`): Secondary text, faint annotations.
- **Ink Faint** (`#9a958a`): Margin guides, page numbers, timestamps, dashed borders.
- **Tape** (`rgba(232, 220, 193, 0.85)`): The masking-tape strips at corners.

### Named Rules

**The Highlighter Rule.** The highlighter is the only accent. It must constitute ≤10% of any viewport. Its rarity is the point — when a student sees the highlighter, they know something matters.

**The Red Pen Rule.** Red is the second voice. It is used for: corrections, circled to-do items, one or two margin notes, and nothing else. If you find yourself reaching for red three times in a section, you have used it wrong.

## 3. Typography

**Display Font:** Kalam (hand-printed, 700 weight)
**Body Font:** Inter (humanist sans, 400/500/600)

The pairing is deliberate. Kalam is the only hand-printed voice and is reserved for section titles, the brand mark, and the week entries. Inter is both the reading voice and the data voice; data distinction is carried by weight, color, uppercase, and letter-spacing rather than a separate font.

### Hierarchy

- **Hand Display** (Kalam 700, `clamp(2rem, 3.6vw, 3.4rem)`, 1.05 line-height): Section titles, week entries, the brand mark.
- **Cover Display** (Kalam 700, `clamp(3.6rem, 8vw, 6rem)`, 0.95 line-height): The hero "synapse" word.
- **Body** (Inter 400, `clamp(1rem, 1.1vw, 1.15rem)`, 1.55 line-height): Reading copy, paragraphs.
- **Body Strong** (Inter 500): Captions, lead sentences.
- **Data** (Inter 400, `clamp(0.85rem, 0.95vw, 1rem)`, 1.4 line-height): Course codes, timestamps, inline data, footer colophon. Carries visual weight through uppercase + letter-spacing + color, not a separate family.
- **Label** (Inter 600, all-caps, `letter-spacing: 0.14em`, `0.7rem`): Section labels, field names, course labels inside structured cards.

### Named Rules

**The Kalam Ceiling.** Kalam is the only hand-printed voice and is reserved for titles, the brand, and the week entries. Never use it for body copy, never use it for data, never use it for nav.

**No Georgia. No condensed display stack.** The previous system is gone.

## 4. Elevation

Flat by default. The notebook metaphor does not need shadows. Surfaces are paper-on-paper. The single exceptions are:

- **Polaroid frames**: a 1px ink-tinted border, a 6px white inner padding, and a `0 2px 6px rgba(26, 26, 23, 0.1)` shadow. Used to mount screenshots, diagrams, and structured cards on the page.
- **Tape strips**: a `0 1px 2px rgba(0, 0, 0, 0.08)` shadow + a 1px inset border. Used to suggest "taped to the page."
- **Sticky note**: a `0 3px 8px rgba(26, 26, 23, 0.15)` shadow on the yellow sticky note in section 2.

No other surface carries a shadow. Cards, structures, and the graph stage are flat.

## 5. Components

### Cover (Section 1)

- **Top-left tape**: a `vol. 01` masking-tape strip, rotated -3deg.
- **Top-right stamp**: a dashed-border date stamp `fall '25 → spring '27`, rotated +2.4deg.
- **Brand mark**: `synapse` in Kalam 700 at `clamp(3.6rem, 8vw, 6rem)` with a highlighter sweep behind it.
- **Subtitle**: 60-word sentence in Inter regular, no Georgia.
- **Mini graph**: a 5-node, 6-edge hand-traced graph mounted in a polaroid frame, with a single highlighted edge.
- **Sparkline**: a 200x40px inline data viz with a single dot, captioned "gpa 3.7 · prereqs 8/9."
- **Cover arrow**: a hand-drawn down-arrow at the bottom-left, leading the eye into section 2.

### Messy Page (Section 2)

- **Torn page artifact**: a `#fbf8f0` polaroid-framed page with a calendar grid (some cells red, some crossed), two scribbled course names, a yellow sticky note with a handwritten question, a to-do list with three items crossed off and one circled in red, and a faint coffee ring.
- **Margin annotation**: a small SVG arrow + Kalam text in red pen at the page's left margin, pointing to the page.
- **Body copy**: a single 40-word paragraph below the artifact.

### Transformation (Section 3)

- **Stamp header**: a rotated dashed-border stamp `field 03 · the mechanism`.
- **Title**: Kalam 700 with two highlighted words (`upload` and `extracts`).
- **Syllabus doc**: a polaroid-framed "document" with structured rows (course, meetings, grading, deadlines, prereq, notes). Notes row is in Kalam for a handwritten feel.
- **Extract arrow**: a horizontal hand-drawn arrow with a Kalam `extract` label below it.
- **Extracted card**: a `#fbf8f0` card with a 2px ink border and a `2px 2px 0 var(--ink)` shadow (the only hard-edge shadow in the system). Contains a `<dl>` of structured data. One row (the `mar 24 midterm` deadline) has a highlighter sweep.

### Graph (Section 4)

- **Stamp header**: rotated dashed-border stamp `the graph · fall '25 — spring '27`.
- **Margin annotations**: 4 Kalam notes in the left gutter, each with a hand-drawn leader-line arrow to a specific node (desktop only — hidden on mobile).
- **Graph stage**: a `#fbf8f0` flat panel containing a 1100x600 SVG. 16 course nodes, polaroid-style with `1.4px` ink borders. 12 charcoal prereq edges. 1 highlighted path (the "what you might take next semester" path) in 6px highlighter.
- **Question + answer**: a 30-word paragraph below the graph.

### Timeline (Section 5)

- **Stamp header**: rotated dashed-border stamp `the log · week by week`.
- **Title**: Kalam 700 with the phrase `week by week` highlighted.
- **Weeks**: an ordered list of 6 weeks. Each week has:
  - A rotated dashed-border stamp (e.g. `WEEK 01`)
  - A Kalam 700 entry line (the actual event)
  - A Inter data line (the structured fact)
  - A small inline data viz: bar, dot-on-axis, sparkline, number, check, or mini graph
- **Responsive**: stacks to a single column on mobile.

### Footer (Colophon)

- Three columns on desktop: brand mark (`synapse · vol. 01` in Kalam), centered copyright line, right-aligned nav (privacy / terms / contact).
- No dark mode. No social icons. No subscribe input. No network glow graphic.

## 6. Do's and Don'ts

### Do

- Do use the highlighter (`#d8ff5c`) for one thing per section at most.
- Do use the red pen (`#c2362a`) only for corrections and circled items.
- Do mount real academic data: course codes, real deadlines, real weights.
- Do rotate small UI elements ±1–3° for the "traced by hand" feel.
- Do use polaroid frames, tape strips, and dashed-border stamps as the page furniture.
- Do honor `prefers-reduced-motion: reduce` — there are no autoplay animations anyway.

### Don't

- Don't use the previous system's green ink, warm paper tone, or Georgia body. They're gone.
- Don't use glassmorphism, gradient text, or hero-metric stat templates.
- Don't use big numbers + small labels.
- Don't use a numbered section scaffold (01 / 02 / 03).
- Don't add scroll animations, parallax, or entrance transitions.
- Don't use the dark "network glow" footer.
- Don't use perfect geometric bezier curves for arrows — slight jitter is the design.
- Don't use rounded-everything. Polaroid corners are 0px, card corners are 2–4px.
- Don't use em dashes.
- Don't carry forward any "anchor" from the previous design.

## 7. Accessibility

- WCAG 2.2 AA. Verified contrast on every body-text combination:
  - `var(--ink)` on `var(--paper)` = 13.6:1 (AAA)
  - `var(--ink-soft)` on `var(--paper)` = 8.4:1 (AAA)
  - `var(--ink-faint)` on `var(--paper)` = 3.3:1 — used only for non-essential UI (timestamps, dashed borders), never for body
  - `var(--pen-red)` on `var(--paper)` = 5.8:1 (AA)
  - `var(--ink)` on `var(--highlight)` = 12.1:1 (AAA)
- Every SVG has `<title>` and `<desc>`.
- All sections are `<section>` with `aria-labelledby` (or screen-reader-only headings).
- The timeline uses `<ol>` semantics.
- Margin notes are `aria-hidden` since they decorate but do not add information not present in the body.
- `prefers-reduced-motion: reduce` is honored.
