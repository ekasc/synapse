<script lang="ts">
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import type { CalendarEvent, CourseColor, CrunchPeriod, GradeStakesGroup } from './types';

	let {
		events = [] as CalendarEvent[],
		allCourseCodes = [] as string[],
		filterCourses = [] as string[],
		hasActiveFilter = false,
		upcoming = [] as CalendarEvent[],
		crunchPeriods = [] as CrunchPeriod[],
		gradeStakesByCourse = [] as GradeStakesGroup[],
		courseColor = (_code: string) => 'var(--ink)',
		typeBadge = (_t: string) => '•',
		eventIsOverdue = (_event: CalendarEvent) => false,
		onToggleCourseFilter = (_code: string) => {},
		onClearFilters = () => {}
	}: {
		events: CalendarEvent[];
		allCourseCodes: string[];
		filterCourses: string[];
		hasActiveFilter: boolean;
		upcoming: CalendarEvent[];
		crunchPeriods: CrunchPeriod[];
		gradeStakesByCourse: GradeStakesGroup[];
		courseColor: (code: string) => string;
		typeBadge: (t: string) => string;
		eventIsOverdue: (event: CalendarEvent) => boolean;
		onToggleCourseFilter: (code: string) => void;
		onClearFilters: () => void;
	} = $props();
</script>

