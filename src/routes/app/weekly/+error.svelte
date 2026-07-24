<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';

	function navigate(href: string) {
		if (!href.startsWith('/app/') || href.startsWith('//')) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}
</script>

{#if $navigating}
	<div class="loading">
		<LoadingDots label="Loading" />
	</div>
{/if}

<div class="weekly-error">
	<p class="error-head">The plan could not be built.</p>
	<p class="error-text">
		Something went wrong while reading your academic data. Your courses and deadlines are safe — try
		again in a moment.
	</p>
	<div class="error-actions">
		<button class="btn btn-primary btn-sm" onclick={() => window.location.reload()}
			>Try again</button
		>
		<button class="btn btn-ghost btn-sm" onclick={() => navigate('/app')}>Back to dashboard</button>
	</div>
</div>

<style>
	.loading {
		display: flex;
		align-items: center;
		padding: 0.5rem 0;
	}

	.weekly-error {
		max-width: 34rem;
		margin: 4rem auto;
		padding: 2rem;
		border: 1px dashed var(--rule);
		background: var(--paper);
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		text-align: center;
	}
	.error-head {
		margin: 0;
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.6rem;
		color: var(--pen-red);
	}
	.error-text {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--ink-soft);
	}
	.error-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
</style>
