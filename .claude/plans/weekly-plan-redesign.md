# Weekly plan visual redesign

## Difficulty classification and delegation

- **High — UX architecture and information hierarchy:** delegated to an Opus planning agent. It designed the summary/next-up/timeline/compact priorities/disclosure hierarchy and accessibility behavior.
- **Low — codebase and data-shape discovery:** delegated to Haiku exploration agents. They mapped the existing weekly page, digest fields, and reusable UI patterns.
- **Medium — implementation:** main agent will implement the Svelte view-model, page components, responsive CSS, and tests because these changes touch one cohesive feature and must preserve the current uncommitted working tree.
- **High — final review:** after implementation, delegate an independent Opus review focused on correctness, accessibility, responsive behavior, and information loss.

## Implementation plan

1. **Add a pure weekly page view-model**
   - Create `src/lib/dashboard/weekly-view-model.ts`.
   - Derive:
     - four compact metrics: deadlines, known grade weight, courses in focus, study gaps;
     - next-up item: overdue deadline first, then earliest deadline, then priority rank 1;
     - exactly seven Sunday–Saturday day buckets from the cached plan's generated week key/current digest range;
     - separate overdue items;
     - compact priority labels from existing fields/factors;
     - grouped health/secondary warning counts.
   - Keep the underlying `WeeklyDigest` unchanged and preserve full reasons/factors for disclosures.

2. **Add focused view-model tests**
   - Test next-up selection, timeline bucketing, overdue separation, unknown weight handling, course deduplication, and empty/fallback states.

3. **Split the UI into focused components**
   - Add components under `src/lib/components/weekly/`:
     - `WeeklyMetrics.svelte`
     - `NextUpCard.svelte`
     - `WeeklyTimeline.svelte`
     - `WeeklyPriorityList.svelte`
     - `CollapsibleSection.svelte`
     - `PlanHealth.svelte`
   - Reuse existing button, badge, typography, and paper/rule design tokens rather than adding a new visual language.

4. **Rebuild `/app/weekly` hierarchy**
   - Preserve loading, cached/new-week metadata, regenerate POST action, degraded-source alert, and no-course empty state.
   - Header: compact range/meta with regenerate aligned right.
   - AI prose: concise “Week at a glance” disclosure/callout instead of a large paragraph.
   - First viewport: metrics → Next up → seven-day timeline.
   - Then compact top-three priorities with “Why this?” disclosures.
   - Move continuation items and study gaps into collapsed secondary sections.
   - Move material indexing, briefing, prerequisite, invalid-date, and degradation information into collapsed Plan health while keeping the top-level degraded warning.
   - Avoid rendering empty secondary sections.

5. **Responsive and accessible behavior**
   - Desktop timeline: seven columns.
   - Mobile timeline: stacked day groups, no cramped horizontal cards.
   - Native `<details>/<summary>` for disclosures.
   - Visible Today/Overdue/Crunch text labels; no color-only meaning.
   - Semantic headings/lists, keyboard focus styles, and adequate touch targets.
   - Preserve complete text in disclosures rather than permanently clipping it.

6. **Validation and independent review**
   - Format and run focused view-model/weekly tests.
   - Run focused ESLint and production build.
   - Delegate a final Opus review and fix confirmed issues.
   - Report unrelated pre-existing repository check failures separately.
