<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		isActive = false,
		href,
		onclick,
		disabled = false,
		ariaLabel,
		class: className = '',
		children
	}: {
		isActive?: boolean;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		ariaLabel?: string;
		class?: string;
		children: Snippet;
	} = $props();

	const linkClass = $derived(`sidebar-link ${className}`);
	const dataActive = $derived(isActive ? 'true' : undefined);
	const ariaCurrent = $derived(isActive ? ('page' as const) : undefined);
</script>

{#if href}
	<a
		class={linkClass}
		data-active={dataActive}
		aria-current={ariaCurrent}
		aria-label={ariaLabel}
		{href}
		{onclick}
	>
		{@render children()}
	</a>
{:else}
	<button
		type="button"
		class={linkClass}
		data-active={dataActive}
		aria-current={ariaCurrent}
		aria-label={ariaLabel}
		{disabled}
		{onclick}
	>
		{@render children()}
	</button>
{/if}

<style>
	:global(.sidebar-link) {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.375rem 1.25rem;
		border: none;
		border-left: 2px solid transparent;
		border-radius: 0;
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--ink-soft);
		text-decoration: none;
		text-align: left;
		cursor: pointer;
		background: transparent;
	}

	:global(.sidebar-link:hover) {
		color: var(--ink);
		background: var(--paper);
		border-left-color: var(--ink);
	}

	:global(.sidebar-link:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	:global(.sidebar-link[data-active='true']) {
		color: var(--ink);
		background: var(--paper);
		border-left-color: var(--accent);
		font-weight: 600;
	}
</style>
