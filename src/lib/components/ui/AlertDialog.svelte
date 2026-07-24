<script lang="ts">
	import { AlertDialog } from 'bits-ui';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		busy = false,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		cancelLabel?: string;
		busy?: boolean;
		onConfirm: () => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	async function confirm() {
		await onConfirm();
		open = false;
	}

	function handleOpenChange(nextOpen: boolean) {
		if (open && !nextOpen) onCancel?.();
		open = nextOpen;
	}
</script>

<AlertDialog.Root {open} onOpenChange={handleOpenChange}>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="ui-dialog-overlay" />
		<AlertDialog.Content class="ui-dialog-content">
			<AlertDialog.Title class="ui-dialog-title font-hand">{title}</AlertDialog.Title>
			<AlertDialog.Description class="ui-dialog-description">
				{description}
			</AlertDialog.Description>
			<div class="ui-dialog-actions">
				<AlertDialog.Cancel class="ui-dialog-button" disabled={busy}>
					{cancelLabel}
				</AlertDialog.Cancel>
				<AlertDialog.Action
					class="ui-dialog-button ui-dialog-button-danger"
					disabled={busy}
					onclick={confirm}
				>
					{busy ? 'Working…' : confirmLabel}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>

<style>
	:global(.ui-dialog-overlay) {
		position: fixed;
		z-index: var(--z-dialog-overlay);
		inset: 0;
		background: rgba(26, 26, 23, 0.38);
	}

	:global(.ui-dialog-content) {
		position: fixed;
		z-index: var(--z-dialog-content);
		top: 50%;
		left: 50%;
		width: min(30rem, calc(100vw - 2rem));
		animation: ui-dialog-in 0.18s var(--ease-out-quart);
		max-height: calc(100vh - 2rem);
		overflow: auto;
		padding: 1.5rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--paper);
		box-shadow: 0 2px 6px rgba(26, 26, 23, 0.1);
		transform: translate(-50%, -50%);
	}

	:global(.ui-dialog-title) {
		margin: 0;
		color: var(--ink);
		font-size: 1.55rem;
	}

	:global(.ui-dialog-description) {
		margin: 0.65rem 0 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	:global(.ui-dialog-actions) {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}

	:global(.ui-dialog-button) {
		min-height: 2.5rem;
		padding: 0.5rem 0.9rem;
		transition: transform 0.1s var(--ease-out-quart);
		border: 1px solid rgba(26, 26, 23, 0.25);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	:global(.ui-dialog-button:focus-visible) {
		outline: 2px solid var(--highlight);
		outline-offset: 2px;
	}

	:global(.ui-dialog-button-danger) {
		border-color: rgba(194, 54, 42, 0.35);
		color: var(--pen-red);
	}

	:global(.ui-dialog-button-danger:hover:not(:disabled)) {
		border-color: var(--pen-red);
		background: var(--pen-red);
		color: var(--paper);
	}

	:global(.ui-dialog-button:active) {
		transform: translateY(1px);
	}

	@media (pointer: coarse) {
		:global(.ui-dialog-button) {
			min-height: 2.75rem;
		}
	}
</style>
