<script lang="ts">
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';

	type CourseColor = { code: string; color: string; name: string };
	type CalendarEvent = {
		id: string;
		date: number;
		title: string;
		course: string;
		type: 'assignment' | 'midterm' | 'final' | 'quiz' | 'lecture';
	};

	let { data }: { data: { events?: CalendarEvent[]; courseColors?: CourseColor[] } } = $props();

	const now = new Date();
	const today = now.getDate();
	let viewYear = $state(now.getFullYear());
	let viewMonth = $state(now.getMonth());

	const monthName = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long' })
	);
	const currentMonth = $derived(`${monthName} ${viewYear}`);
	const daysInMonth = $derived(new Date(viewYear, viewMonth + 1, 0).getDate());
	const startDay = $derived(new Date(viewYear, viewMonth, 1).getDay());

	const monthShort = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'short' })
	);

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}

	function goToday() {
		viewYear = now.getFullYear();
		viewMonth = now.getMonth();
	}

	const isCurrentMonth = $derived(viewYear === now.getFullYear() && viewMonth === now.getMonth());

	const PALETTE = ['#1a1814', '#b03a2e', '#4a4a42', '#8a8270'];
	const courseColors = $derived(data.courseColors ?? []);
	const events = $derived(data.events ?? []);

	function courseColor(code: string): string {
		const known = courseColors.find((c) => c.code === code);
		if (known) return known.color;
		const idx = (code.charCodeAt(0) + (code.charCodeAt(1) || 0)) % PALETTE.length;
		return PALETTE[idx];
	}

	function eventsForDay(day: number): CalendarEvent[] {
		return events.filter((e) => e.date === day);
	}

	const eventsInViewedMonth = $derived(events.filter((e) => e.date <= daysInMonth).length);

	const upcomingInSevenDays = $derived(
		events.filter((e) => e.date >= today && e.date <= today + 7).length
	);

	const eventsByCourse = $derived.by(() => {
		const byCourse: Record<string, { course: string; events: CalendarEvent[] }> = {};
		for (const event of events) {
			(byCourse[event.course] ??= { course: event.course, events: [] }).events.push(event);
		}
		return Object.values(byCourse)
			.map((group) => ({
				...group,
				events: group.events.sort((a, b) => a.date - b.date)
			}))
			.sort((a, b) => b.events.length - a.events.length || a.course.localeCompare(b.course));
	});

	const isOverdue = $derived(isCurrentMonth ? (day: number) => day < today : () => false);
</script>

<svelte:head><title>Synapse · Calendar</title></svelte:head>