<aside class="upcoming-panel">
	{#if allCourseCodes.length > 0}
		<SectionHead eyebrow="Filter" title="Courses" />
		<div class="filter-bar-sidebar">
			{#each allCourseCodes as code (code)}
				<button
					class="filter-chip-sm font-mono"
					class:filter-chip-sm-active={filterCourses.includes(code)}
					onclick={() => onToggleCourseFilter(code)}>{code}</button
				>
			{/each}
			{#if hasActiveFilter}<button class="filter-chip-sm font-mono" onclick={onClearFilters}
					>clear</button
				>{/if}
		</div>
	{/if}

	{#if events.length === 0}
		<div class="sidebar-empty">
			<div class="sidebar-empty-icon">◷</div>
			<p class="sidebar-empty-title font-hand">Empty calendar</p>
			<p class="sidebar-empty-text">
				Add events to track exams, assignments, and study sessions. Each event can include a grade
				weight so Synapse can calculate your stakes.
			</p>
		</div>
	{/if}

	<!-- Crunch zones -->
	{#if crunchPeriods.length > 0}
		<SectionHead title="Crunch zones" eyebrow={`${crunchPeriods.length} detected`} />
		<div class="crunch-list">
			{#each crunchPeriods as cp, i (i)}
				<div class="crunch-card" class:crunch-high={cp.days <= 2}>
					<div class="crunch-head">
						<span class="crunch-dates font-mono">{cp.start} – {cp.end}</span>
						<span class="crunch-density">{cp.events.length} events</span>
					</div>
					{#if cp.weight > 0 && cp.courses.length === 1}
						<div class="crunch-weight font-mono">
							{cp.weight}% of {cp.courses[0]} coursework
						</div>
					{:else}
						<div class="crunch-weight font-mono">
							{cp.events.length} deadlines across {cp.courses.length} courses
						</div>
					{/if}
					<div class="crunch-courses">
						{#each cp.courses as code (code)}
							<span class="crunch-chip font-mono" style="border-color: {courseColor(code)}"
								>{code}</span
							>
						{/each}
					</div>
					<div class="crunch-events">
						{#each cp.events.slice(0, 4) as ev (ev.id)}
							<span class="crunch-event">{ev.title}</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Remaining graded work, kept separate by course because percentages have different denominators. -->
	{#if gradeStakesByCourse.length > 0}
		<SectionHead title="Remaining grade stakes" eyebrow={`${gradeStakesByCourse.length} courses`} />
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
						<span class="weight-meta font-mono">{group.weight}% upcoming</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Upcoming (compact) -->
	{#if upcoming.length > 0}
		<SectionHead
			title="Upcoming"
			eyebrow={`${upcoming.length} event${upcoming.length !== 1 ? 's' : ''}`}
		/>
		<div class="upcoming-mini-list">
			{#each upcoming.slice(0, 7) as ev (ev.id)}
				<div class="upcoming-mini-item" class:upcoming-mini-overdue={eventIsOverdue(ev)}>
					<span class="upcoming-mini-dot" style="background: {courseColor(ev.courseCode)}"></span>
					<div class="upcoming-mini-body">
						<span class="upcoming-mini-title"
							>{ev.title}<span class="cal-popover-type font-mono">{typeBadge(ev.type)}</span></span
						>
						<span class="upcoming-mini-date font-mono"
							>{new Date(ev.year, ev.month, ev.date).toLocaleDateString('en-US', {
								weekday: 'short',
								month: 'short',
								day: 'numeric'
							})}</span
						>
					</div>
					{#if ev.gradeWeight != null && ev.gradeWeight > 0}
						<span class="upcoming-mini-weight font-mono">{ev.gradeWeight}%</span>
					{/if}
					{#if ev.status === 'completed'}
						<span class="upcoming-mini-badge">✓</span>
					{:else if ev.status === 'at_risk'}
						<span class="upcoming-mini-badge upcoming-mini-risk">!</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</aside>

<style>
	.upcoming-panel {
		position: sticky;
		top: 2rem;
		padding: 0;
		margin-top: 0.5rem;
	}
	.filter-bar-sidebar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}
	.filter-chip-sm {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--rule);
		background: transparent;
		color: var(--ink-faint);
		cursor: pointer;
		font-size: 0.6rem;
		letter-spacing: 0.08em;
	}
	.filter-chip-sm:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.filter-chip-sm-active {
		background: var(--highlight);
		border-color: var(--ink);
		color: var(--ink);
		font-weight: 500;
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
		font-size: 0.78rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.5;
	}

	/* Crunch cards */
	.crunch-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.crunch-card {
		padding: 0.65rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.crunch-high {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 5%, var(--paper));
	}
	.crunch-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}
	.crunch-dates {
		font-size: 0.72rem;
		color: var(--ink);
		font-weight: 500;
	}
	.crunch-density {
		font-size: 0.62rem;
		color: var(--accent);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.crunch-weight {
		font-size: 0.65rem;
		color: var(--accent);
		margin-bottom: 0.25rem;
	}
	.crunch-courses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		margin-bottom: 0.25rem;
	}
	.crunch-chip {
		font-size: 0.62rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.crunch-events {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
	}
	.crunch-event {
		font-size: 0.7rem;
		color: var(--ink-soft);
	}
	.crunch-event:after {
		content: '·';
		margin-left: 0.2rem;
		color: var(--ink-faint);
	}
	.crunch-event:last-child:after {
		content: '';
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
		font-size: 0.72rem;
		color: var(--ink);
	}
	.weight-meta {
		font-size: 0.65rem;
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
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
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
		flex-shrink: 0;
		margin-top: 3px;
	}
	.upcoming-mini-body {
		flex: 1;
		min-width: 0;
	}
	.upcoming-mini-title {
		font-size: 0.75rem;
		color: var(--ink);
		line-height: 1.3;
	}
	.upcoming-mini-date {
		font-size: 0.62rem;
		color: var(--ink-faint);
		margin-top: 1px;
		display: block;
	}
	.upcoming-mini-weight {
		font-size: 0.62rem;
		color: var(--ink-soft);
		flex-shrink: 0;
	}
	.upcoming-mini-badge {
		font-size: 0.62rem;
		color: var(--ok);
		flex-shrink: 0;
		margin-top: 2px;
	}
	.upcoming-mini-risk {
		color: var(--accent);
	}

	.cal-popover-type {
		display: inline-block;
		margin-left: 0.2rem;
		padding: 0 0.25rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		line-height: 1.2;
		vertical-align: middle;
	}

	@media (max-width: 768px) {
		.upcoming-panel {
			position: static;
		}
	}

	/* Touch: raise filter chips to the 44px WCAG hit-area floor. */
	@media (pointer: coarse) {
		.filter-chip-sm {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
			padding: 0 0.65rem;
		}
		.filter-bar-sidebar {
			gap: 0.35rem;
		}
	}
</style>
