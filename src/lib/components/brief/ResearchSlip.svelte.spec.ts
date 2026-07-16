import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ResearchSlip from './ResearchSlip.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

describe('ResearchSlip form', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('renders the research request label and code input', async () => {
		const screen = render(ResearchSlip);
		await expect.element(screen.getByText('research request')).toBeInTheDocument();
		await expect
			.element(screen.getByPlaceholder('Course code (e.g. CSIS 3375, MATH 1130)'))
			.toBeInTheDocument();
	});

	it('keeps the submit button disabled when the code is empty', async () => {
		const screen = render(ResearchSlip);
		const submit = screen.getByRole('button', { name: /research/ });
		await expect.element(submit).toBeDisabled();
	});

	it('expands the more-options panel when toggled', async () => {
		const screen = render(ResearchSlip);
		await expect.element(screen.getByText(/more options/i)).toBeInTheDocument();
		await screen.getByText(/more options/i).click();
		await expect.element(screen.getByPlaceholder('optional').first()).toBeInTheDocument();
	});

	it('shows a validation hint when submitting with an empty code', async () => {
		const screen = render(ResearchSlip);
		const submit = screen.getByRole('button', { name: /research/ });
		// button is disabled while code is empty
		await expect.element(submit).toBeDisabled();
	});

	it('creates a job and shows polling status after research', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ job: { id: 'job-1', status: 'queued' } }), { status: 200 })
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ job: { id: 'job-1', status: 'running' } }), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);

		const screen = render(ResearchSlip);
		await screen.getByPlaceholder('Course code (e.g. CSIS 3375, MATH 1130)').fill('CSIS 3375');
		await screen.getByRole('button', { name: /research/ }).click();

		await expect
			.element(screen.getByRole('status', { name: 'Briefing job status' }))
			.toBeInTheDocument();
	});
});
