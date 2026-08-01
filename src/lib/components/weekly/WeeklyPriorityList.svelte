<script lang="ts">
	import { ArrowRight, CalendarClock, FileText, Timer } from '@lucide/svelte';
	import type { CompactPriority } from '$lib/dashboard/weekly-view-model';
	let {
		priorities,
		onnavigate
	}: { priorities: CompactPriority[]; onnavigate: (href: string) => void } = $props();
</script>

<section class="grid gap-3" aria-labelledby="priorities-title">
	<h2
		id="priorities-title"
		class="m-0 [font-family:var(--font-body)] text-[1.35rem] text-[var(--ink)]"
	>
		Top priorities
	</h2>
	<ol class="m-0 list-none p-0">
		{#each priorities as item (item.id)}
			<li
				class="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-[0.8rem] border-b border-[var(--rule-soft)] px-[0.2rem] py-[0.7rem] max-[40rem]:grid-cols-[1.5rem_1fr]"
			>
				<span
					class="pt-[0.1rem] [font-family:var(--font-numeric)] font-bold text-[var(--ink-soft)]"
					aria-hidden="true">{item.rank}</span
				>
				<div class="grid min-w-0 gap-[0.15rem]">
					<div
						class="flex flex-wrap items-center gap-[0.35rem] text-[var(--ink-soft)] text-[var(--text-caption)]"
					>
						{#if item.kind === 'deadline'}
							<CalendarClock class="text-[var(--accent)]" size={14} aria-hidden="true" />
						{:else if item.kind === 'practice'}
							<Timer class="text-[var(--ok)]" size={14} aria-hidden="true" />
						{:else}
							<FileText class="text-[var(--pen-blue)]" size={14} aria-hidden="true" />
						{/if}
						{#if item.courseCode}<span class="bg-[var(--paper-shelf)] px-[0.3rem] py-[0.05rem]"
								>{item.courseCode}</span
							>{/if}
					</div>
					<strong class="text-[var(--ink)] text-[var(--text-small)]">{item.displayTitle}</strong>
					<small class="text-[var(--ink-soft)] text-[var(--text-caption)]">{item.meta}</small>
				</div>
				<button
					class="btn btn-ghost btn-sm max-[40rem]:col-start-2 max-[40rem]:justify-self-start"
					onclick={() => onnavigate(item.link.href)}
					>{item.link.label} <ArrowRight size={14} aria-hidden="true" /></button
				>
			</li>
		{/each}
	</ol>
</section>
