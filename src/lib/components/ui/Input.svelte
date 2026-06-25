<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(),
		ref = $bindable(),
		class: className = '',
		...rest
	}: HTMLInputAttributes & { class?: string; ref?: HTMLInputElement } = $props();
</script>

<input bind:this={ref} bind:value class="ui-input {className}" {...rest} />

<style>
	:global(.ui-input) {
		width: 100%;
		min-height: 2.5rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid rgba(26, 26, 23, 0.28);
		border-radius: 4px;
		background: #fbf8f0;
		color: var(--ink);
		font: inherit;
	}

	:global(.ui-input:focus-visible) {
		border-color: var(--ink);
		outline: 2px solid var(--highlight);
		outline-offset: 1px;
	}

	:global(.ui-input:disabled) {
		background: rgba(232, 220, 193, 0.45);
		color: var(--ink-soft);
		cursor: not-allowed;
	}
</style>
