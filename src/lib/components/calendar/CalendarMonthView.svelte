<script lang="ts">
	import { weekNumber } from '$lib/calendar/week';
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
		viewYear,
		viewMonth,
		currentYear,
		currentMonthIdx,
		today,
		monthName,
		showYearPicker = false,
		selectedDay = null as number | null,
		focusedDay = null as number | null,
		isCurrentMonth = false,
		calendarRows,
		startDay,
		daysInMonth,
		selectedDayEvents = [] as CalendarEvent[],
		eventsByDay = new Map<string, CalendarEvent[]>(),
		colorByCode = new Map<string, string>(),
		isSelectedDay = (_day: number) => false,
		typeBadge = (_t: string) => '•',
		eventIsOverdue = (_event: CalendarEvent) => false,
		onPrevMonth = () => {},
		onNextMonth = () => {},
		onGoToday = () => {},
		onSelectDay = (_day: number) => {},
		onFocusedDay = (_day: number) => {},
		onToggleYearPicker = () => {},
		onYearChange = (_year: number) => {},
		onMonthChange = (_month: number) => {},
		onGridKeydown = (_e: KeyboardEvent) => {},
		onAddEvent = (_day: number) => {},
		onEditEvent = (_event: CalendarEvent) => {},
		onUpdateEventStatus = (_id: string, _status: string) => {},
		onDeleteEvent = (_id: string) => {},
		onDismissPopover = () => {}
	}: {
		viewYear: number;
		viewMonth: number;
		currentYear: number;
		currentMonthIdx: number;
		today: number;
		monthName: string;
		showYearPicker: boolean;
		selectedDay: number | null;
		focusedDay: number | null;
		isCurrentMonth: boolean;
		calendarRows: number;
		startDay: number;
		daysInMonth: number;
		selectedDayEvents: CalendarEvent[];
		eventsByDay: Map<string, CalendarEvent[]>;
		colorByCode: Map<string, string>;
		isSelectedDay: (day: number) => boolean;
		typeBadge: (t: string) => string;
		eventIsOverdue: (event: CalendarEvent) => boolean;
		onPrevMonth: () => void;
		onNextMonth: () => void;
		onGoToday: () => void;
		onSelectDay: (day: number) => void;
		onFocusedDay: (day: number) => void;
		onToggleYearPicker: () => void;
		onYearChange: (year: number) => void;
		onMonthChange: (month: number) => void;
		onGridKeydown: (e: KeyboardEvent) => void;
		onAddEvent: (day: number) => void;
		onEditEvent: (event: CalendarEvent) => void;
		onUpdateEventStatus: (id: string, status: string) => void;
		onDeleteEvent: (id: string) => void;
		onDismissPopover: () => void;
	} = $props();

	// O(1) color lookup — the Map is precomputed once per render in the workspace.
	function colorFor(code: string): string {
		return colorByCode.get(code) ?? 'var(--ink)';
	}

	// Roving tabindex: exactly one day cell is tabbable. Falls back to day 1
	// when the workspace's focused day lies outside the viewed month.
	const tabbableDay = $derived(
		focusedDay !== null && focusedDay >= 1 && focusedDay <= daysInMonth ? focusedDay : 1
	);
</script>

