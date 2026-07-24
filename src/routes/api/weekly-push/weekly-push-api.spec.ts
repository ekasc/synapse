import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------
const mockUpsert = vi.fn();
const mockRemoveByEndpoint = vi.fn();
const createWeeklyPushRepository = vi.fn(() => ({
	upsert: mockUpsert,
	removeByEndpoint: mockRemoveByEndpoint
}));

vi.mock('$lib/server/push/subscriptions', () => ({
	createWeeklyPushRepository
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock SvelteKit RequestEvent for a POST endpoint.
 *
 * @param body          – value to JSON.stringify as the request body
 * @param hasBinding    – when false, the event will have no platform at all (triggers 503)
 * @param platformEnv   – additional env vars placed on event.platform.env
 */
function mockPostEvent(
	body: unknown = undefined,
	hasBinding: boolean,
	platformEnv: Record<string, string> = {}
) {
	const platform: Record<string, unknown> | undefined = hasBinding
		? { env: { BRIEF_DB: {}, ...platformEnv } }
		: undefined;

	return {
		request: new Request('http://localhost/api/weekly-push/subscribe', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body !== undefined ? JSON.stringify(body) : undefined
		}),
		platform
	} as never;
}

const VALID_SUB = {
	endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
	keys: {
		p256dh: 'BPWqTfLxPzM6yJ8kR2vN4sD7hA0bC1dE3fG5iO9',
		auth: 'kR2vN4sD7hA0bC1dE='
	}
};

// ---------------------------------------------------------------------------
// Subscribe POST
// ---------------------------------------------------------------------------
describe('weekly-push subscribe POST', () => {
	beforeEach(() => {
		createWeeklyPushRepository.mockClear();
		mockUpsert.mockReset();
		mockRemoveByEndpoint.mockReset();
	});

	it('returns 503 when BRIEF_DB binding is missing', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent(VALID_SUB, false);

		const response = await POST(event);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'database unavailable' });
	});

	it('returns 400 for invalid JSON body', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = {
			request: new Request('http://localhost/api/weekly-push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: 'not-json'
			}),
			platform: { env: { BRIEF_DB: {} } }
		} as never;

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'invalid json' });
	});

	it('returns 400 when endpoint is missing', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent({ keys: { p256dh: 'x', auth: 'y' } }, true);

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'endpoint, keys.p256dh, and keys.auth are required'
		});
	});

	it('returns 400 when keys.p256dh is missing', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent(
			{ endpoint: 'https://example.com', keys: { auth: 'y' } },
			true
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('returns 400 when keys.auth is missing', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent(
			{ endpoint: 'https://example.com', keys: { p256dh: 'x' } },
			true
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('returns 400 when endpoint is an empty string', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent(
			{ endpoint: '', keys: { p256dh: 'x', auth: 'y' } },
			true
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
	});

	it('returns 400 when endpoint exceeds 2048 characters', async () => {
		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent(
			{
				endpoint: 'x'.repeat(2049),
				keys: { p256dh: 'x', auth: 'y' }
			},
			true
		);

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'endpoint, keys.p256dh, and keys.auth are required'
		});
	});

	it('returns ok:true with id on valid subscription', async () => {
		mockUpsert.mockResolvedValue({
			id: 'sub-001',
			endpoint: VALID_SUB.endpoint,
			p256dh: VALID_SUB.keys.p256dh,
			auth: VALID_SUB.keys.auth,
			createdAt: '2025-01-01T00:00:00.000Z'
		});

		const { POST } = await import('./subscribe/+server');
		const event = mockPostEvent(VALID_SUB, true);

		const response = await POST(event);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, id: 'sub-001' });
		expect(createWeeklyPushRepository).toHaveBeenCalledWith({});
		expect(mockUpsert).toHaveBeenCalledWith({
			endpoint: VALID_SUB.endpoint,
			p256dh: VALID_SUB.keys.p256dh,
			auth: VALID_SUB.keys.auth
		});
	});
});

// ---------------------------------------------------------------------------
// Unsubscribe POST
// ---------------------------------------------------------------------------
describe('weekly-push unsubscribe POST', () => {
	beforeEach(() => {
		createWeeklyPushRepository.mockClear();
		mockUpsert.mockReset();
		mockRemoveByEndpoint.mockReset();
	});

	it('returns 503 when BRIEF_DB binding is missing', async () => {
		const { POST } = await import('./unsubscribe/+server');
		const event = mockPostEvent({ endpoint: 'https://example.com' }, false);

		const response = await POST(event);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'database unavailable' });
	});

	it('returns 400 for invalid JSON body', async () => {
		const { POST } = await import('./unsubscribe/+server');
		const event = {
			request: new Request('http://localhost/api/weekly-push/unsubscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{bad'
			}),
			platform: { env: { BRIEF_DB: {} } }
		} as never;

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'invalid json' });
	});

	it('returns 400 when endpoint is missing', async () => {
		const { POST } = await import('./unsubscribe/+server');
		const event = mockPostEvent({}, true);

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'endpoint is required' });
	});

	it('returns 400 when endpoint is an empty string', async () => {
		const { POST } = await import('./unsubscribe/+server');
		const event = mockPostEvent({ endpoint: '' }, true);

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'endpoint is required' });
	});

	it('returns 400 when endpoint exceeds 2048 characters', async () => {
		const { POST } = await import('./unsubscribe/+server');
		const event = mockPostEvent({ endpoint: 'x'.repeat(2049) }, true);

		const response = await POST(event);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'endpoint is required' });
	});

	it('returns ok:true on valid unsubscription', async () => {
		mockRemoveByEndpoint.mockResolvedValue(undefined);

		const { POST } = await import('./unsubscribe/+server');
		const event = mockPostEvent({ endpoint: 'https://example.com' }, true);

		const response = await POST(event);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(createWeeklyPushRepository).toHaveBeenCalledWith({});
		expect(mockRemoveByEndpoint).toHaveBeenCalledWith('https://example.com');
	});
});

// ---------------------------------------------------------------------------
// Vapid GET
// ---------------------------------------------------------------------------
describe('weekly-push vapid GET', () => {
	it('returns publicKey:"" and configured:false when VAPID_PUBLIC_KEY is not set', async () => {
		const { GET } = await import('./vapid/+server');
		const event = { platform: { env: {} } } as never;

		const response = await GET(event);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ publicKey: '', configured: false });
	});

	it('returns publicKey:"" and configured:false when platform is undefined', async () => {
		const { GET } = await import('./vapid/+server');
		const event = {} as never;

		const response = await GET(event);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ publicKey: '', configured: false });
	});

	it('returns the key and configured:true when VAPID_PUBLIC_KEY is set', async () => {
		const { GET } = await import('./vapid/+server');
		const event = {
			platform: { env: { VAPID_PUBLIC_KEY: 'BPWqTfLxPzM6yJ8kR2vN4sD7hA0bC1dE3fG5iO9' } }
		} as never;

		const response = await GET(event);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			publicKey: 'BPWqTfLxPzM6yJ8kR2vN4sD7hA0bC1dE3fG5iO9',
			configured: true
		});
	});
});
