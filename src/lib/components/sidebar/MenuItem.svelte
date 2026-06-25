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

<div class="sidebar-menu-item {className}" role="listitem">
	{@render children()}
</div>

<style>
	:global(.sidebar-menu-item) {
		position: relative;
	}
</style>
