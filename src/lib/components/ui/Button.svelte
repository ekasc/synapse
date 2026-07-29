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

	const baseClass =
		'inline-flex min-h-[var(--control-md)] cursor-pointer items-center justify-center gap-[var(--space-2)] whitespace-nowrap rounded-none border border-[rgba(26,26,23,0.18)] bg-transparent px-[0.9rem] py-2 text-[var(--text-caption)] leading-none font-medium text-[var(--ink)] no-underline transition-[background,border-color,color,transform] duration-[120ms] ease-[var(--ease-out-quart)] font-body enabled:hover:-translate-y-px enabled:hover:border-[var(--ink)] enabled:hover:bg-[var(--highlight-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:min-h-[var(--target-touch)] [@media(pointer:coarse)]:min-w-[var(--target-touch)]';
	const variantClass = $derived(
		{
			primary:
				'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] enabled:hover:bg-[var(--ink)] enabled:hover:text-[var(--paper)] enabled:hover:opacity-85',
			secondary: '',
			ghost:
				'border-transparent text-[var(--ink-soft)] enabled:hover:border-transparent enabled:hover:bg-[rgba(26,26,23,0.05)] enabled:hover:text-[var(--ink)]',
			danger:
				'border-[rgba(194,54,42,0.35)] text-[var(--pen-red)] enabled:hover:border-[var(--pen-red)] enabled:hover:bg-[var(--pen-red)] enabled:hover:text-[var(--paper)]'
		}[variant]
	);
	const sizeClass = $derived(
		size === 'sm' ? 'min-h-[var(--control-sm)] px-[0.7rem] py-1.5 text-[var(--text-caption)]' : ''
	);
</script>

<Button.Root {type} class="{baseClass} {variantClass} {sizeClass} {className}" {...rest}>
	{@render children()}
</Button.Root>
