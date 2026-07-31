import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCourses = vi.fn();
const getSemesters = vi.fn();
const getSyllabusImport = vi.fn();

vi.mock('$lib/server/store', () => ({ getCourses, getSemesters, getSyllabusImport }));

function createDb(results: { claim?: number; prior?: unknown; inserts?: number[] } = {}) {
	let insert = 0;
	return {
		prepare: vi.fn((sql: string) => ({
			bind: vi.fn().mockReturnThis(),
			run: vi.fn().mockImplementation(() => {
				if (sql.includes('syllabus_calendar_imports'))
					return Promise.resolve({ meta: { changes: results.claim ?? 1 } });
				return Promise.resolve({ meta: { changes: results.inserts?.[insert++] ?? 1 } });
			}),
			first: vi.fn().mockResolvedValue(results.prior ?? null)
		}))
	};
}

describe('syllabus calendar batch import', () => {
	beforeEach(() => {
		getCourses.mockResolvedValue([{ id: 'course-1', semesterId: 'semester-1', code: 'CSIS 4280' }]);
		getSemesters.mockResolvedValue([{ id: 'semester-1', term: 'Fall', year: 2026 }]);
		getSyllabusImport.mockResolvedValue({
			id: 'syllabus-1',
			rawText: 'source content',
			extractedData: {
				dates: [{ label: 'Quiz 1', date: '2026-09-20', type: 'quiz', needsReview: false }]
			}
		});
	});

	it('uses INSERT OR IGNORE for source-key protected calendar rows', async () => {
		const { POST } = await import('./+server');
		const db = createDb();
		const response = await POST({
			request: new Request('http://localhost/api/syllabus/calendar-import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ courseId: 'course-1', idempotencyKey: 'request-1' })
			}),
			platform: { env: { BRIEF_DB: db } },
			locals: { user: { id: 'test-user' } }
		} as never);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ok: true, inserted: 1, unchanged: 0 });
		expect(
			db.prepare.mock.calls.some(([sql]) =>
				String(sql).includes('INSERT OR IGNORE INTO calendar_events')
			)
		).toBe(true);
	});

	it('replays a completed idempotency key without inserting rows again', async () => {
		const prior = {
			id: 'prior-import',
			source_hash: await (async () => {
				const bytes = new TextEncoder().encode('source content');
				const digest = await crypto.subtle.digest('SHA-256', bytes);
				return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
			})(),
			result_json: JSON.stringify({ ok: true, importId: 'prior-import', inserted: 1 })
		};
		const { POST } = await import('./+server');
		const db = createDb({ claim: 0, prior });
		const response = await POST({
			request: new Request('http://localhost/api/syllabus/calendar-import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ courseId: 'course-1', idempotencyKey: 'request-1' })
			}),
			platform: { env: { BRIEF_DB: db } },
			locals: { user: { id: 'test-user' } }
		} as never);
		expect(await response.json()).toMatchObject({ importId: 'prior-import', replayed: true });
		expect(db.prepare.mock.calls.some(([sql]) => String(sql).includes('calendar_events'))).toBe(
			false
		);
	});
});
