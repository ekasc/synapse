# Complete weekly plan generation and caching

## Goal
Generate one weekly plan automatically every Sunday, reuse it for the entire Sunday–Saturday week, and regenerate only through an explicit user action. Show clear pending feedback while regeneration runs.

## Implementation

1. **Correct weekly identity and caching**
   - Change the cache key helper in `src/lib/server/weekly-digest-data.ts` to use the Sunday that starts the current week.
   - Always consult the cache first, including on Sunday.
   - On cache miss, assemble once and store it.
   - Keep explicit replacement separate from normal cache lookup so ordinary page navigation never regenerates an existing plan.
   - Preserve optional prose in the same cache payload.

2. **Use an explicit POST action for regeneration**
   - Replace `?regenerate=true` behavior in `src/routes/app/weekly/+page.server.ts` with a named SvelteKit form action.
   - The action assembles a fresh plan, replaces the current week's cache, generates/caches prose, then redirects to canonical `/app/weekly` (POST/redirect/GET).
   - Normal `load` remains cache-first and never treats URL state as regeneration permission.

3. **Update weekly page feedback**
   - Replace the query-string button with a progressively enhanced form using SvelteKit `use:enhance`.
   - Disable the button and show `LoadingDots`/“Regenerating…” while the action is pending.
   - Retain the cached/generated badges and expose action failures accessibly.

4. **Populate the cache from the Sunday cron**
   - Add a secret-guarded weekly cache-generation API route, or extend the existing weekly push route so the scheduled path first calls the same idempotent cache service and then sends push notifications from that result.
   - Move the Cloudflare cron in `wrangler.jsonc` from Monday to Sunday.
   - Keep the worker wrapper unchanged except where needed for the shared scheduled endpoint.
   - Scheduled generation uses cache-first semantics, so a Sunday page visit and cron cannot intentionally regenerate the same week repeatedly.

5. **Migration/schema cleanup**
   - Keep `migrations/0014_weekly_digest_cache.sql` and the matching Drizzle schema.
   - Add explicit repository helpers needed for read/upsert/replacement without coupling serialized payload details into unrelated DB code.

6. **Tests**
   - Add unit tests for Sunday week-key boundaries and cache behavior: cache hit, cache miss, Sunday cache hit, explicit replacement, malformed cache fallback.
   - Add page-server tests for ordinary load and explicit regenerate action/redirect.
   - Add scheduled endpoint tests verifying cache population and reuse.
   - Update any cron/build expectations affected by Sunday scheduling.

7. **Validation**
   - Run focused weekly tests, then `npm run check`, `npm run lint`, and the relevant/full unit test suite.
   - Report any failures that predate these changes separately.

## Deployment follow-up
The code migration will be ready, but the user must apply `0014_weekly_digest_cache.sql` to local/remote D1 through the project's normal Wrangler migration commands before deployed caching can operate.
