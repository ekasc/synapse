import { describe, expect, it, vi } from 'vitest';
import { completePastCalendarEvents } from './complete-past-events';

describe('completePastCalendarEvents', () => {
	it('updates incomplete events before the UTC cutoff', async () => {
		const run = vi.fn().mockResolvedValue({ meta: { changes: 3 } });
		const bind = vi.fn().mockReturnValue({ run });
		const prepare = vi.fn().mockReturnValue({ bind });
		const binding = { prepare } as unknown as D1Database;
		const now = new Date('2026-07-26T14:35:20.000Z');

		await expect(completePastCalendarEvents(binding, 'user-1', now)).resolves.toBe(3);
		expect(prepare).toHaveBeenCalledWith(expect.stringContaining("SET status = 'completed'"));
		expect(prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'));
		expect(prepare).toHaveBeenCalledWith(
			expect.stringContaining("COALESCE(status, 'pending') <> 'completed'")
		);
		expect(bind).toHaveBeenCalledWith(
			'2026-07-26T14:35:20.000Z',
			'user-1',
			2026,
			2026,
			6,
			2026,
			6,
			26,
			2026,
			6,
			26,
			'14:35'
		);
	});
});
