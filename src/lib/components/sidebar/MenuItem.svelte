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

<div class="sidebar-menu-item relative {className}" role="listitem">
	{@render children()}
</div>
