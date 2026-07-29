<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import { MoreHorizontal, X } from '@lucide/svelte';
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
		onEditEvent: (event: CalendarEvent) => void;
		onUpdateEventStatus: (id: string, status: string) => void;
		onDeleteEvent: (id: string) => void;
		onDismissPopover: () => void;
	} = $props();

	// O(1) color lookup — the Map is precomputed once per render in the workspace.
	function colorFor(code: string): string {
		return colorByCode.get(code) ?? 'var(--ink)';
	}

	function typeLabel(type: string): string {
		return type === 'study_session'
			? 'Study session'
			: type.charAt(0).toUpperCase() + type.slice(1);
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
			<button class="cal-nav-btn" onclick={onPrevMonth} aria-label="Previous month">←</button>
			<button
				class="cal-month-label cal-month-label-btn"
				onclick={onToggleYearPicker}
				aria-label="Select month"
				aria-expanded={showYearPicker}
				aria-controls="calendar-date-picker">{monthName} {viewYear}</button
			>
			<button class="cal-nav-btn" onclick={onNextMonth} aria-label="Next month">→</button>
			<button class="cal-today-btn" onclick={onGoToday}>today</button>
		</div>
	</div>

	{#if showYearPicker}
		<div id="calendar-date-picker" class="cal-year-picker">
			<div class="cal-year-picker-grid">
				{#each Array.from({ length: 12 }, (_, m) => m) as m (m)}
					<button
						class="cal-year-picker-month"
						class:cal-year-picker-active={viewMonth === m}
						onclick={() => onMonthChange(m)}>{MONTHS[m].slice(0, 3)}</button
					>
				{/each}
			</div>
			<div class="cal-year-picker-years">
				<button
					class="cal-nav-btn"
					onclick={() => onYearChange(viewYear - 1)}
					aria-label="Previous year">←</button
				>
				<span class="cal-year-picker-year font-numeric">{viewYear}</span>
				<button
					class="cal-nav-btn"
					onclick={() => onYearChange(viewYear + 1)}
					aria-label="Next year">→</button
				>
			</div>
		</div>
	{/if}

	<div class="cal-weekdays">
		{#each DAYS_SHORT as day, i (i)}
			<span class="cal-weekday">{day}</span>
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
			<div class="cal-grid-row" role="row">
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
							aria-label={`${new Date(viewYear, viewMonth, day).toLocaleDateString('en-US', {
								weekday: 'long',
								month: 'long',
								day: 'numeric',
								year: 'numeric'
							})}. ${dayEvents.length ? dayEvents.map((event) => `${event.title} (${event.courseCode})`).join(', ') : 'No events'}`}
							onclick={() => onSelectDay(day)}
							onfocus={() => onFocusedDay(day)}
						>
							<span class="cal-day-num font-numeric">{day}</span>
							{#if dayEvents.length > 0}
								<div class="cal-event-chips" aria-hidden="true">
									{#each dayEvents.slice(0, 2) as event (event.id)}
										<span
											class="cal-event-chip"
											class:cal-event-chip-done={event.status === 'completed'}
											class:cal-event-chip-risk={event.status === 'at_risk'}
											style="border-left-color: {colorFor(event.courseCode)}"
										>
											<strong>{event.courseCode}</strong>
											<span>{event.title}</span>
										</span>
									{/each}
									{#if dayEvents.length > 2}<span class="cal-event-more font-numeric"
											>+{dayEvents.length - 2} more</span
										>{/if}
								</div>
								<div class="cal-dot-group" aria-hidden="true">
									{#each dayEvents.slice(0, 4) as event (event.id)}
										<span class="cal-dot" style="background: {colorFor(event.courseCode)}"></span>
									{/each}
									{#if dayEvents.length > 4}<span class="cal-dot-more font-numeric"
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
		<div
			class="cal-day-popover"
			role="region"
			aria-label={`Events for ${new Date(viewYear, viewMonth, selectedDay).toLocaleDateString(
				'en-US',
				{
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				}
			)}`}
		>
			<div class="cal-popover-head">
				<span class="cal-popover-date"
					>{new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', {
						weekday: 'short',
						month: 'short',
						day: 'numeric'
					})}</span
				>
				<span class="cal-popover-count font-numeric"
					>{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</span
				>
				<button
					class="cal-popover-close"
					onclick={onDismissPopover}
					aria-label="Close selected day"
					title="Close"
				>
					<X class="size-[var(--icon-sm)]" aria-hidden="true" />
				</button>
			</div>
			<div class="cal-popover-list">
				{#if selectedDayEvents.length === 0}
					<div class="cal-empty-day">
						<span aria-hidden="true">✓</span>
						<strong>Nothing due.</strong>
						<small>A clear page for now.</small>
					</div>
				{/if}
				{#each selectedDayEvents as event (event.id)}
					<article class="cal-popover-item" class:cal-popover-item-overdue={eventIsOverdue(event)}>
						<div class="cal-popover-item-body">
							<div class="cal-popover-item-head">
								<div>
									<h3 class="cal-popover-item-title">{event.title}</h3>
									<div class="cal-popover-item-meta">
										<span class="cal-course-swatch" style="background: {colorFor(event.courseCode)}"
										></span>
										<span class="cal-popover-item-course">{event.courseCode}</span>
										<span>{typeLabel(event.type)}</span>
										{#if event.time}<span class="font-numeric">{event.time}</span>{/if}
										{#if event.gradeWeight != null && event.gradeWeight > 0}
											<span>{event.gradeWeight}% of grade</span>
										{/if}
										{#if event.status === 'completed'}
											<span class="cal-popover-item-badge cal-badge-done">Done</span>
										{:else if event.status === 'at_risk'}
											<span class="cal-popover-item-badge cal-badge-risk">At risk</span>
										{/if}
									</div>
								</div>
								<div class="cal-popover-item-actions">
									{#if event.status !== 'completed'}
										<button
											class="cal-popover-done"
											onclick={() => onUpdateEventStatus(event.id, 'completed')}>Mark done</button
										>
									{/if}
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="cal-event-menu-trigger"
											aria-label={`More actions for ${event.title}`}
											><MoreHorizontal
												class="size-[var(--icon-sm)]"
												aria-hidden="true"
											/></DropdownMenu.Trigger
										>
										<DropdownMenu.Portal>
											<DropdownMenu.Content
												sideOffset={4}
												class="z-[var(--z-dropdown)] grid w-40 border border-[var(--ink)] bg-[var(--paper)] shadow-[3px_3px_0_var(--shadow-ink)]"
											>
												<DropdownMenu.Item
													class="min-h-9 cursor-pointer border-b border-[var(--rule)] px-2.5 py-2 text-[var(--text-caption)] outline-none data-[highlighted]:bg-[var(--highlight-soft)]"
													onclick={() => onEditEvent(event)}>Edit</DropdownMenu.Item
												>
												<DropdownMenu.Item
													class="min-h-9 cursor-pointer border-b border-[var(--rule)] px-2.5 py-2 text-[var(--text-caption)] outline-none data-[highlighted]:bg-[var(--highlight-soft)]"
													onclick={() =>
														onUpdateEventStatus(
															event.id,
															event.status === 'at_risk' ? 'pending' : 'at_risk'
														)}
												>
													{event.status === 'at_risk' ? 'Clear risk flag' : 'Flag as at risk'}
												</DropdownMenu.Item>
												<DropdownMenu.Item
													class="min-h-9 cursor-pointer px-2.5 py-2 text-[var(--accent)] text-[var(--text-caption)] outline-none data-[highlighted]:bg-[var(--highlight-soft)]"
													onclick={() => onDeleteEvent(event.id)}>Delete</DropdownMenu.Item
												>
											</DropdownMenu.Content>
										</DropdownMenu.Portal>
									</DropdownMenu.Root>
								</div>
							</div>
						</div>
					</article>
				{/each}
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
		font-size: var(--text-caption);
		text-transform: none;
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
		font-size: var(--text-small);
		color: var(--ink);
		font-weight: 500;
		min-width: 3rem;
		text-align: center;
	}

	/* Weekday headers */
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

	/* Grid cells — each week is a role="row" wrapper so the grid exposes a
	   proper grid > row > gridcell structure to assistive tech. */
	.cal-grid-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.cal-grid-row {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 2px;
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
		font-size: var(--text-caption);
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
	.cal-event-chips {
		display: grid;
		width: 100%;
		gap: 2px;
		margin-top: 2px;
	}
	.cal-event-chip {
		display: flex;
		min-width: 0;
		gap: 0.25rem;
		padding: 2px 3px;
		overflow: hidden;
		border-left: 2px solid var(--ink);
		background: var(--paper-shelf);
		font-size: var(--text-caption);
		line-height: 1.25;
		text-align: left;
		transition:
			transform 140ms var(--ease-out-quart),
			background 140ms var(--ease-out-quart);
	}
	.cal-day:hover .cal-event-chip {
		transform: translateX(1px);
		background: var(--highlight-soft);
	}
	.cal-event-chip strong {
		flex: 0 0 auto;
		font-family: var(--font-body);
		font-size: var(--text-caption);
	}
	.cal-event-chip span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cal-event-chip-done {
		opacity: 0.55;
		text-decoration: line-through;
	}
	.cal-event-chip-risk {
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.cal-event-more {
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-align: left;
	}
	.cal-dot-group {
		display: none;
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
		font-size: var(--text-caption);
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
		animation: calendar-reveal 180ms var(--ease-out-quart);
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
		font-size: var(--text-caption);
		color: var(--ink);
		font-weight: 500;
	}
	.cal-popover-count {
		margin-left: auto;
		font-size: var(--text-caption);
		color: var(--ink-faint);
	}
	.cal-popover-close {
		display: grid;
		width: var(--control-sm);
		height: var(--control-sm);
		place-items: center;
		padding: 0;
		border: 1px solid transparent;
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
	}
	.cal-popover-close:hover {
		color: var(--ink);
	}
	.cal-popover-list {
		display: grid;
		gap: 0.6rem;
	}
	.cal-empty-day {
		display: grid;
		justify-items: center;
		padding: 1.25rem;
		border: 1px dashed var(--rule);
		color: var(--ink-soft);
		text-align: center;
	}
	.cal-empty-day > span {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		margin-bottom: 0.4rem;
		border: 1px solid var(--ink);
		border-radius: 50%;
		color: var(--ink);
		font-weight: 700;
	}
	.cal-empty-day strong {
		color: var(--ink);
	}
	.cal-empty-day small {
		margin-top: 0.15rem;
		font-size: var(--text-caption);
	}
	.cal-popover-item {
		padding: 0.8rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.cal-popover-item-overdue {
		opacity: 0.6;
	}
	.cal-popover-item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.cal-popover-item-title {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: var(--text-small);
		font-weight: 700;
		line-height: 1.25;
	}
	.cal-popover-item-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.5rem;
		align-items: center;
		margin-top: 0.3rem;
		color: var(--ink-soft);
		font-size: var(--text-caption);
	}
	.cal-course-swatch {
		width: 0.5rem;
		height: 0.5rem;
		flex: 0 0 0.5rem;
	}
	.cal-popover-item-course {
		color: var(--ink);
		font-weight: 700;
		letter-spacing: normal;
	}
	.cal-popover-item-badge {
		padding: 0.1rem 0.35rem;
		font-size: var(--text-caption);
		font-weight: 700;
		text-transform: none;
		letter-spacing: normal;
	}
	.cal-badge-done {
		background: color-mix(in srgb, var(--ok) 12%, transparent);
		color: var(--ok);
		animation: calendar-check 240ms var(--ease-out-quart);
	}
	.cal-badge-risk {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
	}
	.cal-popover-item-actions {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex: 0 0 auto;
	}
	.cal-popover-done,
	:global(.cal-event-menu-trigger) {
		min-height: 32px;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: var(--text-caption);
		font-weight: 600;
		cursor: pointer;
	}
	.cal-popover-done:hover,
	:global(.cal-event-menu-trigger:hover) {
		border-color: var(--ink);
		color: var(--ink);
	}
	:global(.cal-event-menu-trigger) {
		display: grid;
		min-width: 32px;
		place-items: center;
		padding-inline: 0.4rem;
	}

	@keyframes calendar-reveal {
		from {
			transform: translateY(-3px);
			opacity: 0;
		}
	}
	@keyframes calendar-check {
		50% {
			transform: scale(1.08);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cal-day-popover,
		.cal-badge-done {
			animation: none;
		}
		.cal-event-chip {
			transition: none;
		}
	}

	@media (max-width: 768px) {
		.cal-day {
			min-height: 48px;
		}
	}
	@media (max-width: 480px) {
		.cal-weekdays {
			grid-template-columns: repeat(7, minmax(0, 1fr));
			gap: 1px;
		}
		.cal-grid-row {
			grid-template-columns: repeat(7, minmax(0, 1fr));
			gap: 1px;
		}
		.cal-day {
			min-height: 36px;
			padding: 1px;
			font-size: var(--text-caption);
		}
		.cal-day-num {
			font-size: var(--text-caption);
		}
		.cal-event-chips,
		.cal-weight-bar {
			display: none;
		}
		.cal-dot-group {
			display: flex;
		}
		.cal-grid {
			padding: 0.75rem;
		}
		.cal-popover-item-head {
			align-items: flex-start;
			flex-direction: column;
		}
		.cal-popover-item-actions {
			width: 100%;
		}
		.cal-popover-done {
			flex: 1;
		}
	}

	/* Touch: raise toolbar + popover actions to the 44px WCAG hit-area floor. */
	@media (pointer: coarse) {
		.cal-nav-btn,
		.cal-today-btn {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
		.cal-popover-done,
		:global(.cal-event-menu-trigger) {
			min-height: 2.75rem;
		}
		.cal-popover-close {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
	}
</style>
