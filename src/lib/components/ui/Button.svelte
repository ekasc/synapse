<script lang="ts">
	import { Button } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'secondary',
		size = 'md',
		class: className = '',
		children,
		type = 'button',
		...rest
	}: HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		class?: string;
		children: Snippet;
	} = $props();
</script>

<Button.Root {type} class="ui-button ui-button--{variant} ui-button--{size} {className}" {...rest}>
	{@render children()}
</Button.Root>

<style>
	:global(.ui-button) {
		display: inline-flex;
		min-height: 2.5rem;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid rgba(26, 26, 23, 0.18);
		border-radius: 5px;
		background: transparent;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.12s var(--ease-out-quart),
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart),
			transform 0.12s var(--ease-out-quart);
	}

	:global(.ui-button:hover:not(:disabled)) {
		border-color: var(--ink);
		background: var(--highlight-soft);
		transform: translateY(-1px);
	}

	:global(.ui-button:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	:global(.ui-button:disabled) {
		opacity: 0.4;
		cursor: not-allowed;
	}

	:global(.ui-button--primary) {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}

	:global(.ui-button--primary:hover:not(:disabled)) {
		background: #2a2a27;
		color: var(--paper);
	}

	:global(.ui-button--ghost) {
		border-color: transparent;
		color: var(--ink-soft);
	}

	:global(.ui-button--ghost:hover:not(:disabled)) {
		border-color: transparent;
		background: rgba(26, 26, 23, 0.05);
		color: var(--ink);
	}

	:global(.ui-button--danger) {
		border-color: rgba(194, 54, 42, 0.35);
		color: var(--pen-red);
	}

	:global(.ui-button--danger:hover:not(:disabled)) {
		border-color: var(--pen-red);
		background: var(--pen-red);
		color: var(--paper);
	}

	:global(.ui-button--sm) {
		min-height: 2.25rem;
		padding: 0.4rem 0.7rem;
		font-size: 0.72rem;
	}
</style>
