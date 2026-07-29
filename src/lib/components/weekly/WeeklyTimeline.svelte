<script lang="ts">
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
	<div class="flex items-baseline gap-[0.7rem]">
		<span class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]"
			>Schedule</span
		>
		<h2
			id="timeline-title"
			class="m-0 [font-family:var(--font-body)] text-[1.35rem] text-[var(--ink)]"
		>
			This week
		</h2>
	</div>
	{#if overdue.length}
		<div
			class="flex flex-wrap items-center gap-[0.4rem] border border-[color-mix(in_srgb,var(--pen-red)_50%,var(--rule))] px-[0.65rem] py-[0.55rem]"
			aria-label="Overdue deadlines"
		>
			<strong class=" text-[var(--pen-red)] text-[var(--text-caption)]">Overdue</strong>
			{#each overdue as item (item.id)}
				<button
					class="cursor-pointer border-0 bg-[var(--paper-shelf)] px-[0.45rem] py-[0.28rem] text-xs text-[var(--ink)]"
					onclick={() => onnavigate(item.link.href)}
					><span class="mr-[0.35rem] text-[var(--pen-red)] text-[var(--text-caption)]"
						>{item.courseCode}</span
					>{item.title}</button
				>
			{/each}
		</div>
	{/if}
	<div
		class="grid grid-cols-7 border-t border-l border-[var(--rule)] max-[52rem]:grid-cols-1 max-[52rem]:border-t-0"
	>
		{#each days as day (day.key)}
			<article
				class="min-h-40 min-w-0 border-r border-b border-[var(--rule)] bg-[var(--paper)] max-[52rem]:grid max-[52rem]:min-h-0 max-[52rem]:grid-cols-[5.5rem_1fr] {day.isToday
					? 'bg-[color-mix(in_srgb,var(--highlight)_25%,var(--paper))]'
					: ''}"
			>
				<header
					class="grid min-h-[3.2rem] gap-[0.05rem] border-b border-[var(--rule-soft)] px-[0.6rem] py-[0.55rem] max-[52rem]:border-t max-[52rem]:border-r max-[52rem]:border-b-0 max-[52rem]:border-t-[var(--rule)] max-[52rem]:border-r-[var(--rule-soft)]"
					aria-current={day.isToday ? 'date' : undefined}
				>
					<strong class=" text-[var(--ink)] text-[var(--text-caption)]">{day.weekday}</strong><span
						class=" text-[var(--ink-faint)] text-[var(--text-caption)] not-italic"
						>{day.dateLabel}</span
					>{#if day.isToday}<em class=" text-[var(--accent)] text-[var(--text-caption)] not-italic"
							>Today</em
						>{/if}
				</header>
				{#if day.crunchCount}<div
						class="bg-[var(--paper-shelf)] px-[0.35rem] py-[0.2rem] text-[var(--text-caption)] text-[var(--warn)] max-[52rem]:col-start-2"
					>
						Crunch window
					</div>{/if}
				<div
					class="grid gap-[0.35rem] p-[0.35rem] max-[52rem]:col-start-2 max-[52rem]:min-h-[3.2rem]"
				>
					{#each day.deadlines as item (item.id)}
						<button
							class="grid w-full cursor-pointer gap-[0.15rem] border border-[var(--rule-soft)] bg-[var(--paper)] p-[0.45rem] text-left hover:border-[var(--ink)]"
							onclick={() => onnavigate(item.link.href)}
						>
							<span class=" text-[var(--ink-soft)] text-[var(--text-caption)]"
								>{item.courseCode}</span
							><strong class="text-xs leading-[1.25] [overflow-wrap:anywhere] text-[var(--ink)]"
								>{item.title}</strong
							>
							<small class=" text-[var(--ink-soft)] text-[var(--text-caption)]"
								>{item.time ?? item.typeLabel}{item.gradeWeight != null
									? ` · ${item.gradeWeight}%`
									: ''}</small
							>
						</button>
					{:else}
						<span class="p-[0.35rem] text-[var(--text-caption)] text-[var(--ink-faint)]">Clear</span
						>
					{/each}
				</div>
			</article>
		{/each}
	</div>
</section>
