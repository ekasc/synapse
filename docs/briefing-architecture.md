# Course Intelligence Brief Architecture

The Course Intelligence Brief is an asynchronous, evidence-first research pipeline. User-entered course names, institutions, professors, and notes are search hints, never evidence.

## Model Policy

- Search/extraction: `deepseek/deepseek-v4-flash`
- Synthesis/contradiction resolution: `deepseek/deepseek-v4-pro`, reasoning effort `high`
- Retryable synthesis fallback only: `qwen/qwen3.6-plus`

The server owns this allowlist. Client model fields are rejected. Environment overrides use `COURSE_RESEARCH_SEARCH_MODEL`, `COURSE_RESEARCH_SYNTHESIS_MODEL`, and `COURSE_RESEARCH_FALLBACK_MODEL`; unapproved values fail rather than silently routing elsewhere.

## Pipeline

1. Normalize the request and atomically create or return an active job.
2. Run one bounded Flash + Exa request for each required evidence category, with at most three concurrent calls and five results per call.
3. Validate every extracted URL against that response's `url_citation` annotations.
4. Canonicalize and deduplicate URLs, assign server source IDs and retrieval timestamps, classify currentness, and cap evidence at 30 unique sources, 12 synthesis sources, and 40,000 characters.
5. Send only the validated evidence bundle to Pro. Synthesis has no search plugin or tools, uses a strict JSON schema, and may refer only to server-issued source IDs.
6. Validate source IDs and source classes, then conditionally publish the cache, V3 briefing JSON, and successful job transition under the same running lease.

Required categories are catalog identity, prerequisites/restrictions, outline/syllabus, and schedule/instructor. Supplying a professor adds exact professor/course, professor/institution, and RateMyProfessors searches. RMP is optional secondary evidence and never satisfies official facts.

## Evidence Safety

- Only HTTP(S) URLs present in OpenRouter citation annotations are accepted.
- Fragments and known tracking parameters are removed before deduplication.
- Retrieved snippets are untrusted text and cannot alter instructions.
- Historical evidence cannot silently establish a current instructor, assessment, or workload.
- Missing and contradictory evidence remains visible.
- User notes never become sources.
- Legacy V2 records remain readable and are labelled legacy until explicitly refreshed.

## Cost Controls

- Search extraction output: 1,200 tokens per category.
- Synthesis output: 3,500 tokens.
- Search requests: four normally, seven with a professor.
- Default report ceiling: `$0.10`, configured by `COURSE_RESEARCH_MAX_ESTIMATED_COST_USD`.
- Pricing is calculated in integer microdollars, including `$0.005` for each Exa request.
- Daily, active-job, IP-aware, and refresh-age limits are server configured.
- Normal tests never perform live paid requests. Live evaluation requires `RUN_LIVE_COURSE_RESEARCH_EVAL=1` and a separate explicit invocation.

## Job Lifecycle

`queued -> running -> succeeded|failed|canceled|expired`

Active jobs hold a unique nullable `active_key`. Running jobs hold a lease token. Completion and failure are conditional on the expected state/lease, terminal jobs clear active identity, and polling can idempotently nudge a queued job. A canceled or expired lease cannot publish a briefing or cache entry.

## Caching

Evidence and final cache keys are independently versioned. The normalized request, schema/policy version, institution, professor, notes, and server model policy contribute to identity. Explicit source refresh bypasses the final cache and is rate limited.

## Migrations

Migration `0007_old_frog_thor.sql` adds active-job identity, lease/IP fields and indexes, plus the nullable `briefing_json` column used for V3 records. Existing V2 columns remain for compatibility. Generate D1 migrations with `pnpm db:d1:generate`; apply with Wrangler through `pnpm db:d1:migrate:local` or `pnpm db:d1:migrate:remote`.
