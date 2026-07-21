<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';

	function navigate(href: string) {
		if (!href.startsWith('/app/') || href.startsWith('//')) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}
</script>

{#if $navigating}
	<div class="loading" aria-live="polite" role="status">
		<span></span><span></span><span></span>
		<em>loading</em>
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
		gap: 0.35rem;
		padding: 0.5rem 2rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.loading span {
		width: 0.3rem;
		height: 0.3rem;
		background: var(--ink-faint);
	}
	.loading em {
		font-style: normal;
		margin-left: 0.3rem;
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
