<script lang="ts">
	import type { CalendarDate } from '$lib/calendar/domain';
	import type { CalendarEvent } from './types';

	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	let {
		weekDays = [] as CalendarDate[],
		currentYear,
		currentMonthIdx,
		today,
		eventsByDay = new Map<string, CalendarEvent[]>(),
		colorByCode = new Map<string, string>(),
		onShiftWeek = (_days: -7 | 7) => {},
		onGoToday = () => {},
		onNavigateToDay = (_day: CalendarDate) => {}
	}: {
		weekDays: CalendarDate[];
		currentYear: number;
		currentMonthIdx: number;
		today: number;
		eventsByDay: Map<string, CalendarEvent[]>;
		colorByCode: Map<string, string>;
		onShiftWeek: (days: -7 | 7) => void;
		onGoToday: () => void;
		onNavigateToDay: (day: CalendarDate) => void;
	} = $props();

	// O(1) lookups — both Maps are precomputed once per render in the workspace.
	function colorFor(code: string): string {
		return colorByCode.get(code) ?? 'var(--ink)';
	}
	function eventsFor(day: CalendarDate): CalendarEvent[] {
		return eventsByDay.get(`${day.year}-${day.month}-${day.date}`) ?? [];
	}
</script>

<div class="surface-polaroid" style="padding: 1.5rem">
	<div class="cal-header" style="margin-bottom: 0.75rem">
		<div class="cal-month-nav">
			<button class="cal-nav-btn" onclick={() => onShiftWeek(-7)} aria-label="Previous week"
				>←</button
			>
			<span class="cal-month-label">
				{new Date(weekDays[0].year, weekDays[0].month, weekDays[0].date).toLocaleDateString(
					'en-US',
					{ month: 'short', day: 'numeric' }
				)}–{new Date(
					weekDays[weekDays.length - 1].year,
					weekDays[weekDays.length - 1].month,
					weekDays[weekDays.length - 1].date
				).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
			</span>
			<button class="cal-nav-btn" onclick={() => onShiftWeek(7)} aria-label="Next week">→</button>
			<button class="cal-today-btn" onclick={onGoToday}>today</button>
		</div>
	</div>
	<div class="cal-weekdays">
		{#each DAYS_SHORT as day, i (i)}<span class="cal-weekday">{day}</span>{/each}
	</div>
	<div class="cal-week-grid">
		{#each weekDays as day (`${day.year}-${day.month}-${day.date}`)}
			{@const evts = eventsFor(day)}
			<button
				class="cal-week-cell"
				class:cal-today={day.year === currentYear &&
					day.month === currentMonthIdx &&
					day.date === today}
				class:cal-week-cell-empty={evts.length === 0}
				onclick={() => onNavigateToDay(day)}
			>
				<div class="cal-week-cell-head">
					<span class="cal-week-cell-day"
						>{DAYS_SHORT[new Date(day.year, day.month, day.date).getDay()]}</span
					><span class="cal-week-cell-date">{MONTHS[day.month].slice(0, 3)} {day.date}</span>
				</div>
				<div class="cal-week-cell-events">
					{#each evts.slice(0, 2) as ev (ev.id)}
						<span class="cal-week-cell-event" style="border-color: {colorFor(ev.courseCode)}">
							<span class="cal-week-cell-title">{ev.title}</span>
							{#if ev.time}<span class="cal-week-cell-time font-numeric">{ev.time}</span>{/if}
							{#if ev.gradeWeight != null && ev.gradeWeight > 0}
								<span class="cal-week-cell-weight font-numeric">{ev.gradeWeight}%</span>
							{/if}
						</span>
					{/each}
					{#if evts.length > 2}<span class="cal-week-cell-more font-numeric"
							>+{evts.length - 2} more</span
						>{/if}
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
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
	/* ── Shared calendar toolbar (kept byte-identical across month/week/day views) ── */
	.cal-nav-btn {
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font-size: var(--text-caption);
		line-height: 1;
		transition:
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}
	.cal-nav-btn:hover {
		border-color: var(--ink);
	}
	.cal-month-label {
		font-family: var(--font-body);
		font-size: 1.6rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1;
		letter-spacing: -0.01em;
	}
	.cal-today-btn {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
		transition:
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}
	.cal-today-btn:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	/* ── End shared toolbar ── */

	.cal-month-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.cal-weekdays {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 2px;
		margin-bottom: 4px;
	}
	.cal-weekday {
		font-size: var(--text-caption);
		color: var(--ink-faint);
		text-align: center;
		padding: 4px 0;
		text-transform: none;
		letter-spacing: normal;
	}
	.cal-week-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
	}
	.cal-week-cell {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex-direction: column;
		min-height: 120px;
		padding: 6px;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		transition: background 0.12s var(--ease-out-quart);
	}
	.cal-week-cell:hover {
		background: var(--paper-shelf);
	}
	.cal-week-cell-empty {
		opacity: 0.45;
	}
	.cal-today {
		background: var(--highlight-soft);
		border-color: var(--ink);
	}
	.cal-today:hover {
		background: var(--highlight-soft);
	}
	.cal-week-cell-head {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-bottom: 4px;
	}
	.cal-week-cell-day {
		font-size: var(--text-caption);
		font-weight: 600;
		color: var(--ink);
		text-transform: none;
	}
	.cal-week-cell-date {
		font-size: var(--text-caption);
		color: var(--ink-soft);
	}
	.cal-week-cell-events {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex: 1;
		flex-direction: column;
		gap: 2px;
	}
	.cal-week-cell-event {
		display: block;
		min-width: 0;
		max-width: 100%;
		padding: 2px 4px;
		border: 1px solid var(--rule);
		font-size: var(--text-caption);
		line-height: 1.2;
		background: var(--paper-shelf);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cal-week-cell-title {
		display: block;
		overflow: hidden;
		color: var(--ink);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cal-week-cell-time {
		color: var(--ink-faint);
		margin-left: 0.25rem;
		font-size: var(--text-caption);
	}
	.cal-week-cell-weight {
		color: var(--ink-soft);
		margin-left: auto;
		font-size: var(--text-caption);
	}
	.cal-week-cell-more {
		font-size: var(--text-caption);
		color: var(--ink-faint);
		padding: 2px 4px;
	}

	@media (max-width: 768px) {
		.cal-week-cell {
			min-height: 80px;
		}
	}

	/* Small screens: seven ~29px columns are unreadable, so the week becomes a
	   vertical list — one row per day, day label left, events as full-width chips. */
	@media (max-width: 640px) {
		.cal-weekdays {
			display: none;
		}
		.cal-week-grid {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}
		.cal-week-cell {
			flex-direction: row;
			align-items: flex-start;
			gap: 0.65rem;
			min-height: 0;
			padding: 0.55rem 0.65rem;
		}
		.cal-week-cell-head {
			flex-direction: column;
			align-items: flex-start;
			gap: 1px;
			margin-bottom: 0;
			min-width: 3.4rem;
			flex-shrink: 0;
		}
		.cal-week-cell-events {
			flex: 1;
			min-width: 0;
			gap: 0.3rem;
		}
		.cal-week-cell-event {
			display: flex;
			align-items: baseline;
			gap: 0.35rem;
			padding: 0.35rem 0.45rem;
			white-space: normal;
			overflow: visible;
			text-overflow: clip;
		}
		.cal-week-cell-title {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.cal-week-cell-weight {
			margin-left: 0;
		}
	}

	/* Touch: raise toolbar buttons to the 44px WCAG hit-area floor. */
	@media (pointer: coarse) {
		.cal-nav-btn,
		.cal-today-btn {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
	}
</style>
