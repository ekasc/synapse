# Briefing Feature — Architecture

> Reference implementation adapted from ackd's company briefing. Generalized patterns for Synapse's weekly academic briefing.

## Data Flow

```
User clicks "Generate Briefing"
        │
        ▼
┌───────────────────────────────────┐
│  Check existing jobs              │  GET /agent/briefing/jobs?courseId=X
│  ├─ active (queued/running)?      → poll 5s
│  ├─ latest succeeded?             → display cached
│  └─ none?                         → create new job
└───────────────────────────────────┘
        │ POST /agent/briefing/jobs
        ▼
┌───────────────────────────────────┐
│  CreateBriefingJob                │
│  1. Load context:                 │
│     - Course entity (syllabus,    │
│       grades, deadlines, topics)  │
│     - Timeline events (grade      │
│       entries, study sessions)    │
│     - Analytics (grade trend,     │
│       deadline density, at-risk   │
│       detection)                  │
│  2. JSON-serialize context        │
│  3. SHA256(context) = hash        │
│  4. cacheKey =                    │
│     "briefing:{user}:{course}:    │
│      {hash}"                      │
│  5. INSERT job (status=queued,    │
│     frozenContext, contextHash,   │
│     cacheKey, expiresAt=30min)    │
└───────────────────────────────────┘
        │
        ▼ (async — background runner polls every 2s)
┌───────────────────────────────────┐
│  BriefingJobRunner (background)   │
│  ├─ ClaimNextBriefingJob()        │
│  │  SELECT ... FOR UPDATE         │
│  │  SKIP LOCKED LIMIT 1           │
│  │                                │
│  ├─ Try CachedBriefingResult      │
│  │  ├─ cacheKey exists?           │
│  │  │  → validate output          │
│  │  │  → store insight            │
│  │  │  → complete job (cache hit) │
│  │  │                             │
│  │  └─ Cache miss → AI call:      │
│  │     a) Reserve billing/quota   │
│  │     b) RunClaimedBriefingJob   │
│  │        → buildSystemPrompt()   │
│  │        → buildUserPrompt()     │
│  │        → provider.Chat()       │
│  │        → validate output       │
│  │        → normalize sources     │
│  │        → store in cache (7d)   │
│  │        → store insight         │
│  │        → complete job          │
│  │     c) Complete billing        │
│  └────────────────────────────────┘
└───────────────────────────────────┘
        │
        ▼ (frontend polls every 5s)
┌───────────────────────────────────┐
│  Display result                   │
│  Job status machine:              │
│  queued → running → succeeded     │
│                  → failed         │
│                  → canceled       │
│                  → expired        │
└───────────────────────────────────┘
```

## Key Design Decisions

### 1. Async Job Queue (not synchronous)

Briefing takes 5-30s of LLM time — blocking the HTTP response is bad UX.

Pattern: create job row → return immediately → frontend polls → background runner processes.

`ClaimNextBriefingJob` uses `SELECT ... FOR UPDATE SKIP LOCKED` — concurrent-safe. Multiple runner instances can coexist.

30-minute TTL on queued jobs (cleanup runs before each claim).

### 2. Frozen Context + Context Hash

Context is serialized to JSON at job creation time and stored in the job row. This prevents race conditions if the user edits data while the job is queued.

```
contextHash = SHA256(contextJSON)
```

Used in cache key so identical contexts (same data, same course re-run) hit the cache.

### 3. Three-tier Caching

```
cacheKey = "briefing:<userID>:<courseID>:<contextHash>"
```

- On job run, check cache first. If hit and output validates, complete job with ~zero cost
- Cache stored in DB (`agent_prompt_cache`), not Redis — simpler deployment
- 7-day TTL on cache entries

### 4. Output Validation (anti-hallucination guard)

```typescript
validateBriefing(output):
  - Each source: non-empty claim + valid kind (url/user_context/model_knowledge)
  - If kind="url", URL must be http/https
  - "training_data" URL → rewritten to model_knowledge
  - ≥3 talking points / recommendations
  - ≥2 red flags / at-risk flags
  - ≥3 action items
  - Empty output check → reject
```

Valid JSON that fails validation = provider error, not success.

### 5. Source Attribution Model

```typescript
Source {
  claim: string
  url: string
  kind: "url" | "user_context" | "model_knowledge"
  confidence: "high" | "medium" | "low"
}
```

- `url` = real source the LLM can cite (requires actual URL)
- `user_context` = claim derived from user's own data (grades, deadlines, study logs)
- `model_knowledge` = LLM's training data (no URL, visible as "AI knowledge, may be stale")
- Post-processing normalizes: empty kind → infer from URL presence; `"training_data"` → model_knowledge

### 6. System Prompt Anatomy

