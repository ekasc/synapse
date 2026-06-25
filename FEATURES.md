# Synapse Feature Ownership

> Strict feature boundaries for team Prompt Engineers (CSIS 4495-071).
> Agents must not implement, modify, refactor, or debug code outside their assigned scope.
> See `AGENTS.md` §5 for the enforcement rule.

---

## Ekas (7 features)

| #   | Feature                             | Description                                                                                                                                                                                                                       |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Course Linker & Knowledge Graph** | Interactive canvas with course nodes, directed edges, pan/zoom, inspector, undo/redo, minimap, multi-select, box select, link mode, save/restore. AI-suggested topic connections between courses when a new syllabus is uploaded. |
| 2   | **Weekly Digest**                   | AI-generated push summary of deadline load, current standing, study gaps, prioritized recommendations. Generated from live graph data on a schedule.                                                                              |
| 3   | **Frontend UI**                     | All SvelteKit pages, landing page, dashboard, app layout, sidebar navigation, Field Notebook design system (cream paper, Kalam/Inter, highlighter yellow, tape, polaroid), responsive styling.                                    |
| 4   | **Course Intelligence Brief**       | Per-course overview with prerequisite links, grade context, extracted syllabus summary, research notes. Agent prompt exists at `course-brief-prompt.md`.                                                                          |
| 5   | **Exam Prep (RAG)**                 | Grade-aware practice questions generated from course materials. RAG over uploaded notes and assignment specs. "What do I need on the final?" integration with grade data.                                                         |
| 6   | **Calendar Integration**            | Aggregated calendar view showing deadlines across all courses in one interface.                                                                                                                                                   |
| 7   | **Deployment**                      | Cloudflare Workers/Pages hosting, Neon DB, CI/CD, production setup, environment configuration.                                                                                                                                    |

## Demi (8 features)

| #   | Feature                          | Description                                                                                                                                                                                                              |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **AI Syllabus Parser**           | Upload syllabus PDF → AI extracts course name/term/instructor, assignment/exam deadlines with weights, grading scheme breakdown, course topics. Writes directly to the graph. Ambiguous cases flagged for manual review. |
| 2   | **Grade Analytics**              | Grade projection engine (weight-aware calculation, "what do I need on the final", GPA tracking) + workload forecasting (crunch week detection, risk flags, schedule conflict detection).                                 |
| 3   | **NL Query Engine / AI Chatbot** | Plain English questions → structured query against the academic graph → precise answer. _Not_ a general chatbot — constrained to academic data queries.                                                                  |
| 4   | **Database**                     | PostgreSQL schema design, Drizzle ORM setup, migrations, seed data, data layer implementation.                                                                                                                           |
| 5   | **Study Timer**                  | Pomodoro-style timer with cross-semester accumulation and habit tracking.                                                                                                                                                |
| 6   | **CSV Import/Export**            | Grade data import/export via CSV files.                                                                                                                                                                                  |
| 7   | **Testing & QA**                 | Test suite, manual testing, bug tracking, quality assurance.                                                                                                                                                             |
| 8   | **AI Usage Documentation**       | Document all AI tools integrated into the product (for final AI Usage Report).                                                                                                                                           |

## Shared (Both)

- Architecture decisions
- Code review
- Final presentation preparation

---

## Rules

1. **Do not touch code owned by the other person.** If a task requires changes to both scopes, flag it — don't implement both sides.
2. **If you're unsure whether code belongs to your scope, stop and ask.** Don't guess.
3. **Shared infrastructure** (layouts, shared components, utilities) can be modified by either person with explicit coordination.
4. **AI feature code** (Demi's scope) includes: prompt templates, LLM integration, extraction/query pipelines, grade calculation logic. Do not touch.
5. **UI/UX code** (Ekas's scope) includes: all `.svelte` files (except Demi's specific feature pages), styles, design system tokens, responsive breakpoints. Do not touch unless coordinating.
