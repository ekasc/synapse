# Weekly Plan: Cache & Auto-Generation Plan

## Problem
- Weekly plan regenerates on **every** page visit (slow, wasteful)
- No loading indication during generation
- No way to manually regenerate
- Should auto-generate on Sunday, serve cached Mon–Sat

## Solution Overview

Add a `weekly_digest_cache` table in D1. On page load, check if a cached digest exists for the current week. Regenerate only on Sunday, on cache miss, or when the user explicitly requests it. Add a "Regenerate" button and proper loading state.

---

## Files to Change

### 1. Migration `migrations/0014_weekly_digest_cache.sql` (new)
```sql
CREATE TABLE weekly_digest_cache (
  week_start TEXT PRIMARY KEY,   -- e.g. "2026-07-20" (Monday)
  digest_json TEXT NOT NULL,     -- JSON blob of WeeklyDigestBundle
  created_at TEXT NOT NULL
);
```

### 2. `src/lib/server/db/d1-schema.ts` — add table definition
```ts
export const weeklyDigestCache = sqliteTable('weekly_digest_cache', {
  weekStart: text('week_start').primaryKey(),
  digestJson: text('digest_json').notNull(),
  createdAt: text('created_at').notNull()
});
```

### 3. `src/lib/server/db/d1.ts` — add cache methods to `createDb`
- `getWeeklyDigestCache(weekStart: string): Promise<WeeklyDigestBundle | null>`
- `setWeeklyDigestCache(weekStart: string, bundle: WeeklyDigestBundle): Promise<void>`

### 4. `src/lib/server/weekly-digest-data.ts` — add cached assembly function
New exported function `getOrAssembleWeeklyDigest()` that:
1. Computes `weekStart` (Monday of current week from `now`)
2. Checks `isSunday` (`now.getDay() === 0`)
3. If `!forceRegenerate && !isSunday && binding` → try D1 cache
4. On cache hit → return `{ ...bundle, cached: true }`
5. On miss → call `assembleWeeklyDigest()`, write cache, return `{ ...bundle, cached: false }`
6. If no binding → fall back to fresh generation always

### 5. `src/routes/app/weekly/+page.server.ts` — use caching
```ts
export async function load(event) {
  const forceRegen = event.url.searchParams.get('regenerate') === 'true';
  const bundle = await getOrAssembleWeeklyDigest({
    now: new Date(),
    binding: event.platform?.env?.BRIEF_DB as D1Database | undefined,
    bucket: event.platform?.env?.MATERIALS as R2Bucket | undefined,
    forceRegenerate: forceRegen
  });
  // ... prose logic unchanged
  return { ...bundle, prose, proseModel };
}
```

### 6. `src/routes/app/weekly/+page.svelte` — UI changes
- Add `cached` / `isSunday` to `PageData` type
- Add "Regenerate" button in the header (navigates to `?regenerate=true`)
- Show loading state via `$navigating` (already exists!)
- Show a "Cached from …" badge when `data.cached === true`
- During regeneration navigation, the existing `<LoadingDots label="Updating plan" />` shows

### 7. `src/routes/app/weekly/+error.svelte` — read to ensure no changes needed
(Already exists; no changes needed.)

---

## Behavior Matrix

| Day | Cache exists? | `?regenerate`? | Action |
|-----|--------------|----------------|--------|
| Sunday | any | no | Generate fresh, cache, return |
| Sun | any | yes | Generate fresh, cache, return |
| Mon–Sat | yes | no | Return cached |
| Mon–Sat | no | no | Generate fresh, cache, return |
| Mon–Sat | any | yes | Generate fresh, cache, return |
| any | DB unavailable | any | Generate fresh (no cache), return |

## UI States

1. **Loading**: `$navigating` shows `<LoadingDots label="Updating plan" />` (already exists)
2. **Cached**: Header shows "generated {timestamp} · cached" with a subtle badge
3. **Fresh**: Header shows "generated {timestamp}" (as today)
4. **Regenerating**: Same as loading (navigation to `?regenerate=true` triggers `$navigating`)

## Not Changing
- `/api/weekly-push/run` push endpoint — always generates fresh for push delivery (runs on cron Monday, not page-load-frequent)
- `buildWeeklyDigest()` pure engine — no changes
