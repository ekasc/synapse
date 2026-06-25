<script lang="ts">
	import { DropdownMenu } from 'bits-ui';

	export type MenuItem = {
		label?: string;
		action?: () => void | Promise<void>;
		disabled?: boolean;
		danger?: boolean;
		separator?: boolean;
	};

	let {
		items,
		label = 'More actions',
		class: className = ''
	}: { items: MenuItem[]; label?: string; class?: string } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="ui-menu-trigger {className}" aria-label={label}>
		<span aria-hidden="true">⋯</span>
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content class="ui-menu-content" align="end" sideOffset={4} loop>
			{#each items as item, index (`${item.label ?? 'separator'}-${index}`)}
				{#if item.separator}
					<DropdownMenu.Separator class="ui-menu-separator" />
				{:else}
					<DropdownMenu.Item
						class="ui-menu-item {item.danger ? 'ui-menu-item-danger' : ''}"
						disabled={item.disabled}
						onSelect={() => item.action?.()}
					>
						{item.label}
					</DropdownMenu.Item>
				{/if}
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
	:global(.ui-menu-trigger) {
		display: inline-grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 1px solid rgba(26, 26, 23, 0.18);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font-size: 1.15rem;
		cursor: pointer;
	}

	:global(.ui-menu-trigger:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	:global(.ui-menu-content) {
		z-index: 1000;
		min-width: 11rem;
		padding: 0.35rem;
		border: 1px solid var(--ink);
		border-radius: 0;
		background: #fbf8f0;
		box-shadow: 0 2px 6px rgba(26, 26, 23, 0.1);
	}

	:global(.ui-menu-item) {
		min-height: 2.25rem;
		padding: 0.5rem 0.65rem;
		border-radius: 0;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		outline: none;
		cursor: pointer;
	}

	:global(.ui-menu-item[data-highlighted]) {
		background: var(--highlight);
	}

	:global(.ui-menu-item[data-disabled]) {
		opacity: 0.4;
		cursor: not-allowed;
	}

	:global(.ui-menu-item-danger) {
		color: var(--pen-red);
	}

	:global(.ui-menu-separator) {
		height: 1px;
		margin: 0.25rem;
		background: rgba(26, 26, 23, 0.16);
	}
</style>
