<script lang="ts">
	import { CalendarClock } from '@lucide/svelte';
	import type { DigestDeadline } from '$lib/dashboard/weekly';
	import type { TimelineDay } from '$lib/dashboard/weekly-view-model';
	let {
		days,
		overdue,
		onnavigate
	}: { days: TimelineDay[]; overdue: DigestDeadline[]; onnavigate: (href: string) => void } =
		$props();
</script>

<section class="grid gap-3" aria-labelledby="timeline-title">
	<h2
		id="timeline-title"
		class="m-0 [font-family:var(--font-body)] text-[1.35rem] text-[var(--ink)]"
	>
		This week
	</h2>
	{#if overdue.length}
		<div
			class="flex flex-wrap items-center gap-[0.4rem] border border-[color-mix(in_srgb,var(--pen-red)_50%,var(--rule))] px-[0.65rem] py-[0.55rem]"
			aria-label="Overdue deadlines"
		>
			<strong class=" text-[var(--pen-red)] text-[var(--text-caption)]">Overdue</strong>
			{#each overdue as item (item.id)}
				<button
					class="inline-flex cursor-pointer items-center gap-[0.3rem] border-0 bg-[var(--paper-shelf)] px-[0.45rem] py-[0.28rem] text-xs text-[var(--ink)]"
					onclick={() => onnavigate(item.link.href)}
					><CalendarClock size={12} class="text-[var(--accent)]" aria-hidden="true" />
					{item.courseCode} · {item.displayTitle}</button
				>
			{/each}
		</div>
	{/if}
	<div
		class="grid grid-cols-7 border border-[var(--rule)] max-[52rem]:grid-cols-1 max-[52rem]:border-t-0"
	>
		{#each days as day (day.key)}
			<article
				class="min-w-0 border-r border-[var(--rule)] bg-[var(--paper)] last:border-r-0 max-[52rem]:grid max-[52rem]:min-h-0 max-[52rem]:grid-cols-[5.5rem_1fr] {day.isToday
					? 'border-t-2 border-t-[var(--accent)]'
					: ''} {day.deadlines.length || day.crunchCount ? 'min-h-40' : ''}"
			>
				<header
					class="grid min-h-[3.2rem] gap-[0.05rem] border-b border-[var(--rule-soft)] px-[0.6rem] py-[0.55rem] max-[52rem]:border-t max-[52rem]:border-r max-[52rem]:border-b-0 max-[52rem]:border-t-[var(--rule)] max-[52rem]:border-r-[var(--rule-soft)]"
					aria-current={day.isToday ? 'date' : undefined}
				>
					<strong class=" text-[var(--ink)] text-[var(--text-caption)]">{day.weekday}</strong><span
						class=" text-[var(--ink-soft)] text-[var(--text-caption)] not-italic"
						>{day.dateLabel}</span
					>{#if day.isToday}<em class=" text-[var(--accent)] text-[var(--text-caption)] not-italic"
							>Today</em
						>{/if}
				</header>
				{#if day.crunchCount}<div
						class="bg-[color-mix(in_srgb,var(--warn)_14%,var(--paper))] px-[0.35rem] py-[0.2rem] text-[var(--ink)] text-[var(--text-caption)] max-[52rem]:col-start-2"
					>
						Crunch window
					</div>{/if}
				{#if day.deadlines.length}
					<div
						class="grid gap-[0.15rem] p-[0.35rem] max-[52rem]:col-start-2 max-[52rem]:min-h-[3.2rem]"
					>
						{#each day.deadlines as item (item.id)}
							<button
								class="grid cursor-pointer gap-[0.15rem] border-0 bg-transparent p-[0.45rem] text-left hover:bg-[var(--paper-shelf)]"
								onclick={() => onnavigate(item.link.href)}
							>
								<span class=" text-[var(--ink-soft)] text-[var(--text-caption)]"
									>{item.courseCode}</span
								><strong class="text-xs leading-[1.25] [overflow-wrap:anywhere] text-[var(--ink)]"
									>{item.displayTitle}</strong
								>
								<small class=" text-[var(--ink-soft)] text-[var(--text-caption)]"
									>{#if item.time}
										{item.time}
									{:else if item.displayTitle !== item.typeLabel}
										{item.typeLabel}
									{/if}{item.gradeWeight != null ? ` · ${item.gradeWeight}%` : ''}</small
								>
							</button>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</div>
</section>
