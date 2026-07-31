---
target: dashboard
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-07-26T00-32-54Z
slug: src-routes-app-page-svelte
---

# Dashboard Design Critique

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                                                       |
| --------- | ------------------------------- | --------: | --------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     |       2/4 | Feed failures can become a false “all clear”; save success only closes the dialog.                              |
| 2         | Match System / Real World       |       3/4 | Academic language is strong, though “Briefs” and “Course map” need product knowledge.                           |
| 3         | User Control and Freedom        |       2/4 | “Show fewer” is unreachable after expansion; priority cards lack inline completion or deferral.                 |
| 4         | Consistency and Standards       |       2/4 | Notebook identity is cohesive, but local typography, focus styling, and repeated actions drift from the system. |
| 5         | Error Prevention                |       2/4 | A semester with no courses still exposes an impossible Add deadline flow.                                       |
| 6         | Recognition Rather Than Recall  |       3/4 | Metadata is descriptive, but the computed action labels are not shown.                                          |
| 7         | Flexibility and Efficiency      |       1/4 | No shortcuts, inline completion, batch actions, or exact event deep links.                                      |
| 8         | Aesthetic and Minimalist Design |       2/4 | Strong hero hierarchy, weakened by stripes, metric treatment, arrows, and duplicated quick actions.             |
| 9         | Error Recovery                  |       2/4 | Dialog errors preserve input; dashboard feed errors are hidden.                                                 |
| 10        | Help and Documentation          |       1/4 | Priority logic, course-color meaning, and actionable all-clear guidance are absent.                             |
| **Total** |                                 | **20/40** | **Acceptable; significant improvements needed**                                                                 |

## Anti-Patterns Verdict

**LLM assessment:** Recognizably AI-assisted, but not wholesale AI slop. Real course codes, grade weights, deadline reasoning, and the field-notebook system create specificity. The weaker component grammar uses saturated patterns: thick colored side stripes, hero metrics, a predictable two-column dashboard with Quick actions, repeated arrows, and the same marker behind each section title.

**Deterministic scan:** 3 warnings, all `side-tab`, in `src/routes/app/+page.svelte`: line 351 (`7px` hero stripe), line 422 (`4px` row stripe), and line 510 (`7px` all-clear stripe). Course and success semantics make these context-sensitive, but they are not false positives: all three still use the exact overfamiliar visual construction and collectively weaken meaning.

**Visual overlays:** None. Browser automation and mutable injection were unavailable, so the review used source inspection plus deterministic scan output.

## Overall Impression

The dashboard is good at telling a student what deserves attention, but weak at helping them finish it. Its strongest moment is the ranked priority hero; its biggest opportunity is to turn that recommendation into a direct, trustworthy action loop.

## What’s Working

1. **Priority hierarchy reflects academic stakes.** Tone, lateness, grade weight, and title sorting make the hero defensible rather than arbitrary.
2. **Information is initially well edited.** Attention items are removed from Coming up, and secondary attention starts at three rows.
3. **The accessibility foundation is credible.** Native buttons, semantic sections, `aria-live`, labeled navigation, a dialog primitive, focus rules, and reduced-motion support are present.

## Cognitive Load

**3/8 checklist failures: moderate.** Single focus, grouping, hierarchy, one-at-a-time flow, and working-memory support pass. Chunking, minimal choices, and progressive disclosure fail.

Decision points over four options include 11 workspace routes, six deadline types, and potentially long expanded attention/agenda lists. Progressive disclosure is also broken: after expansion, `hiddenCount` becomes zero, so Show fewer cannot render.

## Emotional Journey

Arrival is oriented but pressure-heavy. The ranked hero creates momentum by naming one important task and why it matters. The emotional valley comes after clicking: a precise recommendation often opens the broad calendar rather than the exact event. The end state is weak too: All clear suggests practice, review, or planning but links to none of them. The experience peaks at recognition, not resolution.

## Priority Issues

### [P1] “All clear” cannot be trusted

- **Why it matters:** Failed dashboard reads are converted to empty collections, so unavailable academic data can look like zero deadlines. False reassurance is a high-stakes trust failure.
- **Fix:** Track unavailable and empty states separately. Never render All clear when required feeds failed; show a compact refresh error with retry guidance.
- **Suggested command:** `$impeccable harden`

### [P1] Partial onboarding creates a dead end

- **Why it matters:** A student with a semester but no courses sees the normal dashboard and can open Add deadline with an empty required Course selector.
- **Fix:** Add a dedicated `courses.length === 0` state with one primary action, Add your first course. Hide or disable deadline creation until a course exists.
- **Suggested command:** `$impeccable onboard`

### [P1] The dashboard does not close the task loop

- **Why it matters:** Cards identify a precise task but generally route to a broad destination. The computed `actionLabel` is unused, and there is no complete, defer, or resume action.
- **Fix:** Deep-link to the exact item, render context-specific action labels, and add restrained inline completion where the underlying feature supports it.
- **Suggested command:** `$impeccable shape`

### [P2] Progressive disclosure is one-way

- **Why it matters:** Once expanded, a long attention list cannot be collapsed, increasing noise and reducing user control.
- **Fix:** Render Show fewer whenever `expanded && rest.length > 3`; do not base it on the current hidden count.
- **Suggested command:** `$impeccable polish`

### [P2] Color and decoration carry conflicting meanings

- **Why it matters:** Course identity, urgency, success, and decoration all compete through colored stripes and highlighted headings. Users cannot build a stable color model.
- **Fix:** Reduce course color to a small identifier; use explicit semantic urgency markers; remove thick side stripes; replace the metric strip with a compact status sentence; use fixed app-title sizing.
- **Suggested command:** `$impeccable distill`

## Persona Red Flags

**Alex, power user:** The hero opens a broad calendar instead of the exact item. There are no shortcuts, inline complete/defer actions, or batch controls. Show more cannot be reversed, and 11 workspace routes slow scanning.

**Sam, accessibility-dependent user:** Local form focus styling may replace the stronger ink outline with low-contrast highlighter. Card names communicate content but not the intended action. Small metadata and course-colored stripes increase scanning effort, though text prevents a color-only failure.

**Jordan, first-time student:** After adding a semester but no course, Jordan gets All clear instead of the next setup step. Add deadline opens an impossible form. Add a course routes to semesters, and the all-clear recommendations have no matching actions.

## Minor Observations

- `summary.sentence`, `actionLabel`, and other computed context are available but unused.
- “+ add deadline,” “Add a deadline,” and “Add deadline” are inconsistent.
- Quick actions duplicates the header’s Add deadline action.
- The all-clear branch removes Quick actions exactly when exploratory actions are useful.
- Decorative use of `--warn` behind every section heading weakens its semantic meaning.
- The app title uses a large fluid scale despite the product guideline favoring fixed, quieter headings.

## Questions to Consider

1. Is Today’s focus meant to help students decide what to do, or help them finish it?
2. Can Synapse ethically say All clear when any academic feed failed?
3. Should color answer Which course? or How urgent? Which meaning deserves the stronger signal?
4. If one task is the focus, do four generic Quick actions belong beside it?
