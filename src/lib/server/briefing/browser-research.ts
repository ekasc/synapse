import { canonicalizeHttpUrl } from './evidence';

export const BROWSER_RESEARCH_LIMITS = {
	maxActions: 12,
	maxScrolls: 4,
	maxTabs: 1,
	maxDurationMs: 45_000
} as const;

export type BrowserSnapshot = {
	url: string;
	title: string;
	elements: Array<{ ref: string; role: string; name: string }>;
};

export type BrowserExtract = {
	url: string;
	title: string;
	text: string;
	fields: Record<string, string | number | string[] | null>;
};

/** Deliberately narrower than Playwright. Models never receive this capability. */
export type BoundedBrowserSession = {
	open(url: string): Promise<void>;
	snapshot(): Promise<BrowserSnapshot>;
	click(ref: string): Promise<void>;
	fill(ref: string, value: string): Promise<void>;
	scroll(direction: 'down' | 'up'): Promise<void>;
	waitForPageChange(): Promise<void>;
	extract(schema: string): Promise<BrowserExtract>;
	close(): Promise<void>;
};

/** Browser Run and local Playwright adapters both implement this factory. */
export type BrowserResearch = {
	createContext(input: { jobId: string; signal: AbortSignal }): Promise<BoundedBrowserSession>;
};

export type BrowserOperation =
	| { type: 'snapshot' }
	| { type: 'click'; ref: string }
	| { type: 'fill'; ref: string; value: string }
	| { type: 'scroll'; direction: 'down' | 'up' }
	| { type: 'wait' };

export type BrowserResearchResult =
	| { status: 'retrieved'; extraction: BrowserExtract; snapshot: BrowserSnapshot }
	| { status: 'unavailable'; reason: string };

export function shouldEscalateToBrowser(input: {
	staticStatus: 'retrieved' | 'partial' | 'unavailable';
	excerpt: string;
	category: 'rate-my-professors' | 'outline' | 'schedule' | 'catalog';
}): boolean {
	if (input.staticStatus === 'unavailable') return true;
	if (input.category === 'rate-my-professors') return input.excerpt.trim().length < 120;
	return input.staticStatus === 'partial' || input.excerpt.trim().length < 120;
}

function allowedUrl(value: string, allowedDomains: ReadonlySet<string>): string | null {
	const url = canonicalizeHttpUrl(value);
	if (!url) return null;
	const host = new URL(url).hostname;
	return [...allowedDomains].some((domain) => host === domain || host.endsWith(`.${domain}`))
		? url
		: null;
}

export async function runBoundedBrowserResearch(input: {
	browser: BrowserResearch;
	jobId: string;
	url: string;
	allowedDomains: Iterable<string>;
	schema: string;
	operations?: BrowserOperation[];
	signal?: AbortSignal;
	now?: () => number;
	limits?: Partial<typeof BROWSER_RESEARCH_LIMITS>;
}): Promise<BrowserResearchResult> {
	const limits = { ...BROWSER_RESEARCH_LIMITS, ...input.limits };
	const allowedDomains = new Set([...input.allowedDomains].map((domain) => domain.toLowerCase()));
	const url = allowedUrl(input.url, allowedDomains);
	if (!url)
		return { status: 'unavailable', reason: 'Browser URL is not an approved relevant domain.' };
	const controller = new AbortController();
	const abort = () => controller.abort();
	input.signal?.addEventListener('abort', abort, { once: true });
	const now = input.now ?? Date.now;
	const started = now();
	let session: BoundedBrowserSession | undefined;
	let actions = 0;
	let scrolls = 0;
	try {
		session = await input.browser.createContext({ jobId: input.jobId, signal: controller.signal });
		await session.open(url);
		let snapshot = await session.snapshot();
		for (const operation of input.operations ?? []) {
			if (controller.signal.aborted || now() - started > limits.maxDurationMs)
				return { status: 'unavailable', reason: 'Browser research timed out.' };
			if (++actions > limits.maxActions)
				return { status: 'unavailable', reason: 'Browser action limit reached.' };
			if (operation.type === 'snapshot') snapshot = await session.snapshot();
			if (operation.type === 'click') await session.click(operation.ref);
			if (operation.type === 'fill') await session.fill(operation.ref, operation.value);
			if (operation.type === 'scroll') {
				if (++scrolls > limits.maxScrolls)
					return { status: 'unavailable', reason: 'Browser scroll limit reached.' };
				await session.scroll(operation.direction);
			}
			if (operation.type === 'wait') await session.waitForPageChange();
		}
		const extraction = await session.extract(input.schema);
		if (!allowedUrl(extraction.url, allowedDomains))
			return { status: 'unavailable', reason: 'Browser navigated outside approved domains.' };
		return { status: 'retrieved', extraction, snapshot };
	} catch {
		return { status: 'unavailable', reason: 'Browser retrieval was unavailable.' };
	} finally {
		input.signal?.removeEventListener('abort', abort);
		if (session) await Promise.resolve(session.close()).catch(() => undefined);
	}
}

/**
 * Production adapter seam for Cloudflare Browser Run. The transport owns the
 * Browser Run API/Playwright connection; Synapse only exposes bounded methods.
 */
export function createCloudflareBrowserRunResearch(input: {
	createIsolatedSession: (jobId: string, signal: AbortSignal) => Promise<BoundedBrowserSession>;
}): BrowserResearch {
	return { createContext: ({ jobId, signal }) => input.createIsolatedSession(jobId, signal) };
}

/** Local Playwright can use the identical bounded-session contract in development. */
export function createLocalPlaywrightResearch(input: {
	createIsolatedSession: (jobId: string, signal: AbortSignal) => Promise<BoundedBrowserSession>;
}): BrowserResearch {
	return { createContext: ({ jobId, signal }) => input.createIsolatedSession(jobId, signal) };
}
