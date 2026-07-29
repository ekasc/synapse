<script lang="ts">
	import { Dialog } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		description,
		onOpenChange,
		class: className = '',
		children
	}: {
		open?: boolean;
		title: string;
		description?: string;
		onOpenChange?: (open: boolean) => void;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-[var(--z-dialog-overlay)] bg-[rgba(26,26,23,0.38)]" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-[var(--z-dialog-content)] max-h-[calc(100vh_-_2rem)] w-[min(38rem,calc(100vw_-_2rem))] -translate-x-1/2 -translate-y-1/2 [animation:ui-dialog-in_0.18s_var(--ease-out-quart)] overflow-auto rounded-none border border-[var(--ink)] bg-[var(--paper)] p-6 [box-shadow:0_2px_6px_rgba(26,26,23,0.1)] {className}"
		>
			<div class="flex items-start justify-between gap-4">
				<Dialog.Title class="font-hand m-0 text-[1.55rem] text-[var(--ink)]">{title}</Dialog.Title>
				<Dialog.Close
					class="grid size-9 cursor-pointer place-items-center rounded-none border border-transparent bg-transparent text-xl text-[var(--ink)] transition-colors duration-150 ease-[var(--ease-out-quart)] focus-visible:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--highlight)] [@media(pointer:coarse)]:size-11"
					aria-label="Close dialog">×</Dialog.Close
				>
			</div>
			{#if description}
				<Dialog.Description class="mt-2 mb-4 text-[var(--ink-soft)] text-[var(--text-small)]"
					>{description}</Dialog.Description
				>
			{/if}
			{@render children()}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
