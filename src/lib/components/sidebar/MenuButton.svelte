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
		display: grid;
		grid-template-columns: 1.1rem minmax(0, 1fr);
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid transparent;
		border-radius: 0;
		font-family: var(--font-body);
		font-size: 0.85rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: var(--ink-soft);
		text-decoration: none;
		text-align: left;
		cursor: pointer;
		background: transparent;
		transition:
			color 0.12s var(--ease-out-quart),
			background 0.12s var(--ease-out-quart),
			border-color 0.12s var(--ease-out-quart);
	}

	:global(.sidebar-link:hover) {
		color: var(--ink);
		background: rgba(26, 26, 23, 0.04);
	}

	:global(.sidebar-link:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	:global(.sidebar-link[data-active='true']) {
		color: var(--ink);
		background: var(--highlight);
		mix-blend-mode: multiply;
		border-color: rgba(26, 26, 23, 0.14);
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.sidebar-link) {
			transition: none;
		}
	}
</style>
