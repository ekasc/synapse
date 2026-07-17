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
		<Dialog.Overlay class="ui-dialog-overlay" />
		<Dialog.Content class="ui-dialog-content {className}">
			<div class="ui-dialog-header">
				<Dialog.Title class="ui-dialog-title font-hand">{title}</Dialog.Title>
				<Dialog.Close class="ui-dialog-close" aria-label="Close dialog">×</Dialog.Close>
			</div>
			{#if description}
				<Dialog.Description class="ui-dialog-description">{description}</Dialog.Description>
			{/if}
			{@render children()}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

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
		animation: ui-dialog-in 0.18s var(--ease-out-quart);
		width: min(38rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
		padding: 1.5rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: var(--paper);
		box-shadow: 0 2px 6px rgba(26, 26, 23, 0.1);
		transform: translate(-50%, -50%);
	}

	:global(.ui-dialog-header) {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	:global(.ui-dialog-title) {
		margin: 0;
		color: var(--ink);
		font-size: 1.55rem;
	}

	:global(.ui-dialog-description) {
		margin: 0.5rem 0 1rem;
		color: var(--ink-soft);
		font-size: 0.9rem;
	}

	:global(.ui-dialog-close) {
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		transition: border-color 0.15s var(--ease-out-quart);
		place-items: center;
		border: 1px solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font-size: 1.25rem;
		cursor: pointer;
	}

	:global(.ui-dialog-close:focus-visible) {
		border-color: var(--ink);
		outline: 2px solid var(--highlight);
	}
</style>
