# Synapse

**Your degree is one graph, not four semesters.**

A personal academic hub that turns course syllabi, grades, and materials into a connected knowledge graph across your entire degree — from first semester to graduation.

## Team

**Prompt Engineers** — CSIS 4495-071 Capstone Project

| Member                   | GitHub                                        |
| ------------------------ | --------------------------------------------- |
| Ekas Chhabra (300388928) | [ekasc](https://github.com/ekasc)             |
| Demi Le (300312139)      | [maidinh2409](https://github.com/maidinh2409) |

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Frontend       | SvelteKit, TypeScript, Tailwind CSS |
| Database       | PostgreSQL (Neon) + Drizzle ORM     |
| AI / LLM       | Cloud LLM API                       |
| PDF Processing | pdf-parse + LLM extraction          |
| Hosting        | Cloudflare Workers / Pages          |
| Tooling        | pnpm, Vitest, ESLint, Prettier      |

## Features

### Ekas

| Feature                             | Description                                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Course Linker & Knowledge Graph** | Semantic similarity matching across semesters — auto-suggests prerequisite and knowledge connections between courses.                                                                                |
| **Weekly Digest**                   | AI-generated proactive summary of standing, deadlines, study gaps, and recommendations. Changes each week based on live graph data.                                                                  |
| **Frontend UI**                     | Custom Field Notebook design system. Single-scroll landing page demonstrating the product narrative. SvelteKit app with course management, grade tracking, and AI interfaces.                        |
| **Course Intelligence Brief**       | Autonomous research agent that investigates prospective courses — institution website, RateMyProfessor, course outlines — and produces structured pre-semester briefings.                            |
| **Exam Prep**                       | RAG-based personalized practice questions from uploaded course materials, weighted by the student's grade history so weak topics get more attention. Includes answer checking and progress tracking. |
| **Calendar Integration**            | First-party calendar that aggregates deadlines across all courses into a unified view.                                                                                                               |
| **Deployment**                      | Cloudflare Workers/Pages configuration, CI/CD, environment setup.                                                                                                                                    |

### Demi

| Feature                          | Description                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **AI Syllabus Parser**           | Upload syllabus PDF → AI extracts deadlines, grade weights, course topics, and learning objectives into structured graph data.           |
| **Grade Analytics**              | Weight-aware grade projection ("what do I need on the final"), workload forecasting across the semester timeline, and live GPA tracking. |
| **NL Query Engine / AI Chatbot** | Read-only conversational interface over the academic graph — ask anything about grades, deadlines, courses, or trends in plain English.  |
| **Database Implementation**      | PostgreSQL schema design with Drizzle ORM — courses, assignments, grades, topics, prerequisite edges. Cross-semester graph queries.      |
| **Study Timer**                  | Per-course study time tracking, accumulated across terms.                                                                                |
| **CSV Import/Export**            | Data portability for grades and course records.                                                                                          |
| **Testing & QA**                 | Unit tests, integration tests, edge case validation.                                                                                     |
| **AI Usage Documentation**       | Documentation of all AI integrations for the project report.                                                                             |

### Shared

- Architecture decisions
- Code review
- Final presentation preparation

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Course Brief │────▶│ Syllabus     │────▶│ Course Linker│
│  (Research)   │     │ Parser (AI)  │     │ (Graph)      │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Weekly      │◀────│ Exam Prep    │◀────│ Grade        │
│  Digest      │     │ (RAG + AI)   │     │ Analytics    │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
┌──────────────┐     ┌──────────────┐
│  NL Query    │     │ Calendar +   │
│  Engine      │     │ UI + Timer   │
└──────────────┘     └──────────────┘
```

Data flows left to right: research → parse → connect → analyze → prepare → surface.

## Getting Started

```sh
pnpm install
pnpm dev
```

## D1 Migrations

Drizzle Kit declares the D1 schema and generates version-controlled SQL migrations. Wrangler
applies those migrations through the configured `BRIEF_DB` binding.

```sh
# Generate SQL and Drizzle metadata after changing the D1 schema
pnpm db:d1:generate

# Apply pending migrations to Wrangler's local D1 state (no Cloudflare credentials required)
pnpm db:d1:migrate:local

# Apply pending migrations to the configured remote D1 database (Cloudflare login required)
pnpm db:d1:migrate:remote

# Inspect local or remote pending migrations
pnpm wrangler d1 migrations list BRIEF_DB --local
pnpm wrangler d1 migrations list BRIEF_DB --remote
```

## Project-local development state

Use the project-local workflow after cloning, switching Macs, or synchronizing state:

```sh
# Validate and stage the local D1 state before atomically installing it
pnpm local:bootstrap

# Start local Pages development (default port: 8788)
pnpm local:dev [port]

# Verify local state integrity (run any time)
pnpm local:verify
```

`.synapse-local/` is ignored by Git but may be synchronized through Syncthing. It contains
Wrangler D1 persistence, ledgers, screenshots, runtime locks, and backups. These commands only
use `--local`; they do not access remote D1 or apply remote migrations.

Bootstrap considers only the project-local D1 directory and the legacy local Wrangler D1
directory. It rejects corrupt, incomplete, or equally strong but materially different SQLite
candidates. A valid candidate must pass `PRAGMA integrity_check`, contain Synapse's required
tables and migration history, and preserve the three established briefing rows. It stages all
work in `.synapse-local/runtime/` and atomically replaces the canonical SQLite file only after
migrations, briefing preservation, and semester reconciliation pass.

`local:dev` and `local:bootstrap` share a hostname-specific runtime lock. Bootstrap refuses when
local development is active on the same host, and concurrent bootstraps are refused. An abrupt
termination can leave a stale lock; the next command validates the same-host PID and safely
removes a stale lock. Never run local development simultaneously on two machines against the same
Syncthing-synchronized SQLite state.

Bootstrap retains 10 validated backups by default. Set `SYNAPSE_BACKUP_KEEP` to a positive integer
to override that count. Corrupt or unrecognized files are reported and retained rather than
deleted. If verification fails, stop local development, run `pnpm local:verify`, inspect the
reported candidate or retained staging directory, and restore only from a backup that passes
`PRAGMA integrity_check`.

Do not use `drizzle-kit migrate` to apply binding-based D1 migrations; it expects direct database
credentials rather than the runtime binding.

## Links

- [Design System](/DESIGN.md)
- [Product Spec](/PRODUCT.md)
- [Proposal](../Prompt_Engineers_Proposal.pdf)
