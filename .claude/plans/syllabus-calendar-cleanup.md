# Prevent old and duplicate syllabus calendar events

## Diagnosis
The current result page sends every extracted date through the generic single-event endpoint. The endpoint has an exact duplicate query, but:
- the client counts an existing event as successfully added because it ignores `created: false`;
- duplicate detection is case/punctuation sensitive;
- repeated rows inside extraction are still requested individually;
- old semester dates are imported as long as they match the semester year;
- there is no batch summary distinguishing added, duplicate, old, invalid, and failed dates.

## Implementation

1. **Create a pure syllabus calendar preparation utility**
   - Extend `src/lib/calendar/syllabus-sync.ts` with:
     - title normalization (Unicode normalization, lowercase, whitespace/punctuation normalization);
     - canonical fingerprint from course ID, normalized title, type, calendar date, and time;
     - date comparison using local calendar dates;
     - batch preparation that parses extracted rows, resolves the semester year, skips dates before today, and removes duplicates within the syllabus payload.
   - Keep same-title events on different dates or with different types distinct.

2. **Harden server duplicate detection**
   - Normalize title comparisons in `POST /api/calendar/events` so harmless capitalization/spacing/punctuation differences do not create duplicates.
   - Return explicit outcomes: `created: true` for new rows and `created: false, reason: 'duplicate'` for existing rows.
   - Keep course ID, type, date, and time in the duplicate identity so legitimate recurring events remain distinct.
   - Do not delete existing events or modify manual events.

3. **Filter and summarize in the syllabus result page**
   - Prepare the batch before making requests.
   - Default policy: skip dates strictly before today; accept today and future dates.
   - Send each unique upcoming item once.
   - Track `added`, `duplicates`, `old`, `invalid`, and `failed` separately.
   - Only navigate/refresh when at least one event is newly added.
   - Update UI copy so it no longer promises that every extracted date will be pushed.

4. **Tests**
   - Unit tests for title normalization and fingerprints.
   - Unit tests for old/today/future filtering and duplicate rows in one syllabus.
   - Endpoint tests for case/spacing/punctuation duplicates and legitimate same-title events on different dates.
   - Preserve existing semester-year and course-identity validation tests.

5. **Validation**
   - Run focused syllabus-sync and calendar endpoint tests, focused lint, and production build.
