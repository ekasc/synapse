import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EmptyState from './EmptyState.svelte';

test('renders the empty-state message and action', async () => {
	const screen = render(EmptyState);
	await expect.element(screen.getByText('No briefs yet.')).toBeInTheDocument();
	await expect
		.element(screen.getByText('Research a course to start your first brief.'))
		.toBeInTheDocument();
});