<div class="cal-grid surface-polaroid">
	<div class="cal-header">
		<div class="cal-month-nav">
			<button class="cal-nav-btn font-mono" onclick={onPrevMonth} aria-label="Previous month"
				>←</button
			>
			<button
				class="cal-month-label cal-month-label-btn"
				onclick={onToggleYearPicker}
				aria-label="Select month">{monthName} {viewYear}</button
			>
			<button class="cal-nav-btn font-mono" onclick={onNextMonth} aria-label="Next month">→</button>
			<button class="cal-today-btn font-mono" onclick={onGoToday}>today</button>
			<button
				class="cal-nav-btn-wide font-mono"
				onclick={() => onAddEvent(focusedDay ?? today)}
				style="margin-left: 0.25rem">+ event</button
			>
		</div>
	</div>

	{#if showYearPicker}
		<div class="cal-year-picker">
			<div class="cal-year-picker-grid">
				{#each Array.from({ length: 12 }, (_, m) => m) as m (m)}
					<button
						class="cal-year-picker-month font-mono"
						class:cal-year-picker-active={viewMonth === m}
						onclick={() => onMonthChange(m)}>{MONTHS[m].slice(0, 3)}</button
					>
				{/each}
			</div>
			<div class="cal-year-picker-years">
				<button
					class="cal-nav-btn font-mono"
					onclick={() => onYearChange(viewYear - 1)}
					aria-label="Previous year">←</button
				>
				<span class="cal-year-picker-year font-mono">{viewYear}</span>
				<button
					class="cal-nav-btn font-mono"
					onclick={() => onYearChange(viewYear + 1)}
					aria-label="Next year">→</button
				>
			</div>
		</div>
	{/if}

	<div class="cal-weekdays">
		<span class="cal-weekday cal-week-num-header font-mono">#</span>
		{#each DAYS_SHORT as day, i (i)}
			<span class="cal-weekday font-mono">{day}</span>
		{/each}
	</div>

	<div
		class="cal-grid-body"
		role="grid"
		tabindex={-1}
		aria-label="Calendar grid for {monthName} {viewYear}"
		onkeydown={onGridKeydown}
	>
		{#each Array.from({ length: calendarRows }, (_, row) => row) as row (row)}
			{@const rn = weekNumber(new Date(viewYear, viewMonth, Math.max(1, row * 7 + 1 - startDay)))}
			<div class="cal-grid-row" role="row">
				<span class="cal-week-num font-mono" title="Week {rn}" aria-hidden="true">{rn}</span>
				{#each Array.from({ length: 7 }, (_, col) => col) as col (col)}
					{@const day = row * 7 + col - startDay + 1}
					{@const dayEvents =
						day >= 1 && day <= daysInMonth
							? (eventsByDay.get(`${viewYear}-${viewMonth}-${day}`) ?? [])
							: []}
					{#if day < 1 || day > daysInMonth}
						<div class="cal-day cal-day-empty" aria-hidden="true"></div>
					{:else}
						<button
							class="cal-day"
							class:cal-today={isCurrentMonth && day === today}
							class:cal-overdue={dayEvents.some(eventIsOverdue)}
							class:cal-day-selected={isSelectedDay(day)}
							class:cal-day-focused={focusedDay === day}
							role="gridcell"
							tabindex={tabbableDay === day ? 0 : -1}
							aria-selected={isSelectedDay(day)}
							data-cal-day={day}
							aria-label={`${day} — ${dayEvents.map((e) => `${e.title} (${e.courseCode})`).join(', ')}`}
							onclick={() => onSelectDay(day)}
							onfocus={() => onFocusedDay(day)}
						>
							<span class="cal-day-num font-mono">{day}</span>
							{#if dayEvents.length > 0}
								<div class="cal-dot-group" aria-hidden="true">
									{#each dayEvents.slice(0, 4) as e (e.id)}
										<span
											class="cal-dot"
											style="background: {colorFor(e.courseCode)}"
											title="{e.title} — {e.courseCode}"
										></span>
									{/each}
									{#if dayEvents.length > 4}<span class="cal-dot-more font-mono"
											>+{dayEvents.length - 4}</span
										>{/if}
								</div>
								{#if dayEvents.length <= 2}
									{@const weightEv = dayEvents.find(
										(e) => e.gradeWeight != null && e.gradeWeight > 0
									)}
									{#if weightEv}
										<div
											class="cal-weight-bar"
											style="width: {Math.min(weightEv.gradeWeight ?? 0, 100)}%"
											title="{weightEv.gradeWeight}% of grade"
										></div>
									{/if}
								{/if}
							{/if}
						</button>
					{/if}
				{/each}
			</div>
		{/each}
	</div>

	<!-- Day popover -->
	{#if selectedDay !== null}
		<div class="cal-day-popover">
			<div class="cal-popover-head">
				<span class="cal-popover-date font-mono"
					>{new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', {
						weekday: 'short',
						month: 'short',
						day: 'numeric'
					})}</span
				>
				<span class="cal-popover-count font-mono"
					>{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</span
				>
				<button class="cal-popover-close" onclick={onDismissPopover} aria-label="Close">×</button>
			</div>
			<div class="cal-popover-list">
				{#each selectedDayEvents as ev (ev.id)}
					<div class="cal-popover-item" class:cal-popover-item-overdue={eventIsOverdue(ev)}>
						<span class="cal-popover-dot" style="background: {colorFor(ev.courseCode)}"></span>
						<div class="cal-popover-item-body">
							<div class="cal-popover-item-head">
								<span class="cal-popover-item-title"
									>{ev.title}
									<span class="cal-popover-type font-mono">{typeBadge(ev.type)}</span>
								</span>
								<div class="cal-popover-item-actions">
									<button
										class="cal-popover-action-btn"
										onclick={() => onEditEvent(ev)}
										aria-label="Edit event"
										title="Edit event">edit</button
									>
									{#if ev.status !== 'completed'}
										<button
											class="cal-popover-action-btn"
											onclick={() => onUpdateEventStatus(ev.id, 'completed')}
											aria-label="Mark done"
											title="Mark done">✓</button
										>
									{/if}
									{#if ev.status !== 'at_risk'}
										<button
											class="cal-popover-action-btn cal-popover-action-danger"
											onclick={() => onUpdateEventStatus(ev.id, 'at_risk')}
											aria-label="Flag at risk"
											title="Flag at risk">!</button
										>
									{/if}
									<button
										class="cal-popover-action-btn cal-popover-action-del"
										onclick={() => onDeleteEvent(ev.id)}
										aria-label="Delete"
										title="Delete">×</button
									>
								</div>
							</div>
							<div class="cal-popover-item-meta">
								<span class="cal-popover-item-course font-mono">{ev.courseCode}</span>
								{#if ev.time}<span class="cal-popover-item-time font-mono">{ev.time}</span>{/if}
								{#if ev.gradeWeight != null && ev.gradeWeight > 0}
									<span
										class="cal-popover-item-weight"
										style="background: {colorFor(ev.courseCode)}">{ev.gradeWeight}%</span
									>
								{/if}
								{#if ev.status === 'completed'}
									<span class="cal-popover-item-badge cal-badge-done">done</span>
								{:else if ev.status === 'at_risk'}
									<span class="cal-popover-item-badge cal-badge-risk">at risk</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="cal-popover-actions">
				<button class="cal-popover-add font-mono" onclick={() => onAddEvent(selectedDay!)}>
					+ add event
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
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
	/* ── Shared calendar toolbar (kept byte-identical across month/week/day views) ── */
	.cal-nav-btn {
		width: 1.75rem;
		height: 1.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font-size: 0.85rem;
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
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		transition:
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}
	.cal-today-btn:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.cal-nav-btn-wide {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.35rem 0.65rem;
		line-height: 1;
		transition: border-color 0.12s var(--ease-out-quart);
	}
	.cal-nav-btn-wide:hover {
		border-color: var(--ink);
	}
	/* ── End shared toolbar ── */

	.cal-month-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	/* Interactive month label is a real button — reset chrome, keep Inter */
	.cal-month-label-btn {
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
		transition: color 0.12s var(--ease-out-quart);
	}
	.cal-month-label-btn:hover {
		text-decoration: underline;
		text-decoration-color: var(--rule);
	}

	/* Year picker */
	.cal-year-picker {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		border: 1px solid var(--rule);
		background: var(--surface-paper);
	}
	.cal-year-picker-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.25rem;
	}
	.cal-year-picker-month {
		padding: 0.3rem 0.5rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.cal-year-picker-month:hover {
		border-color: var(--rule);
	}
	.cal-year-picker-active {
		background: var(--highlight) !important;
		border-color: var(--ink) !important;
		color: var(--ink) !important;
		font-weight: 600;
	}
	.cal-year-picker-years {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.cal-year-picker-year {
		font-size: 0.9rem;
		color: var(--ink);
		font-weight: 500;
		min-width: 3rem;
		text-align: center;
	}

	/* Weekday headers */
	.cal-weekdays {
		display: grid;
		grid-template-columns: 1.5rem repeat(7, 1fr);
		gap: 2px;
		margin-bottom: 4px;
	}
	.cal-week-num-header {
		font-size: 0.62rem;
		color: var(--ink-faint);
		text-align: center;
	}
	.cal-weekday {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-align: center;
		padding: 4px 0;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	/* Grid cells — each week is a role="row" wrapper so the grid exposes a
	   proper grid > row > gridcell structure to assistive tech. */
	.cal-grid-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cal-grid-row {
		display: grid;
		grid-template-columns: 1.5rem repeat(7, 1fr);
		gap: 2px;
	}
	.cal-week-num {
		font-size: 0.68rem;
		color: var(--ink-faint);
		text-align: center;
		padding: 2px;
		padding-top: 8px;
	}
	.cal-day {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 64px;
		padding: 3px;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.12s var(--ease-out-quart);
		text-align: center;
		overflow: hidden;
	}
	.cal-day:hover {
		background: var(--paper-shelf);
		z-index: 1;
	}
	.cal-day-empty {
		visibility: hidden;
		pointer-events: none;
	}
	.cal-today {
		background: var(--highlight-soft);
		border-color: var(--ink);
	}
	.cal-today:hover {
		background: var(--highlight-soft);
	}
	.cal-day-selected {
		border-color: var(--ink) !important;
		background: var(--surface-paper) !important;
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.cal-day-focused {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	.cal-day-num {
		font-size: 0.7rem;
		color: var(--ink-soft);
		margin-bottom: 1px;
	}
	.cal-today .cal-day-num {
		color: var(--ink);
		font-weight: 600;
	}
	.cal-overdue {
		opacity: 0.45;
	}
	.cal-overdue .cal-day-num {
		text-decoration: line-through;
		color: var(--accent);
	}
	.cal-dot-group {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 2px;
		margin-bottom: 1px;
	}
	.cal-dot {
		width: 4px;
		height: 4px;
	}
	.cal-dot-more {
		font-size: 0.5rem;
		color: var(--ink-faint);
		line-height: 1;
	}
	.cal-weight-bar {
		height: 2px;
		background: var(--ink);
		opacity: 0.2;
		position: absolute;
		bottom: 0;
		left: 0;
		max-width: 100%;
	}

	/* Popover */
	.cal-day-popover {
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		margin-top: 0.75rem;
		padding: 0.75rem;
	}
	.cal-popover-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--rule);
	}
	.cal-popover-date {
		font-size: 0.82rem;
		color: var(--ink);
		font-weight: 500;
	}
	.cal-popover-count {
		margin-left: auto;
		font-size: 0.68rem;
		color: var(--ink-faint);
	}
	.cal-popover-close {
		border: none;
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		padding: 0;
	}
	.cal-popover-close:hover {
		color: var(--ink);
	}
	.cal-popover-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.cal-popover-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.35rem 0;
	}
	.cal-popover-item-overdue {
		opacity: 0.5;
	}
	.cal-popover-dot {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		margin-top: 4px;
	}
	.cal-popover-item-body {
		flex: 1;
		min-width: 0;
	}
	.cal-popover-item-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.cal-popover-item-title {
		font-size: 0.82rem;
		color: var(--ink);
		line-height: 1.3;
	}
	.cal-popover-item-actions {
		display: flex;
		gap: 0.15rem;
		flex-shrink: 0;
	}
	.cal-popover-action-btn {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.65rem;
		width: 1.3rem;
		height: 1.3rem;
		display: grid;
		place-items: center;
	}
	.cal-popover-action-btn:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.cal-popover-action-danger:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.cal-popover-action-del:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.cal-popover-item-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 2px;
		align-items: center;
	}
	.cal-popover-item-course {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.cal-popover-item-time {
		font-size: 0.65rem;
		color: var(--ink-soft);
	}
	.cal-popover-item-weight {
		font-size: 0.6rem;
		color: var(--paper);
		padding: 0 4px;
		line-height: 1.3;
	}
	.cal-popover-item-badge {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 0 4px;
	}
	.cal-badge-done {
		background: var(--ok);
		color: var(--paper);
	}
	.cal-badge-risk {
		background: var(--accent);
		color: var(--paper);
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
	.cal-popover-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
		margin-top: 0.5rem;
		border-top: 1px solid var(--rule);
	}
	.cal-popover-add {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.68rem;
		padding: 0.25rem 0.5rem;
	}
	.cal-popover-add:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	@media (max-width: 768px) {
		.cal-day {
			min-height: 48px;
		}
	}
	@media (max-width: 480px) {
		.cal-weekdays {
			grid-template-columns: repeat(7, 1fr);
			gap: 1px;
		}
		.cal-grid-row {
			grid-template-columns: repeat(7, 1fr);
			gap: 1px;
		}
		.cal-week-num {
			display: none;
		}
		.cal-week-num-header {
			display: none;
		}
		.cal-day {
			min-height: 36px;
			padding: 1px;
			font-size: 0.65rem;
		}
		.cal-day-num {
			font-size: 0.6rem;
		}
		.cal-grid {
			padding: 0.75rem;
		}
	}

	/* Touch: raise toolbar + popover actions to the 44px WCAG hit-area floor. */
	@media (pointer: coarse) {
		.cal-nav-btn,
		.cal-today-btn,
		.cal-nav-btn-wide {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
		.cal-popover-action-btn {
			width: 2.75rem;
			height: 2.75rem;
		}
		.cal-popover-close {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
	}
</style>
