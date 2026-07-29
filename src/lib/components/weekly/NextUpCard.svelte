<script lang="ts">
	import type { NextUp } from '$lib/dashboard/weekly-view-model';
	let { item, onnavigate }: { item: NextUp; onnavigate: (href: string) => void } = $props();
</script>

<section
	class="grid grid-cols-[6rem_1fr] border border-[var(--ink)] bg-[var(--paper)] max-[38rem]:grid-cols-1"
	aria-labelledby="next-up-title"
>
	<div
		class="border-r border-[var(--ink)] bg-[var(--highlight)] p-[0.9rem] [font-family:var(--font-body)] font-bold text-[var(--ink)] max-[38rem]:border-r-0 max-[38rem]:border-b max-[38rem]:px-3 max-[38rem]:py-[0.45rem]"
	>
		Next up
	</div>
	{#if item.kind === 'deadline'}
		<div class="grid justify-items-start gap-[0.35rem] px-4 py-[0.85rem]">
			<div class="flex flex-wrap gap-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)]">
				<span
					class="bg-[var(--paper-shelf)] px-[0.35rem] py-[0.06rem] {item.deadline.overdue
						? 'text-[var(--pen-red)]'
						: ''}">{item.status}</span
				><span class="bg-[var(--paper-shelf)] px-[0.35rem] py-[0.06rem]"
					>{item.deadline.courseCode}</span
				>
			</div>
			<h2
				id="next-up-title"
				class="m-0 [font-family:var(--font-body)] text-[1.35rem] leading-[1.15] text-[var(--ink)]"
			>
				{item.deadline.title}
			</h2>
			<p class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">
				{item.deadline.typeLabel}{item.deadline.gradeWeight != null
					? ` · ${item.deadline.gradeWeight}% of grade`
					: ''}{item.deadline.time ? ` · ${item.deadline.time}` : ''}
			</p>
			<button
				class="btn btn-primary btn-sm mt-[0.2rem]"
				onclick={() => onnavigate(item.deadline.link.href)}>{item.deadline.link.label} →</button
			>
		</div>
	{:else}
		<div class="grid justify-items-start gap-[0.35rem] px-4 py-[0.85rem]">
			<div class="flex flex-wrap gap-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)]">
				<span class="bg-[var(--paper-shelf)] px-[0.35rem] py-[0.06rem]">{item.priority.kind}</span
				>{#if item.priority.courseCode}<span
						class="bg-[var(--paper-shelf)] px-[0.35rem] py-[0.06rem]"
						>{item.priority.courseCode}</span
					>{/if}
			</div>
			<h2
				id="next-up-title"
				class="m-0 [font-family:var(--font-body)] text-[1.35rem] leading-[1.15] text-[var(--ink)]"
			>
				{item.priority.title}
			</h2>
			<p class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">{item.status}</p>
			<button
				class="btn btn-primary btn-sm mt-[0.2rem]"
				onclick={() => onnavigate(item.priority.link.href)}>{item.priority.link.label} →</button
			>
		</div>
	{/if}
</section>
