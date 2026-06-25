<script lang="ts">
	import { Checkbox } from 'bits-ui';

	let {
		checked = $bindable(false),
		label,
		disabled = false,
		onCheckedChange,
		class: className = ''
	}: {
		checked?: boolean;
		label: string;
		disabled?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		class?: string;
	} = $props();
</script>

<label class="ui-checkbox-label {className}">
	<Checkbox.Root bind:checked {disabled} {onCheckedChange} class="ui-checkbox">
		{#snippet children({ checked: isChecked })}
			<span aria-hidden="true">{isChecked ? '✓' : ''}</span>
		{/snippet}
	</Checkbox.Root>
	<span>{label}</span>
</label>

<style>
	:global(.ui-checkbox-label) {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--ink);
		font-size: 0.82rem;
		cursor: pointer;
	}

	:global(.ui-checkbox) {
		display: inline-grid;
		width: 1.25rem;
		height: 1.25rem;
		place-items: center;
		flex: none;
		border: 1px solid var(--ink);
		border-radius: 3px;
		background: #fbf8f0;
		color: var(--ink);
		font-size: 0.8rem;
		cursor: pointer;
	}

	:global(.ui-checkbox[data-state='checked']) {
		background: var(--highlight);
	}

	:global(.ui-checkbox:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
