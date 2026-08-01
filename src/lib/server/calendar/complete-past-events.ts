const COMPLETE_PAST_EVENTS_SQL = `UPDATE calendar_events
SET status = 'completed', updated_at = ?
WHERE user_id = ?
  AND COALESCE(status, 'pending') <> 'completed'
  AND (
    year < ?
    OR (year = ? AND month < ?)
    OR (year = ? AND month = ? AND date < ?)
    OR (
      year = ? AND month = ? AND date = ?
      AND time IS NOT NULL AND time <> '' AND time < ?
    )
  )`;

export async function completePastCalendarEvents(
	binding: D1Database,
	userId: string,
	now = new Date()
): Promise<number> {
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();
	const date = now.getUTCDate();
	const time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
	const updatedAt = now.toISOString();

	const result = await binding
		.prepare(COMPLETE_PAST_EVENTS_SQL)
		.bind(updatedAt, userId, year, year, month, year, month, date, year, month, date, time)
		.run();

	return result.meta.changes ?? 0;
}
