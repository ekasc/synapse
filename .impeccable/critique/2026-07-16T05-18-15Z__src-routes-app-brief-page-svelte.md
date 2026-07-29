---
target: Course Brief detail page
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-07-16T05-18-15Z
slug: src-routes-app-brief-page-svelte
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of system status | 3 | Research age and refresh are visible, but “Current evidence” overstates completeness. |
| 2 | Match with the real world | 2 | Requirements are treated as metrics; RMP language is internally contradictory. |
| 3 | User control and freedom | 3 | Back, refresh, and delete are available; source detail cannot be collapsed. |
| 4 | Consistency and standards | 1 | “Unrated” conflicts with “overall quality rating of 65%”; typography violates DESIGN.md. |
| 5 | Error prevention | 1 | Unsupported or misclassified RMP data is promoted visually instead of suppressed. |
| 6 | Recognition rather than recall | 3 | Course facts are co-located and labeled. |
| 7 | Flexibility and efficiency | 2 | The page is readable but has no compact/expert path or source disclosure control. |
| 8 | Aesthetic and minimalist design | 2 | Repeated cards, mono labels, expanded diagnostics, and source chips add noise. |
| 9 | Error recovery | 2 | Missing evidence is named, but the page offers no targeted recovery besides full refresh. |
| 10 | Help and documentation | 1 | Evidence classes and RMP limitations are not explained in student language. |
| **Total** | | **20/40** | **Acceptable, significant revision needed** |

## Anti-Patterns Verdict

**LLM assessment:** Yes, it still looks AI-generated. Synapse’s paper-notebook identity is recognizable, but this page overlays it with a generic dashboard pattern: identical KPI cards, large serif values, tiny tracked mono labels, ruled editorial sections, and a side-stripe callout. The metrics grid directly conflicts with `DESIGN.md`, which says app pages should be tool-like and explicitly bans large metric-card dashboards. The established cream palette is intentional brand identity, not independently a defect.

**Deterministic scan:** One warning in `src/routes/app/brief/+page.svelte`: `side-tab` at the 3px left border on `.review-card`. This is a true positive and matches the manual review. No other CLI rules fired.

**Browser evidence:** Live screenshots were captured at desktop and 390px widths. No detector overlay was injected because this session exposes no mutable browser-tab/console tool; screenshots and source inspection were used instead.

## Overall Impression

The page now has sections, but its strongest visual treatment is attached to the least trustworthy and least metric-like data. The assessment table is the most successful component. The biggest opportunity is to stop treating every extracted field as a dashboard KPI and build a compact course-facts header followed by decision-oriented content.

## What’s Working

- The assessment table is semantic, scannable, and maps naturally to the source data.
- The course description has a sensible reading width and clear section boundary.
- Back navigation, research freshness, refresh, missing evidence, and source traceability are visible.

## Priority Issues

### [P1] The RMP presentation contradicts itself

**Why it matters:** The top card says “Unrated,” while the paragraph below claims an “overall quality rating of 65%.” A student cannot know which value is trustworthy. Visual promotion makes a data-quality defect look authoritative.

**Fix:** Do not render an RMP metric without a validated 1–5 rating. Label 65% only as “would take again” when explicitly supported. If no validated metric exists, omit the card and keep a clearly labeled qualitative summary below.

**Suggested command:** `/harden`

### [P1] The metrics grid uses the wrong visual model

**Why it matters:** Credits can be a compact stat, but delivery, prerequisites, and corequisites are facts or requirements, not KPIs. Giving all five identical cards equal weight creates a generic dashboard and violates Synapse’s documented “no large metric-card dashboards” rule.

**Fix:** Replace the card grid with one compact facts band: credits and delivery as short values; prerequisites and corequisites as wider requirement rows. Cap the top group at four items and omit empty/invalid facts.

**Suggested command:** `/layout`

### [P2] Evidence complexity is not progressively disclosed

**Why it matters:** “Missing evidence” and four raw source chips, including internal IDs such as `src_prerequisites_01`, occupy a large part of the mobile page. Most students need confidence and provenance, not pipeline identifiers.

**Fix:** Collapse provenance under a “4 sources” disclosure. Remove internal IDs from labels. Show missing evidence as a concise availability note near the affected field, with full diagnostics in a disclosure.

**Suggested command:** `/distill`

### [P2] Typography violates the project’s own system

**Why it matters:** `DESIGN.md` reserves Source Serif 4 for the sidebar wordmark, but the course title, section headings, and metric values use it. Repeated tiny uppercase mono labels create the editorial-AI scaffold the brand guidance warns against.

**Fix:** Use Kalam for the course/page title and section headings, Inter for fact values and body content, and JetBrains Mono only for metadata and genuinely data-like labels.

**Suggested command:** `/typeset`

### [P2] Mobile reading is too long and administratively weighted

**Why it matters:** At 390px, users scroll through five full-width cards, description, instructor/reviews, assessment, missing evidence, source chips, and delete. The page ends on diagnostics and deletion rather than the useful course decision.

**Fix:** Reduce the facts header, collapse sources/diagnostics, shorten the RMP caveat, and keep destructive controls visually separated in a compact footer.

**Suggested command:** `/adapt`

## Persona Red Flags

**Alex, power user:** The top facts cannot be scanned as a coherent set because requirements and ratings share one KPI treatment. Expanded provenance and diagnostics slow the path to the assessment structure and course requirements.

**Sam, accessibility-dependent user:** Semantic headings and the assessment table are strengths. However, the RMP contradiction is not merely visual and will also be announced by a screen reader. Small tracked mono labels and verbose source-link names increase effort at zoom and during linear navigation.

**Casey, distracted mobile user:** The five stacked fact cards consume almost a full screen before the description. Refresh remains near the top, and source diagnostics create a long tail. The useful assessment table is several screens down.

## Minor Observations

- The course code is repeated in both the code label and title.
- “Current evidence” sounds complete despite explicit missing evidence.
- “Instructor & student reviews” combines official and student-reported concepts with different trust levels.
- The review card’s 3px side stripe is a confirmed AI-style tell.
- Source chips use implementation-facing IDs and inconsistent widths.

## Questions to Consider

- Should the top area answer “Can I take it, how is it taught, and how is it graded” rather than imitate a dashboard?
- Is RMP important enough to occupy the facts header, or should it remain supplemental?
- Would a collapsed provenance drawer preserve trust without making pipeline details part of the primary reading flow?
