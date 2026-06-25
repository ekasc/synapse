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
| **Calendar Integration**            | Google Calendar API — aggregates deadlines across all courses into a unified view.                                                                                                                   |
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

## Links

- [Design System](/DESIGN.md)
- [Product Spec](/PRODUCT.md)
- [Proposal](../Prompt_Engineers_Proposal.pdf)
