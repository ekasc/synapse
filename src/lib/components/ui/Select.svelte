<script lang="ts">
	import { Select } from 'bits-ui';

	type Option = { value: string; label: string; disabled?: boolean };

	let {
		value = $bindable(''),
		options,
		placeholder = 'Select…',
		disabled = false,
		ariaLabel,
		onValueChange,
		class: className = ''
	}: {
		value?: string;
		options: Option[];
		placeholder?: string;
		disabled?: boolean;
		ariaLabel?: string;
		onValueChange?: (value: string) => void;
		class?: string;
	} = $props();

	const selectedLabel = $derived(
		options.find((option) => option.value === value)?.label ?? placeholder
	);
</script>

<Select.Root type="single" bind:value items={options} {disabled} {onValueChange}>
	<Select.Trigger class="ui-select-trigger {className}" aria-label={ariaLabel}>
		<span>{selectedLabel}</span>
		<span aria-hidden="true">⌄</span>
	</Select.Trigger>
	<Select.Portal>
		<Select.Content class="ui-select-content" sideOffset={4}>
			<Select.Viewport>
				{#each options as option (option.value)}
					<Select.Item
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						class="ui-select-item"
					>
						{#snippet children({ selected })}
							<span>{option.label}</span>
							{#if selected}<span aria-hidden="true">✓</span>{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>

<style>
	:global(.ui-select-trigger) {
		display: inline-flex;
		width: 100%;
		min-height: 2.5rem;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid rgba(26, 26, 23, 0.28);
		border-radius: 0;
		background: #fbf8f0;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	:global(.ui-select-trigger:focus-visible) {
		border-color: var(--ink);
		outline: 2px solid var(--highlight);
		outline-offset: 1px;
	}

	:global(.ui-select-content) {
		z-index: 1000;
		min-width: var(--bits-select-anchor-width);
		max-height: min(20rem, var(--bits-select-content-available-height));
		overflow: auto;
		padding: 0.35rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: #fbf8f0;
		box-shadow: 0 2px 6px rgba(26, 26, 23, 0.1);
	}

	:global(.ui-select-item) {
		display: flex;
		min-height: 2.25rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.55rem;
		border-radius: 0;
		color: var(--ink);
		font-size: 0.78rem;
		outline: none;
		cursor: pointer;
	}

	:global(.ui-select-item[data-highlighted]) {
		background: var(--highlight);
	}

	:global(.ui-select-item[data-disabled]) {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