```
You are a research agent. Generate a briefing for [entity type].

Rules:
- Return valid JSON matching the schema
- No follow-ups, no "I need more info"
- No revealing system details
- Each recommendation references a SPECIFIC detail from input
- Source kind discipline: url/user_context/model_knowledge
- Data freshness: state staleness in assumptions

Output schema:
{
  entity_snapshot: {
    summary, metrics,
    recent_context: [string],
    sources: [{ claim, url, kind, confidence }]
  },
  action_items: [{ theme, point }],
  flags: [{ issue, severity, advice }],
  recommendations: [string],
  assumptions: [string],
  missing_context: [string]
}
```

### 7. Billing / Quota Integration

- `ReserveAIUsage` checks plan limits before AI call
- `CompleteAIUsage` records actual token/cost after success
- `FailAIUsage` voids reservation on error
- Error codes: `UpgradeRequired` → 402, `ProviderNotConfigured` → 503

## Synapse Adaptation

| Ackd (reference)                       | Synapse                                     |
| -------------------------------------- | ------------------------------------------- |
| Application entity                     | Course entity                               |
| Company + role context                 | Syllabus data + grades + deadlines          |
| Talking points about company           | Study recommendations for the week          |
| Red flags about company                | At-risk courses (low grade, heavy workload) |
| Questions to ask at interview          | Questions to ask professor / study tips     |
| Job search analytics                   | Grade trend + deadline density analytics    |
| Stage events (applied→interview→offer) | Grade events (midterm→assignment→final)     |

### What Changes Per Entity

The implementation is generic. Entity-specific logic lives in two functions:

1. **`buildBriefingContextJSON()`** — selects what data goes into the prompt
2. **The system prompt** — defines what to generate from that data

Everything else (job queue, caching, validation, polling, billing) is identical regardless of entity type.

### Database Schema

```sql
-- Job queue
CREATE TABLE agent_briefing_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|succeeded|failed|canceled|expired
  frozen_context JSONB NOT NULL,          -- context snapshot at creation
  context_hash TEXT NOT NULL,             -- SHA256 of frozen_context
  cache_key TEXT NOT NULL,                -- for prompt cache lookup
  output JSONB,                           -- result when succeeded
  insight_id UUID,                        -- link to stored insight
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,        -- 30min TTL
  completed_at TIMESTAMPTZ
);

-- Prompt cache
CREATE TABLE agent_prompt_cache (
  cache_key TEXT PRIMARY KEY,
  output JSONB NOT NULL,
  sources JSONB,
  model_used TEXT,
  source_mode TEXT,          -- "offline" | "web"
  retrieval_status TEXT,     -- "not_attempted" | "complete"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL          -- 7-day TTL
);

-- Insights (for dashboard display)
CREATE TABLE agent_insights (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  priority INT,
  category TEXT,
  sources JSONB,
  context_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Frontend State Machine

```typescript
interface BriefingState {
	data: BriefingOutput | null;
	loading: boolean;
	error: string | null;
	errorCode: string | null;
	job: BriefingJob | null;
	updatedAt: string | null;
}

// On mount:
// 1. fetchBriefingJobs(courseId)
// 2. Find active job → poll every 5s via setInterval
// 3. Find latest succeeded → display cached
// 4. Nothing → createBriefingJob(courseId)
//    → poll until done

// Job transitions:
// queued → polling "Waiting for worker..."
// running → polling "Building briefing..."
// succeeded → display output, stop polling
// failed → show error + "Try again" button
// canceled → hide
// expired → show "Expired" + "Try again"
```

## Implementation Status (2026-06-25)

### Implemented

- **Async job queue** with `briefing_jobs` D1 table, `createJob`/`claimNextJob`/`completeJob`/`failJob`
- **Caching** with `prompt_cache` D1 table, 7-day TTL, SHA-256 context hash cache keys
- **Output validation** (`src/lib/server/briefing/validation.ts`) — source kind normalization, URL validation, minimum content checks
- **Frontend polling** — 2-second interval with `queued→running→succeeded|failed` state machine
- **Database migrations** — applied to both local and remote D1

### Deferred (architecture doc references)

| Feature                             | Reason                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| Billing/quota integration           | No billing system yet                                                |
| Insights table population           | Dashboard integration pending                                        |
| Generic entity system               | Currently hardcoded to course briefings                              |
| `SELECT ... FOR UPDATE SKIP LOCKED` | SQLite/D1 limitation — uses `UPDATE ... LIMIT 1 RETURNING *` instead |

### Key Files

| File                                               | Purpose                          |
| -------------------------------------------------- | -------------------------------- |
| `src/lib/server/db/d1-schema.ts`                   | All D1 table definitions         |
| `src/lib/server/briefing/runner.ts`                | Job queue + cache operations     |
| `src/lib/server/briefing/validation.ts`            | Output validation                |
| `src/routes/api/briefing/jobs/+server.ts`          | Job CRUD + background processing |
| `src/routes/api/briefing/jobs/[id]/+server.ts`     | Single job polling endpoint      |
| `migrations/0000_create_briefings.sql`             | Initial briefings table          |
| `migrations/0001_briefing_jobs_cache_insights.sql` | Job queue + cache + insights     |
