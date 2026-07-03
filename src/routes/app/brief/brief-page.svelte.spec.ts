import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn().mockResolvedValue(undefined)
}));

const baseData = {
	briefs: [] as never[],
	defaultModel: 'deepseek/deepseek-v4-flash'
};

const makeJob = (status: string, output: unknown = null, errorMessage: string | null = null) => ({
	id: 'job-1',
	status,
	output,
	errorMessage
});

describe('brief page polling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('renders the research form on initial load', async () => {
		const screen = render(Page, { data: baseData });
		await expect
			.element(screen.getByPlaceholder('Course code (e.g. CSIS 3375, MATH 1130)'))
			.toBeInTheDocument();
	});

	it('creates a job and shows polling status after research', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ job: makeJob('queued') }), { status: 200 })
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ job: makeJob('running') }), { status: 200 })
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						job: makeJob('succeeded'),
						output: { code: 'CSIS 3375' }
					}),
					{ status: 200 }
				)
			);
		vi.stubGlobal('fetch', fetchMock);

		const screen = render(Page, { data: baseData });
		await screen.getByPlaceholder('Course code (e.g. CSIS 3375, MATH 1130)').fill('CSIS 3375');
		await screen.getByRole('button', { name: 'research' }).click();

		await expect
			.element(screen.getByText(/waiting for worker|checking syllabus|gathering sources/))
			.toBeInTheDocument();
	});

	it('surfaces a timeout and retry button after 2 minutes of polling', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ job: makeJob('running') }), { status: 200 })
			)
			.mockResolvedValue(
				new Response(JSON.stringify({ job: makeJob('running') }), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);

		const screen = render(Page, { data: baseData });
		await screen.getByPlaceholder('Course code (e.g. CSIS 3375, MATH 1130)').fill('CSIS 3375');
		await screen.getByRole('button', { name: 'research' }).click();

		await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 2_000);

		await expect
			.element(screen.getByText(/Polling timed out|taking longer than expected/))
			.toBeInTheDocument();
	});
});
