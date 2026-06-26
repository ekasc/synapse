<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let { class: className = '', ...rest }: HTMLTextareaAttributes & { class?: string } = $props();
</script>

<textarea class="ui-textarea {className}" {...rest}></textarea>

<style>
	:global(.ui-textarea) {
		width: 100%;
		min-height: 5rem;
		padding: 0.5rem 0.65rem;
		resize: vertical;
		border: 1px solid rgba(26, 26, 23, 0.28);
		border-radius: 0;
		background: var(--paper);
		transition: border-color 0.15s var(--ease-out-quart), box-shadow 0.15s var(--ease-out-quart);
		color: var(--ink);
		font: inherit;
	}

	:global(.ui-textarea:focus-visible) {
		border-color: var(--ink);
		outline: 2px solid var(--highlight);
		outline-offset: 1px;
		box-shadow: 0 0 0 0 var(--highlight);
	}
</style>
