<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import type { Snippet } from 'svelte';
	let {
		title,
		count,
		hint,
		children
	}: { title: string; count: number; hint?: string; children: Snippet } = $props();
</script>

<Collapsible.Root class="group">
	<Collapsible.Trigger
		class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-[0.2rem] py-[0.65rem] text-left [font-family:var(--font-body)] font-bold text-[var(--ink)]"
		><span class="text-[1.15rem]">{title}</span><span
			class="flex items-center gap-[0.65rem] font-normal text-[var(--ink-faint)] text-[var(--text-caption)]"
			>{hint ?? `${count} item${count === 1 ? '' : 's'}`}<b
				class="[font-family:var(--font-body)] text-base font-normal transition-transform group-data-[state=open]:rotate-45"
				aria-hidden="true">+</b
			></span
		></Collapsible.Trigger
	>
	<Collapsible.Content class="px-0 pt-[0.2rem] pb-[0.8rem]"
		>{@render children()}</Collapsible.Content
	>
</Collapsible.Root>
