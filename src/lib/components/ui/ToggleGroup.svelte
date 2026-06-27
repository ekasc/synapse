<script lang="ts">
	import { ToggleGroup } from 'bits-ui';

	type Item = { value: string; label: string; disabled?: boolean };

	let {
		value = $bindable(''),
		items,
		ariaLabel,
		onValueChange,
		class: className = ''
	}: {
		value?: string;
		items: Item[];
		ariaLabel: string;
		onValueChange?: (value: string) => void;
		class?: string;
	} = $props();
</script>

<ToggleGroup.Root
	type="single"
	bind:value
	{onValueChange}
	orientation="horizontal"
	loop
	class="ui-toggle-group {className}"
	aria-label={ariaLabel}
>
	{#each items as item (item.value)}
		<ToggleGroup.Item value={item.value} disabled={item.disabled} class="ui-toggle-group-item">
			{item.label}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.ui-toggle-group) {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	:global(.ui-toggle-group-item) {
		min-height: 2.25rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--rule);
		transition: transform 0.1s var(--ease-out-quart);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.12s var(--ease-out-quart),
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}

	:global(.ui-toggle-group-item:hover) {
		border-color: var(--ink);
		color: var(--ink);
	}

	:global(.ui-toggle-group-item[data-state='on']) {
		border-color: var(--ink);
		background: var(--highlight);
		color: var(--ink);
	}

	:global(.ui-toggle-group-item:active) {
		transform: translateY(1px);
	}

	:global(.ui-toggle-group-item:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
