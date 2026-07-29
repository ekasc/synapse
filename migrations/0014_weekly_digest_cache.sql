CREATE TABLE weekly_digest_cache (
  week_start TEXT PRIMARY KEY,   -- e.g. '2026-07-20' (Monday of the week)
  digest_json TEXT NOT NULL,     -- JSON blob of WeeklyDigestBundle
  created_at TEXT NOT NULL
);
