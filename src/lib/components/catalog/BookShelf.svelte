<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		single?: boolean;
		children: Snippet;
	}

	let { single = false, children }: Props = $props();
</script>

<div class="shelf" class:shelf-single={single}>
	{@render children()}
</div>
