import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCourses = vi.fn();
const getSemesters = vi.fn();

vi.mock('$lib/server/store', () => ({ getCourses, getSemesters }));

describe('calendar event API', () => {
	beforeEach(() => {
		getCourses.mockReset();
		getSemesters.mockReset();
		getCourses.mockResolvedValue([
			{
				id: 'csis-4495-summer-2026',
				semesterId: 'summer-2026',
				code: 'CSIS 4495'
			}
		]);
		getSemesters.mockResolvedValue([{ id: 'summer-2026', term: 'Summer', year: 2026, order: 1 }]);
	});

	it('returns an existing matching event instead of creating a duplicate', async () => {
		const first = vi.fn().mockResolvedValue({ id: 'existing-event' });
		const statement = { bind: vi.fn().mockReturnThis(), first };
		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/calendar/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				courseId: 'csis-4495-summer-2026',
				courseCode: 'CSIS 4495',
				title: 'Project consultation',
				type: 'assignment',
				year: 2026,
				month: 4,
				date: 9
			})
		});
		const response = await POST({
			request,
			platform: { env: { BRIEF_DB: { prepare: vi.fn(() => statement) } } }
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, id: 'existing-event', created: false });
	});

	it('rejects an event year outside the selected course semester', async () => {
		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/calendar/events', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				courseId: 'csis-4495-summer-2026',
				courseCode: 'CSIS 4495',
				title: 'Project consultation',
				type: 'assignment',
				year: 2027,
				month: 4,
				date: 9
			})
		});
		const response = await POST({
			request,
			platform: { env: { BRIEF_DB: {} } }
		} as never);

		expect(response.status).toBe(422);
		expect(await response.json()).toEqual({ error: 'Event date must be in Summer 2026' });
	});
});
