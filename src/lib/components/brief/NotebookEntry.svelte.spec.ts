import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotebookEntry from './NotebookEntry.svelte';
import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

const baseBrief = {
	courseCode: 'CSIS 3375',
	title: 'CSIS 3375 — Data Mining',
	institution: 'University of the Fraser Valley',
	researchedAt: '2025-03-12T14:22:00.000Z',
	professor: { requestedName: 'Prof. Smith', currentListedInstructor: null },
	studentReviews: { rating: 4.2, ratingCount: 42, wouldTakeAgainPercent: 78, present: true },
	sources: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }, { id: '7' }, { id: '8' }],
	offerings: { current: { term: 'Spring 2026', instructor: { name: 'Prof. Smith' } } }
} as unknown as BriefingDetailViewModel;

test('renders code, title, and RMP chip', async () => {
	const screen = render(NotebookEntry, { brief: baseBrief });
	await expect.element(screen.getByText('CSIS 3375').first()).toBeInTheDocument();
	await expect.element(screen.getByText('Data Mining')).toBeInTheDocument();
	await expect.element(screen.getByText('4.2 / 5')).toBeInTheDocument();
});

test('links to the detail route', async () => {
	const screen = render(NotebookEntry, { brief: baseBrief });
	const link = screen.container.querySelector('a.entry');
	expect(link?.getAttribute('href')).toBe('/app/brief/CSIS%203375');
});

test('renders N/A chip when no RMP rating is available', async () => {
	const noRmp = { ...baseBrief, studentReviews: null } as unknown as BriefingDetailViewModel;
	const screen = render(NotebookEntry, { brief: noRmp });
	await expect.element(screen.getByText('N/A')).toBeInTheDocument();
});

test('uses a crit color variant when RMP is below 3', async () => {
	const lowRmp = {
		...baseBrief,
		studentReviews: { rating: 2.1, ratingCount: 10, wouldTakeAgainPercent: 30, present: true }
	} as unknown as BriefingDetailViewModel;
	const screen = render(NotebookEntry, { brief: lowRmp });
	const chip = screen.container.querySelector('.rmp.rmp-crit');
	expect(chip?.textContent?.trim()).toBe('2.1 / 5');
});
