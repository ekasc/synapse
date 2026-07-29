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
		<AlertDialog.Overlay
			class="fixed inset-0 z-[var(--z-dialog-overlay)] bg-[rgba(26,26,23,0.38)]"
		/>
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-[var(--z-dialog-content)] max-h-[calc(100vh_-_2rem)] w-[min(30rem,calc(100vw_-_2rem))] -translate-x-1/2 -translate-y-1/2 [animation:ui-dialog-in_0.18s_var(--ease-out-quart)] overflow-auto rounded-none border border-[var(--ink)] bg-[var(--paper)] p-6 [box-shadow:0_2px_6px_rgba(26,26,23,0.1)]"
		>
			<AlertDialog.Title class="font-hand m-0 text-[1.55rem] text-[var(--ink)]"
				>{title}</AlertDialog.Title
			>
			<AlertDialog.Description
				class="overflow-wrap-anywhere mt-[0.65rem] leading-normal text-[var(--ink-soft)] text-[var(--text-small)]"
			>
				{description}
			</AlertDialog.Description>
			<div class="mt-5 flex justify-end gap-2">
				<AlertDialog.Cancel
					class="min-h-10 cursor-pointer rounded-none border border-[rgba(26,26,23,0.25)] bg-transparent px-[0.9rem] py-2 font-[inherit] text-[var(--ink)] transition-transform duration-100 ease-[var(--ease-out-quart)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] active:translate-y-px [@media(pointer:coarse)]:min-h-11"
					disabled={busy}
				>
					{cancelLabel}
				</AlertDialog.Cancel>
				<AlertDialog.Action
					class="min-h-10 cursor-pointer rounded-none border border-[rgba(194,54,42,0.35)] bg-transparent px-[0.9rem] py-2 font-[inherit] text-[var(--pen-red)] transition-transform duration-100 ease-[var(--ease-out-quart)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] active:translate-y-px enabled:hover:border-[var(--pen-red)] enabled:hover:bg-[var(--pen-red)] enabled:hover:text-[var(--paper)] [@media(pointer:coarse)]:min-h-11"
					disabled={busy}
					onclick={confirm}
				>
					{busy ? 'Working…' : confirmLabel}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
