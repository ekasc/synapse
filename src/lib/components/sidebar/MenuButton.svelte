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

	const linkClass = $derived(
		`sidebar-link relative flex cursor-pointer items-center justify-between gap-2 rounded-none border-0 border-l-2 border-l-transparent bg-transparent px-6 py-[0.45rem] text-left font-[var(--font-body)] text-[var(--text-small)] font-medium text-[var(--sidebar-fg)] no-underline hover:border-l-[rgba(245,236,217,0.35)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--sidebar-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] data-[active=true]:border-l-[var(--accent)] data-[active=true]:bg-[rgba(255,255,255,0.06)] data-[active=true]:font-semibold data-[active=true]:text-[var(--sidebar-fg)] ${className}`
	);
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
