import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EmptyState from './EmptyState.svelte';

test('renders the empty-state message and example', async () => {
	const screen = render(EmptyState);
	await expect.element(screen.getByText('Your notebook is empty.')).toBeInTheDocument();
	await expect
		.element(screen.getByText('Research a course to start your first brief.'))
		.toBeInTheDocument();
	await expect.element(screen.getByText('e.g. CSIS 3375')).toBeInTheDocument();
});
