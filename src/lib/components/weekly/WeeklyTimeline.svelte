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

<section class="timeline" aria-labelledby="timeline-title">
	<div class="section-title">
		<span>Schedule</span>
		<h2 id="timeline-title">This week</h2>
	</div>
	{#if overdue.length}
		<div class="overdue" aria-label="Overdue deadlines">
			<strong>Overdue</strong>
			{#each overdue as item (item.id)}
				<button onclick={() => onnavigate(item.link.href)}
					><span>{item.courseCode}</span>{item.title}</button
				>
			{/each}
		</div>
	{/if}
	<div class="days">
		{#each days as day (day.key)}
			<article class:today={day.isToday}>
				<header aria-current={day.isToday ? 'date' : undefined}>
					<strong>{day.weekday}</strong><span>{day.dateLabel}</span>{#if day.isToday}<em>Today</em
						>{/if}
				</header>
				{#if day.crunchCount}<div class="crunch">Crunch window</div>{/if}
				<div class="items">
					{#each day.deadlines as item (item.id)}
						<button class="event" onclick={() => onnavigate(item.link.href)}>
							<span>{item.courseCode}</span><strong>{item.title}</strong>
							<small
								>{item.time ?? item.typeLabel}{item.gradeWeight != null
									? ` · ${item.gradeWeight}%`
									: ''}</small
							>
						</button>
					{:else}
						<span class="empty">Clear</span>
					{/each}
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.timeline {
		display: grid;
		gap: 0.75rem;
	}
	.section-title {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
	}
	.section-title > span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}
	h2 {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.35rem;
		color: var(--ink);
	}
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		border-top: 1px solid var(--rule);
		border-left: 1px solid var(--rule);
	}
	article {
		min-width: 0;
		min-height: 10rem;
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
	}
	article.today {
		background: color-mix(in srgb, var(--highlight) 25%, var(--paper));
	}
	header {
		min-height: 3.2rem;
		padding: 0.55rem 0.6rem;
		display: grid;
		gap: 0.05rem;
		border-bottom: 1px solid var(--rule-soft);
	}
	header strong {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		color: var(--ink);
	}
	header span,
	header em {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--ink-faint);
		font-style: normal;
	}
	header em {
		color: var(--accent);
		text-transform: uppercase;
	}
	.items {
		padding: 0.35rem;
		display: grid;
		gap: 0.35rem;
	}
	.event {
		width: 100%;
		padding: 0.45rem;
		border: 1px solid var(--rule-soft);
		background: var(--paper);
		display: grid;
		gap: 0.15rem;
		text-align: left;
		cursor: pointer;
	}
	.event:hover {
		border-color: var(--ink);
	}
	.event span,
	.event small {
		font-family: var(--font-mono);
		font-size: 0.56rem;
		color: var(--ink-soft);
		text-transform: uppercase;
	}
	.event strong {
		font-size: 0.75rem;
		line-height: 1.25;
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	.empty {
		padding: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--ink-faint);
	}
	.crunch {
		padding: 0.2rem 0.35rem;
		background: var(--paper-shelf);
		font-family: var(--font-mono);
		font-size: 0.55rem;
		color: var(--warn);
		text-transform: uppercase;
	}
	.overdue {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid color-mix(in srgb, var(--pen-red) 50%, var(--rule));
	}
	.overdue > strong {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--pen-red);
		text-transform: uppercase;
	}
	.overdue button {
		border: 0;
		background: var(--paper-shelf);
		padding: 0.28rem 0.45rem;
		color: var(--ink);
		cursor: pointer;
		font-size: 0.75rem;
	}
	.overdue button span {
		margin-right: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--pen-red);
	}
	@media (max-width: 52rem) {
		.days {
			grid-template-columns: 1fr;
			border-top: 0;
		}
		article {
			min-height: 0;
			display: grid;
			grid-template-columns: 5.5rem 1fr;
		}
		header {
			border-top: 1px solid var(--rule);
			border-bottom: 0;
			border-right: 1px solid var(--rule-soft);
		}
		.crunch {
			grid-column: 2;
		}
		.items {
			grid-column: 2;
			min-height: 3.2rem;
		}
	}
</style>
