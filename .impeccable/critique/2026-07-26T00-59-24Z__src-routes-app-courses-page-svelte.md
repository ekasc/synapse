---
target: course map route
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-07-26T00-59-24Z
slug: src-routes-app-courses-page-svelte
---
# Course Map Route Design Critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Strong async feedback, but selection does not bring the inspector into view or focus. |
| 2 | Match System / Real World | 3/4 | Academic language is grounded; “Check,” “Load,” and saved-versus-draft remain ambiguous. |
| 3 | User Control and Freedom | 3/4 | Undo and reset are strong; whole-draft discard lacks recovery. |
| 4 | Consistency and Standards | 2/4 | Cohesive styling, but controls are reimplemented and the static scroller conflicts with the documented canvas model. |
| 5 | Error Prevention | 2/4 | Invalid moves are blocked, but draft discard is immediate and pending relationships cannot be resolved here. |
| 6 | Recognition Rather Than Recall | 2/4 | Horizontal clipping and the inspector below the canvas force users to remember off-screen relationships. |
| 7 | Flexibility and Efficiency | 1/4 | No search, fit-to-plan, zoom, minimap, semester jump, or dependable jump-to-course. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Saved plans and planning summaries compete with the graph. |
| 9 | Error Recovery | 3/4 | Conflict, retry, sharing, and clipboard states are thorough; discard recovery is incomplete. |
| 10 | Help and Documentation | 2/4 | Good inline explanation, but no actionable path for adding or reviewing relationships. |
| **Total** |  | **23/40** | **Acceptable; significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Pass, with noticeable AI-scaffold residue. Real course codes, semester columns, prerequisite arrows, paper surfaces, and scenario simulation feel specific to Synapse. Repeated eyebrow-plus-heading pairs and stacked bordered panels create a generated-dashboard cadence that obscures the distinctive graph.

**Deterministic scan:** Zero findings across `src/routes/app/courses/+page.svelte` and `src/lib/components/course-map/CourseMap.svelte`. The detector agrees that the route avoids common syntactic slop patterns, but it cannot detect the hierarchy and workflow problems found in the design review.

**Visual overlays:** None. Browser automation and mutable injection were unavailable; source inspection and the CLI detector were used instead.

## Overall Impression

The graph is one of Synapse’s most distinctive product artifacts, but the route treats draft management as equally important. The largest opportunity is to make the graph the immediate workspace, then reveal planning and saved-scenario complexity only when needed.

## What’s Working

1. **Product data is the visual identity.** Semester columns, real course codes, prerequisite arrows, conflicts, and earliest-placement calculations demonstrate connectedness directly.
2. **Scenario safety is thoughtful.** Preview language, per-move undo, reset, revision-conflict recovery, and shareable drafts make experimentation safer.
3. **Dependency explanations are concrete.** The inspector distinguishes missing, unplaced, same-semester, and later prerequisites and translates them into earliest valid placement.

## Cognitive Load

**6/8 checklist failures: high cognitive load.** Single focus, hierarchy, one-at-a-time flow, minimal choices, working-memory support, and progressive disclosure fail. Chunking and grouping pass.

Decision points over four options include dozens of course nodes, up to seven target semesters, four actions per saved plan, two actions per move-history entry, and several inspector regions. Saved plans and history are expanded before users ask for them.

## Emotional Journey

The route begins with a clear promise, then interrupts discovery with draft-plan administration. The graph creates the strongest moment by making degree connectedness tangible. Preview and undo language reduce anxiety around moving courses. The main valley arrives after selection: the inspector can appear below a tall canvas without scrolling or focus. The experience ends ambiguously because saving a draft, loading a draft, and changing the actual schedule are not clearly separated.

## Priority Issues

### [P1] The graph is buried under draft-management UI

- **Why it matters:** Saved plans and planning summaries render before the route’s defining content. The map moves farther down as the student uses it.
- **Fix:** Put the graph directly beneath its heading. Reduce saved plans to a compact control near the canvas and reveal the full library/history on demand. Keep Undo and Save close to the active draft.
- **Suggested command:** `$impeccable distill`

### [P1] Degree-scale navigation lacks an overview

- **Why it matters:** Eight semesters require roughly 2,800px of horizontal space. Scrolling fragments the connectedness the feature is meant to reveal. `jumpToCourse()` changes selection without scrolling or focusing the node.
- **Fix:** Add course search, Fit plan, semester navigation, and a compact overview/minimap. Make Jump center and focus the node. Use a sticky adjacent inspector and a narrow-screen list fallback.
- **Suggested command:** `$impeccable adapt`

### [P1] Prerequisite structure is not equivalently accessible

- **Why it matters:** The relationship SVG is hidden from assistive technology, node relationship states rely heavily on color, keyboard order can differ from visual order, and inspector focus is unmanaged.
- **Fix:** Provide an accessible semester-grouped list naming direct prerequisites, dependants, review state, and planning status. Align DOM and visual order, add textual relationship states, and focus or announce the inspector heading after selection.
- **Suggested command:** `$impeccable audit`

### [P2] The draft workflow has no clear completion boundary

- **Why it matters:** Copy says plans can be compared, applied, or discarded, while visible actions are Load, Rename, Duplicate, and Delete. Students cannot tell whether a valid draft changed anything real.
- **Fix:** If this is comparison-only, say “Save this draft for comparison” and remove “apply.” If schedule updates are intended, add a distinct validation and update step. Confirm destructive discard.
- **Suggested command:** `$impeccable clarify`

### [P2] The no-relationship state is a dead end

- **Why it matters:** “No prerequisite relationships have been added yet” explains the absence but does not help students create or review them.
- **Fix:** Link directly to the relationship-management/review surface. Explain where relationships originate and whether pending edges participate in plan checks.
- **Suggested command:** `$impeccable onboard`

## Persona Red Flags

**Alex, power user:** No search, fit, minimap, zoom, semester jump, or shortcuts beyond Escape. Jump-to-course does not navigate. Draft history scales noisily, and the always-open saved library delays the graph.

**Sam, accessibility-dependent user:** Edges are `aria-hidden`, upstream/downstream emphasis relies heavily on color, DOM and visual order may diverge, selection does not focus the inspector, and a large live region may announce too much content.

**Jordan, first-time student:** Draft management appears before the map. Clicking a course title versus Check has unclear consequences. “Preview,” “Load,” “Apply,” and the relationship-review process are insufficiently differentiated.

## Minor Observations

- Repeated eyebrow-plus-heading pairs add ceremony without improving comprehension.
- Four legend items arrive before users have interacted with the graph.
- The route description promises previewing changes, but the final result of a valid preview is unclear.
- The static scroller differs materially from DESIGN.md’s full-screen pan/zoom canvas description.
- Pending relationships are visible but not actionable in this route.

## Questions to Consider

1. Is the map primarily for understanding dependencies, or for producing an alternative semester plan?
2. Should a saved draft ever update the real schedule, or remain a comparison artifact?
3. What is the minimum overview needed for an eight-semester plan to feel connected rather than clipped?
4. Can the same prerequisite understanding be reached without seeing the SVG?
