import { describe, expect, it, vi } from 'vitest';
import {
	runBoundedBrowserResearch,
	shouldEscalateToBrowser,
	type BoundedBrowserSession
} from './browser-research';

function session(): BoundedBrowserSession {
	return {
		open: vi.fn(),
		snapshot: vi
			.fn()
			.mockResolvedValue({ url: 'https://rmp.test/p/1', title: 'Profile', elements: [] }),
		click: vi.fn(),
		fill: vi.fn(),
		scroll: vi.fn(),
		waitForPageChange: vi.fn(),
		extract: vi.fn().mockResolvedValue({
			url: 'https://rmp.test/p/1',
			title: 'Profile',
			text: 'Visible profile',
			fields: {}
		}),
		close: vi.fn()
	};
}

describe('bounded browser research', () => {
	it('escalates only for missing, partial, or insufficient JS-dependent content', () => {
		expect(
			shouldEscalateToBrowser({
				staticStatus: 'retrieved',
				excerpt: 'x'.repeat(200),
				category: 'catalog'
			})
		).toBe(false);
		expect(
			shouldEscalateToBrowser({ staticStatus: 'partial', excerpt: 'x', category: 'outline' })
		).toBe(true);
		expect(
			shouldEscalateToBrowser({
				staticStatus: 'retrieved',
				excerpt: 'x',
				category: 'rate-my-professors'
			})
		).toBe(true);
	});

	it('enforces domain and action limits and always closes its isolated context', async () => {
		const isolated = session();
		const browser = { createContext: vi.fn().mockResolvedValue(isolated) };
		const result = await runBoundedBrowserResearch({
			browser,
			jobId: 'job-1',
			url: 'https://rmp.test/p/1',
			allowedDomains: ['rmp.test'],
			schema: 'rmp-public-profile',
			operations: Array.from({ length: 13 }, () => ({ type: 'snapshot' as const }))
		});
		expect(result).toMatchObject({
			status: 'unavailable',
			reason: 'Browser action limit reached.'
		});
		expect(isolated.close).toHaveBeenCalledOnce();
	});

	it('rejects unrelated URLs without creating a browser context', async () => {
		const browser = { createContext: vi.fn() };
		const result = await runBoundedBrowserResearch({
			browser,
			jobId: 'job-1',
			url: 'https://unrelated.test',
			allowedDomains: ['rmp.test'],
			schema: 'rmp-public-profile'
		});
		expect(result.status).toBe('unavailable');
		expect(browser.createContext).not.toHaveBeenCalled();
	});
});
