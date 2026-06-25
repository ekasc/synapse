<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div class="sidebar-menu {className}" role="list">
	{@render children()}
</div>

<style>
	:global(.sidebar-menu) {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		min-height: 0;
	}
</style>
