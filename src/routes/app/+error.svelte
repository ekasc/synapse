<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import { page } from '$app/stores';

	let { error } = $props<{ error: Error & { status?: number } }>();
</script>

<svelte:head><title>Something went wrong · Synapse</title></svelte:head>

<div class="route-error" role="alert">
	<div class="route-error-mark" aria-hidden="true">
		<AlertTriangle class="size-6" />
	</div>
	<h1>Something went wrong.</h1>
	<p>
		{#if $page.status === 404}
			We couldn't find that page. Check the URL or return to your dashboard.
		{:else}
			Your data is safe. Try again, or return to the dashboard if the problem continues.
		{/if}
	</p>
	{#if error?.message && $page.status !== 404}
		<p class="route-error-detail">{error.message}</p>
	{/if}
	<div class="route-error-actions">
		<button class="btn btn-primary btn-sm" onclick={() => window.location.reload()}
			>Try again</button
		>
		<a class="btn btn-ghost btn-sm" href="/app">Back to dashboard</a>
	</div>
</div>

<style>
	.route-error {
		max-width: 32rem;
		margin: 4rem auto;
		padding: 2rem;
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		text-align: center;
		border: 1px dashed var(--rule);
		background: var(--paper);
	}
	.route-error h1 {
		margin: 0;
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.6rem;
		color: var(--pen-red);
	}
	.route-error p {
		margin: 0;
		font-size: var(--text-small);
		line-height: 1.55;
		color: var(--ink-soft);
	}
	.route-error-mark {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 1px solid var(--ink);
		color: var(--ink);
	}
	.route-error-detail {
		font-size: var(--text-caption);
		color: var(--ink-faint);
		word-break: break-word;
	}
	.route-error-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
</style>
