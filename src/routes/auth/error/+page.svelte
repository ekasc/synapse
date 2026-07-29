<script lang="ts">
	import { page } from '$app/stores';

	const reason = $derived($page.url.searchParams.get('reason') ?? 'unknown');

	const messages: Record<string, string> = {
		access_denied: 'Sign-in was cancelled or denied.',
		invalid_state: 'Sign-in expired. Please try again.',
		exchange_failed: 'Could not complete sign-in. Please try again.',
		missing_code: 'No authorization code received.',
		config_error: 'Authentication is not configured.',
		unauthenticated: 'Please sign in to access this page.'
	};

	const message = $derived(messages[reason] ?? 'An unexpected error occurred.');
</script>

<div class="error-page">
	<div class="error-card">
		<h1>Authentication Error</h1>
		<p class="error-message">{message}</p>
		<div class="error-actions">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="/auth/login">Sign in</a>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="/">Go home</a>
		</div>
	</div>
</div>

<style>
	.error-page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: var(--paper, #fbf8f0);
		padding: 2rem;
	}
	.error-card {
		max-width: 28rem;
		text-align: center;
		padding: 3rem 2rem;
		border: 1px solid var(--rule, #e0d8c8);
		background: var(--paper, #fbf8f0);
	}
	h1 {
		font-family: var(--font-body, serif);
		font-size: 2rem;
		margin: 0 0 1rem;
		color: var(--ink, #1a1a17);
	}
	.error-message {
		color: var(--ink-soft, #6b6559);
		margin: 0 0 2rem;
		line-height: 1.5;
	}
	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}
	a {
		padding: 0.6rem 1.5rem;
		text-decoration: none;
		font-family: var(--font-body);
		font-size: var(--text-caption);
		background: var(--ink, #1a1a17);
		color: var(--paper, #fbf8f0);
		border: 1px solid var(--ink, #1a1a17);
		cursor: pointer;
	}
	a:last-child {
		background: transparent;
		color: var(--ink, #1a1a17);
	}
</style>
