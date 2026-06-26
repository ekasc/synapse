<script lang="ts">
	import { Toolbar } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		label,
		class: className = '',
		children
	}: { label: string; class?: string; children: Snippet } = $props();
</script>

<Toolbar.Root class="ui-toolbar {className}" aria-label={label}>
	{@render children()}
</Toolbar.Root>

<style>
	:global(.ui-toolbar) {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	:global(.ui-toolbar > *) {
		transition: opacity 0.12s var(--ease-out-quart);
	}

	:global(.ui-toolbar > *:hover) {
		opacity: 0.7;
	}
</style>