<CatalogHeader term={currentMonth} />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Calendar</h1>
		<p class="page-tagline">
			{#if events.length > 0}
				<span class="tagline-num">{eventsInViewedMonth}</span> deadline{eventsInViewedMonth !== 1
					? 's'
					: ''} in
				{monthName.toLowerCase()} · <span class="tagline-num">{upcomingInSevenDays}</span> in the next
				7 days
			{:else}
				Every deadline across every course
			{/if}
		</p>
	</div>

	<div class="cal-layout">
		{#if events.length === 0}
			<div class="cal-empty">
				<h2 class="empty-head font-hand">No deadlines yet</h2>
				<p class="empty-text">Calendar events appear here once a syllabus is uploaded.</p>
			</div>
		{:else}
			<div class="cal-grid surface-polaroid">
				<div class="cal-header">
					<div class="cal-month-nav">
						<button class="cal-nav-btn font-mono" onclick={prevMonth} aria-label="Previous month"
							>←</button
						>
						<span class="cal-month font-hand">{currentMonth}</span>
						<button class="cal-nav-btn font-mono" onclick={nextMonth} aria-label="Next month"
							>→</button
						>
						{#if !isCurrentMonth}
							<button class="cal-today-btn font-mono" onclick={goToday}>today</button>
						{/if}
					</div>
					{#if courseColors.length > 0}
						<div class="cal-legend">
							{#each courseColors as cc (cc.code)}
								<span class="cal-legend-item">
									<span class="cal-legend-dot" style="background: {cc.color}"></span>
									<span class="cal-legend-label font-mono">{cc.code}</span>
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<div class="cal-weekdays">
					{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day, i (i)}
						<span class="cal-weekday font-mono">{day}</span>
					{/each}
				</div>

				<div class="cal-days" role="grid" aria-label="Calendar grid">
					{#each Array.from({ length: startDay }, (_, i) => i) as i (i)}
						<div class="cal-day cal-day-empty" role="gridcell"></div>
					{/each}
					{#each Array.from({ length: daysInMonth }, (_, i) => i) as i (i)}
						{@const day = i + 1}
						{@const dayEvents = eventsForDay(day)}
						{@const dayLabel =
							dayEvents.length > 0
								? `${day} — ${dayEvents.map((e) => `${e.title} (${e.course})`).join(', ')}`
								: `${day} — no events`}
						<div
							class="cal-day"
							class:cal-today={isCurrentMonth && day === today}
							class:cal-overdue={isOverdue(day)}
							role="gridcell"
							tabindex={dayEvents.length > 0 ? 0 : undefined}
							aria-label={dayLabel}
						>
							<span class="cal-day-num font-mono">{day}</span>
							{#if dayEvents.length > 0}
								<div class="cal-dot-group" aria-hidden="true">
									{#each dayEvents as e (e.id)}
										<span
											class="cal-dot"
											style="background: {courseColor(e.course)}"
											title={e.title}
										></span>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if events.length > 0}
			<aside class="upcoming-panel">
				<SectionHead title="By course" />
				<div class="upcoming-list">
					{#each eventsByCourse as group (group.course)}
						<section class="course-group">
							<header class="course-group-head">
								<span class="course-group-dot" style="background: {courseColor(group.course)}"
								></span>
								<span class="course-group-code font-mono">{group.course}</span>
								<span class="course-group-count font-mono">{group.events.length}</span>
							</header>
							<div class="course-group-items">
								{#each group.events as ev (ev.id)}
									<div
										class="upcoming-item"
										class:upcoming-overdue={!isCurrentMonth
											? false
											: isCurrentMonth && ev.date < today}
									>
										<div class="upcoming-left">
											<span class="upcoming-name">{ev.title}</span>
											<div class="upcoming-meta">
												<span class="upcoming-type font-mono">{ev.type}</span>
											</div>
										</div>
										<span class="upcoming-date-num font-mono">{monthShort} {ev.date}</span>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			</aside>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 1100px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0;
		line-height: 1;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.5rem 0 0;
	}

	.cal-layout {
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: 1.5rem;
		align-items: start;
	}

	.cal-empty {
		padding: 3rem 2rem;
		text-align: center;
		border: 1px dashed var(--rule);
		background: var(--paper);
	}

	.empty-head {
		font-size: 1.5rem;
		color: var(--ink);
		margin: 0 0 0.5rem;
		line-height: 1;
	}

	.empty-text {
		font-size: 0.9rem;
		color: var(--ink-soft);
		margin: 0 0 0.5rem;
	}

	.cal-grid {
		padding: 1.5rem 1.5rem 1.75rem;
	}

	.cal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--ink);
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.cal-month {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.cal-month-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cal-nav-btn {
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font-size: 0.85rem;
		line-height: 1;
	}

	.cal-nav-btn:hover {
		border-color: var(--ink);
	}

	.cal-today-btn {
		margin-left: 0.25rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.cal-today-btn:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.cal-legend {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.cal-legend-item {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.cal-legend-dot {
		width: 8px;
		height: 8px;
	}

	.cal-legend-label {
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.cal-weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		margin-bottom: 4px;
	}

	.cal-weekday {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-align: center;
		padding: 4px 0;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.cal-days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.cal-day {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		padding: 4px;
		position: relative;
		min-height: 56px;
		transition: background 0.12s;
		border: 1px solid transparent;
	}

	.cal-day:hover {
		background: var(--paper-shelf);
	}

	.cal-day-empty {
		visibility: hidden;
	}

	.cal-today {
		background: var(--highlight-soft);
		border-color: var(--ink);
	}

	.cal-today:hover {
		background: var(--highlight-soft);
	}

	.cal-overdue {
		opacity: 0.45;
	}

	.cal-overdue .cal-day-num {
		text-decoration: line-through;
	}

	.cal-day-num {
		font-size: 0.72rem;
		color: var(--ink-soft);
		margin-bottom: 4px;
	}

	.cal-today .cal-day-num {
		color: var(--ink);
		font-weight: 600;
	}

	.cal-dot-group {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 2px;
	}

	.cal-dot {
		width: 6px;
		height: 6px;
	}

	.upcoming-panel {
		position: sticky;
		top: 2rem;
		padding: 0;
		margin-top: 0.5rem;
	}

	.upcoming-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.course-group {
		border: 1px solid var(--rule);
		padding: 0.75rem;
		background: var(--paper);
	}

	.course-group-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--rule);
	}

	.course-group-dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	.course-group-code {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink);
	}

	.course-group-count {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--ink-faint);
	}

	.course-group-items {
		display: flex;
		flex-direction: column;
	}

	.upcoming-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--rule);
	}

	.upcoming-item:last-child {
		border-bottom: none;
	}

	.upcoming-overdue {
		opacity: 0.45;
	}

	.upcoming-overdue .upcoming-name {
		text-decoration: line-through;
	}

	.upcoming-left {
		display: flex;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
	}

	.upcoming-name {
		font-size: 0.85rem;
		color: var(--ink);
		line-height: 1.3;
	}

	.upcoming-meta {
		display: flex;
		gap: 0.5rem;
	}

	.upcoming-type {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.upcoming-date-num {
		font-size: 0.7rem;
		color: var(--ink-soft);
		flex-shrink: 0;
		margin-top: 2px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	@media (max-width: 768px) {
		.cal-layout {
			grid-template-columns: 1fr;
		}

		.upcoming-panel {
			position: static;
		}
	}
</style>
