import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildPushRequest } = vi.hoisted(() => ({ buildPushRequest: vi.fn() }));

vi.mock('./encryption', () => ({ buildPushRequest }));

import { buildPushPayload, deliverWeeklyDigestPush } from './deliver';
import { buildWeeklyDigest, type WeeklyDigestInput } from '$lib/dashboard/weekly';

const now = new Date(2026, 6, 20, 9, 0, 0);

function baseInput(overrides: Partial<WeeklyDigestInput> = {}): WeeklyDigestInput {
	return {
		now,
		courses: [],
		semesters: [],
		courseGraph: { edges: [] },
		calendarEvents: [],
		practiceSessions: [],
		studySessions: [],
		materials: [],
		materialIndexes: [],
		briefings: [],
		...overrides
	};
}

const digest = buildWeeklyDigest(
	baseInput({
		calendarEvents: [
			{
				id: 'e1',
				courseId: null,
				courseCode: 'CSIS 4495',
				title: 'Milestone 1',
				type: 'assignment',
				date: 17,
				month: 6,
				year: 2026,
				time: null,
				gradeWeight: 25,
				status: 'pending',
				notes: null,
				createdAt: '',
				updatedAt: ''
			}
		]
	})
);

const vapid = { subject: 'mailto:team@synapse.study', privateKey: 'priv', publicKey: 'pub' };
const subscriptions = [
	{ endpoint: 'https://push.example/a', p256dh: 'ka', auth: 'aa' },
	{ endpoint: 'https://push.example/b', p256dh: 'kb', auth: 'ab' }
];

describe('buildPushPayload', () => {
	it('uses the prose when provided and counts overdue deadlines', () => {
		const payload = buildPushPayload(digest, 'Two deadlines this week.');
		expect(payload.title).toBe('Weekly Plan · 2026-07-20 → 2026-07-26');
		expect(payload.body).toBe('Two deadlines this week.');
		expect(payload.url).toBe('/app/weekly');
		expect(payload.overdueCount).toBe(1);
	});

	it('falls back to the top priority reason without prose', () => {
		const payload = buildPushPayload(digest, null);
		expect(payload.body).toContain('Review CSIS 4495 because Milestone 1 was due 3 days ago');
	});
});

describe('deliverWeeklyDigestPush', () => {
	beforeEach(() => vi.clearAllMocks());

	it('delivers to healthy endpoints and prunes expired ones', async () => {
		buildPushRequest.mockImplementation(async (input: { subscription: { endpoint: string } }) => ({
			url: input.subscription.endpoint,
			init: { method: 'POST' }
		}));
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, status: 201 })
			.mockResolvedValueOnce({ ok: false, status: 410 });
		const summary = await deliverWeeklyDigestPush({
			digest,
			prose: null,
			subscriptions,
			vapid,
			nowSeconds: 1784000000,
			fetchImpl: fetchImpl as unknown as typeof fetch
		});
		expect(summary).toEqual({
			attempted: 2,
			delivered: 1,
			failed: 0,
			prunedEndpoints: ['https://push.example/b']
		});
		expect(buildPushRequest).toHaveBeenCalledTimes(2);
		const firstCall = buildPushRequest.mock.calls[0][0];
		expect(firstCall.topic).toBe('weekly-2026-07-20');
		expect(firstCall.vapid).toEqual(vapid);
		expect(JSON.parse(firstCall.payload).url).toBe('/app/weekly');
		expect(fetchImpl).toHaveBeenCalledWith('https://push.example/a', { method: 'POST' });
	});

	it('counts network failures without pruning', async () => {
		buildPushRequest.mockResolvedValue({ url: 'https://push.example/a', init: {} });
		const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
		const summary = await deliverWeeklyDigestPush({
			digest,
			prose: null,
			subscriptions: [subscriptions[0]],
			vapid,
			nowSeconds: 1784000000,
			fetchImpl: fetchImpl as unknown as typeof fetch
		});
		expect(summary).toEqual({ attempted: 1, delivered: 0, failed: 1, prunedEndpoints: [] });
	});

	it('does nothing for an empty subscription list', async () => {
		const summary = await deliverWeeklyDigestPush({
			digest,
			prose: null,
			subscriptions: [],
			vapid,
			nowSeconds: 1784000000,
			fetchImpl: vi.fn() as unknown as typeof fetch
		});
		expect(summary.attempted).toBe(0);
		expect(buildPushRequest).not.toHaveBeenCalled();
	});
});
