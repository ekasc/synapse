<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import type { CompactPriority } from '$lib/dashboard/weekly-view-model';
	let {
		priorities,
		onnavigate
	}: { priorities: CompactPriority[]; onnavigate: (href: string) => void } = $props();
</script>

<section class="grid gap-3" aria-labelledby="priorities-title">
	<div class="flex items-baseline gap-[0.7rem]">
		<span class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]">Focus</span>
		<h2
			id="priorities-title"
			class="m-0 [font-family:var(--font-body)] text-[1.35rem] text-[var(--ink)]"
		>
			Top priorities
		</h2>
	</div>
	<ol class="m-0 list-none border-t border-[var(--rule)] p-0">
		{#each priorities as item (item.id)}
			<li
				class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-[0.8rem] border-b border-[var(--rule-soft)] px-[0.2rem] py-[0.7rem] max-[40rem]:grid-cols-[2rem_1fr]"
			>
				<span
					class="grid size-[1.8rem] place-items-center border border-[var(--ink)] [font-family:var(--font-body)] font-bold"
					>{item.rank}</span
				>
				<div class="grid min-w-0 gap-[0.15rem]">
					<div class="flex gap-[0.35rem] text-[var(--ink-soft)] text-[var(--text-caption)]">
						<span class="bg-[var(--paper-shelf)] px-[0.3rem] py-[0.05rem]">{item.kindLabel}</span
						>{#if item.courseCode}<span class="bg-[var(--paper-shelf)] px-[0.3rem] py-[0.05rem]"
								>{item.courseCode}</span
							>{/if}
					</div>
					<strong class="text-[var(--ink)] text-[var(--text-small)]">{item.title}</strong>
					<small class="text-[var(--ink-soft)] text-[var(--text-caption)]">{item.meta}</small>
					<Collapsible.Root class="mt-[0.15rem] text-[var(--ink-soft)] text-[var(--text-caption)]">
						<Collapsible.Trigger
							class="w-fit cursor-pointer border-0 bg-transparent p-0  text-[var(--ink-faint)] text-[var(--text-caption)]"
						>
							Why this?
						</Collapsible.Trigger>
						<Collapsible.Content>
							<p class="mt-[0.35rem] mb-0 leading-[1.45]">{item.reason}</p>
							{#if item.factors.length}<p
									class="mt-[0.35rem] mb-0 leading-[1.45] text-[var(--text-caption)]"
								>
									{item.factors.join(' · ')}
								</p>{/if}
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
				<button
					class="btn btn-ghost btn-sm max-[40rem]:col-start-2 max-[40rem]:justify-self-start"
					onclick={() => onnavigate(item.link.href)}>{item.link.label} →</button
				>
			</li>
		{/each}
	</ol>
</section>
