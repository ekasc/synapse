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
		transition: transform 0.15s var(--ease-out-quart);
		place-items: center;
		flex: none;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		font-size: 0.8rem;
		cursor: pointer;
	}

	:global(.ui-checkbox[data-state='checked']) {
		background: var(--highlight);
		transform: scale(1);
		animation: ui-check-pop 0.2s var(--ease-out-quart);
	}

	@keyframes ui-check-pop {
		0% {
			transform: scale(0.85);
		}
		50% {
			transform: scale(1.12);
		}
		100% {
			transform: scale(1);
		}
	}

	:global(.ui-checkbox:active) {
		transform: scale(0.92);
	}

	:global(.ui-checkbox:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
