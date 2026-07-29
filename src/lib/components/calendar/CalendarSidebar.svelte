<script lang="ts">
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import type { CalendarEvent, GradeStakesGroup } from './types';

	let {
		events = [] as CalendarEvent[],
		upcoming = [] as CalendarEvent[],
		gradeStakesByCourse = [] as GradeStakesGroup[],
		courseColor = (_code: string) => 'var(--ink)',
		eventIsOverdue = (_event: CalendarEvent) => false
	}: {
		events: CalendarEvent[];
		upcoming: CalendarEvent[];
		gradeStakesByCourse: GradeStakesGroup[];
		courseColor: (code: string) => string;
		eventIsOverdue: (event: CalendarEvent) => boolean;
	} = $props();

	const attentionEvents = $derived(
		[...upcoming].sort((a, b) => Number(b.status === 'at_risk') - Number(a.status === 'at_risk'))
	);
</script>

<aside class="upcoming-panel">
	{#if events.length === 0}
		<div class="sidebar-empty">
			<div class="sidebar-empty-icon">◷</div>
			<p class="sidebar-empty-title font-hand">Empty calendar</p>
			<p class="sidebar-empty-text">Add your first event to start planning deadlines.</p>
		</div>
	{/if}

	{#if attentionEvents.length > 0}
		<SectionHead title="Needs attention" />
		<div class="upcoming-mini-list">
			{#each attentionEvents.slice(0, 3) as ev (ev.id)}
				<div class="upcoming-mini-item" class:upcoming-mini-overdue={eventIsOverdue(ev)}>
					<span class="upcoming-mini-dot" style="background: {courseColor(ev.courseCode)}"></span>
					<div class="upcoming-mini-body">
						<span class="upcoming-mini-title">{ev.title}</span>
						<span class="upcoming-mini-date">
							{ev.courseCode} · {new Date(ev.year, ev.month, ev.date).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})}
						</span>
					</div>
					{#if ev.status === 'at_risk'}<span class="upcoming-mini-badge upcoming-mini-risk"
							>At risk</span
						>{:else if ev.gradeWeight != null && ev.gradeWeight > 0}<span
							class="upcoming-mini-weight font-numeric">{ev.gradeWeight}%</span
						>{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Remaining graded work stays separate because percentages have different denominators. -->
	{#if gradeStakesByCourse.length > 0}
		<SectionHead title="Remaining grade stakes" />
		<div class="weight-list">
			{#each gradeStakesByCourse.slice(0, 5) as group (group.courseCode)}
				<div class="weight-item">
					<div class="weight-bar-track">
						<div
							class="weight-bar-fill"
							style="transform: scaleX({Math.min(group.weight, 100) /
								100}); background: {courseColor(group.courseCode)}"
						></div>
					</div>
					<div class="weight-info">
						<span class="weight-title">{group.courseCode}</span>
						<span class="weight-meta font-numeric">{group.weight}% upcoming</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</aside>

<style>
	.upcoming-panel {
		padding: 1.5rem 0 0;
		margin: 0;
	}
	.sidebar-empty {
		padding: 1.5rem 1rem;
		text-align: center;
		border: 1px dashed var(--rule);
	}
	.sidebar-empty-icon {
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
		color: var(--ink-faint);
	}
	.sidebar-empty-title {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--ink);
		margin: 0 0 0.5rem;
		line-height: 1;
	}
	.sidebar-empty-text {
		font-size: var(--text-caption);
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.5;
	}

	/* Weight stakes */
	.weight-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.weight-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.weight-bar-track {
		height: 4px;
		background: var(--paper-shelf);
		position: relative;
	}
	.weight-bar-fill {
		height: 100%;
		width: 100%;
		transform-origin: left;
		transition: transform 0.3s var(--ease-out-quart);
	}
	.weight-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.weight-title {
		font-size: var(--text-caption);
		color: var(--ink);
	}
	.weight-meta {
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}

	/* Upcoming mini-list */
	.upcoming-mini-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--rule);
		background: var(--paper);
		margin-bottom: 1rem;
	}
	.upcoming-mini-item {
		display: grid;
		grid-template-columns: 7px minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.6rem;
		padding: 0.75rem;
		border-bottom: 1px solid var(--rule);
	}
	.upcoming-mini-item:last-child {
		border-bottom: none;
	}
	.upcoming-mini-overdue {
		opacity: 0.5;
	}
	.upcoming-mini-dot {
		width: 7px;
		height: 7px;
		margin-top: 0.35rem;
	}
	.upcoming-mini-body {
		flex: 1;
		min-width: 0;
	}
	.upcoming-mini-title {
		display: block;
		font-size: var(--text-caption);
		color: var(--ink);
		line-height: 1.4;
	}
	.upcoming-mini-date {
		font-size: var(--text-caption);
		color: var(--ink-faint);
		margin-top: 1px;
		display: block;
	}
	.upcoming-mini-weight {
		font-size: var(--text-caption);
		color: var(--ink-soft);
		flex-shrink: 0;
	}
	.upcoming-mini-badge {
		font-size: var(--text-caption);
		color: var(--ok);
		flex-shrink: 0;
		margin-top: 2px;
	}
	.upcoming-mini-risk {
		color: var(--accent);
	}

	@media (max-width: 768px) {
		.upcoming-panel {
			position: static;
		}
	}
</style>
