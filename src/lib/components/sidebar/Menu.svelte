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

<div class="sidebar-menu flex min-h-0 flex-col gap-0 p-0 {className}" role="list">
	{@render children()}
</div>
