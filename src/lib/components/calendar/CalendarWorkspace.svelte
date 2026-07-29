<script lang="ts">
	import { page } from '$app/stores';
	import { ToggleGroup } from 'bits-ui';
	import { resolveRoute } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import {
		gradeWeightByCourse,
		isEventOverdue,
		shiftCalendarDate,
		upcomingEvents,
		weekDates,
		type CalendarDate
	} from '$lib/calendar/domain';
	import { AlertDialog } from '$lib/components/ui';
	import type { CalendarEvent, GradeStakesGroup } from './types';
	import CalendarEditor from './CalendarEditor.svelte';
	import CalendarMonthView from './CalendarMonthView.svelte';
	import CalendarWeekView from './CalendarWeekView.svelte';
	import CalendarDayView from './CalendarDayView.svelte';
	import CalendarSidebar from './CalendarSidebar.svelte';

	let {
		data
	}: {
		data: {
			events?: CalendarEvent[];
			courseColors?: { id: string; code: string; color: string; name: string }[];
		};
	} = $props();
	const courseColors = $derived(data.courseColors ?? []);

	const now = new Date();
	const today = now.getDate();
	const currentMonthIdx = now.getMonth();
	const currentYear = now.getFullYear();
	const currentDate: CalendarDate = { year: currentYear, month: currentMonthIdx, date: today };

	let viewYear = $state(currentYear);
	let viewMonth = $state(currentMonthIdx);
	let viewMode = $state<'month' | 'week' | 'day'>('month');
	let selectedDay = $state<number | null>(null);
	let focusedDay = $state<number | null>(now.getDate());
	let showYearPicker = $state(false);

	onMount(() => {
		const m = $page.url.searchParams.get('month');
		const y = $page.url.searchParams.get('year');
		let hasValidMonth = false;
		let hasValidYear = false;
		if (m !== null) {
			const parsed = parseInt(m, 10);
			if (parsed >= 0 && parsed <= 11) {
				viewMonth = parsed;
				hasValidMonth = true;
			}
		}
		if (y !== null) {
			const parsed = parseInt(y, 10);
			if (parsed >= 1970 && parsed <= 2100) {
				viewYear = parsed;
				hasValidYear = true;
			}
		}
		if ($page.url.searchParams.get('new') === '1') {
			if (!hasValidMonth && !hasValidYear) {
				viewMonth = currentMonthIdx;
				viewYear = currentYear;
			}
			const viewingCurrentMonth = viewMonth === currentMonthIdx && viewYear === currentYear;
			selectedDay = viewingCurrentMonth ? today : 1;
			focusedDay = selectedDay;
			addingEvent = true;
		}
	});
	let filterCourses = $state<string[]>([]);
	let transitioning = $state(false);

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

	const monthName = $derived(MONTHS[viewMonth]);
	const daysInMonth = $derived(new Date(viewYear, viewMonth + 1, 0).getDate());
	const startDay = $derived(new Date(viewYear, viewMonth, 1).getDay());
	const isCurrentMonth = $derived(viewYear === currentYear && viewMonth === currentMonthIdx);

	function transitionTo(fn: () => void) {
		if (transitioning) return;
		transitioning = true;
		fn();
		setTimeout(() => (transitioning = false), 200);
	}

	function prevMonth() {
		transitionTo(() => {
			if (viewMonth === 0) {
				viewMonth = 11;
				viewYear--;
			} else {
				viewMonth--;
			}
			showYearPicker = false;
			selectedDay = null;
		});
	}

	function nextMonth() {
		transitionTo(() => {
			if (viewMonth === 11) {
				viewMonth = 0;
				viewYear++;
			} else {
				viewMonth++;
			}
			showYearPicker = false;
			selectedDay = null;
		});
	}

	function goToday() {
		transitionTo(() => {
			viewYear = currentYear;
			viewMonth = currentMonthIdx;
			selectedDay = today;
			focusedDay = today;
			showYearPicker = false;
		});
	}

	const events = $derived(data.events ?? []);
	const allCourseCodes = $derived([...new Set(events.map((e) => e.courseCode))].sort());
	const hasActiveFilter = $derived(filterCourses.length > 0);

	function clearFilters() {
		filterCourses = [];
	}

	const PALETTE = ['var(--ink)', 'var(--accent)', 'var(--ink-soft)', 'var(--ink-faint)'];

	// Resolved once per render — cells read O(1) instead of a find() per event.
	const colorByCode = $derived.by(() => {
		const map = new Map<string, string>();
		for (const c of courseColors) map.set(c.code, c.color);
		for (const code of allCourseCodes) {
			if (!map.has(code)) {
				map.set(code, PALETTE[(code.charCodeAt(0) + (code.charCodeAt(1) || 0)) % PALETTE.length]);
			}
		}
		return map;
	});

	function courseColor(code: string): string {
		return colorByCode.get(code) ?? 'var(--ink)';
	}

	const filteredEvents = $derived(
		!hasActiveFilter ? events : events.filter((e) => filterCourses.includes(e.courseCode))
	);

	// Bucketed once per render, keyed `${year}-${month}-${date}` (same key format
	// the week view already uses), so month/week cells do a Map lookup per day
	// instead of 2–3 full array scans per cell per render.
	const eventsByDay = $derived.by(() => {
		const map = new Map<string, CalendarEvent[]>();
		for (const e of filteredEvents) {
			const key = `${e.year}-${e.month}-${e.date}`;
			const bucket = map.get(key);
			if (bucket) bucket.push(e);
			else map.set(key, [e]);
		}
		return map;
	});

	const totalInViewedMonth = $derived(
		filteredEvents.filter((e) => e.month === viewMonth && e.year === viewYear).length
	);
	const selectedDayEvents = $derived(
		selectedDay !== null ? (eventsByDay.get(`${viewYear}-${viewMonth}-${selectedDay}`) ?? []) : []
	);

	// ── Intelligence: crunch, stakes, gaps ──
	const upcoming = $derived(upcomingEvents(filteredEvents, currentDate));

	const gradeStakes = $derived(upcoming.filter((e) => e.gradeWeight != null && e.gradeWeight > 0));
	const gradeStakesByCourse = $derived(gradeWeightByCourse(gradeStakes));
	const atRiskCount = $derived(filteredEvents.filter((e) => e.status === 'at_risk').length);
	const overdueCount = $derived(
		filteredEvents.filter((e) => isEventOverdue(e, currentDate)).length
	);

	function eventIsOverdue(event: CalendarEvent) {
		return isEventOverdue(event, currentDate);
	}

	function isSelectedDay(day: number) {
		return selectedDay === day;
	}

	function selectDay(day: number) {
		selectedDay = selectedDay === day ? null : day;
		focusedDay = day;
	}

	// ── Week view ──
	const weekDays = $derived(
		weekDates({ year: viewYear, month: viewMonth, date: focusedDay ?? today })
	);

	function shiftWeek(days: -7 | 7) {
		const target = shiftCalendarDate(
			{ year: viewYear, month: viewMonth, date: focusedDay ?? today },
			days
		);
		viewYear = target.year;
		viewMonth = target.month;
		focusedDay = target.date;
		selectedDay = target.date;
	}

	// ── Day view ──
	const viewDay = $derived(selectedDay ?? focusedDay ?? today);
	const todayEvents = $derived(
		filteredEvents
			.filter((e) => e.month === viewMonth && e.year === viewYear && e.date === viewDay)
			.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
	);

	function prevDay() {
		const d = (selectedDay ?? focusedDay ?? today) - 1;
		if (d < 1) {
			prevMonth();
			selectedDay = daysInMonth;
			focusedDay = daysInMonth;
		} else {
			selectedDay = d;
			focusedDay = d;
		}
	}

	function nextDay() {
		const d = (selectedDay ?? focusedDay ?? today) + 1;
		if (d > daysInMonth) {
			nextMonth();
			selectedDay = 1;
			focusedDay = 1;
		} else {
			selectedDay = d;
			focusedDay = d;
		}
	}

	// ── Keyboard nav ──
	// Roving tabindex lives in MonthView (focusedDay's button is the only
	// tabbable cell); arrow keys move real DOM focus so screen readers
	// announce each day as it is reached.
	function focusDayButton(day: number) {
		document.querySelector<HTMLElement>(`[data-cal-day="${day}"]`)?.focus();
	}

	function onGridKeydown(e: KeyboardEvent) {
		const current = focusedDay ?? today;
		let next: number | null = null;
		switch (e.key) {
			case 'ArrowRight':
				next = Math.min(current + 1, daysInMonth);
				break;
			case 'ArrowLeft':
				next = Math.max(current - 1, 1);
				break;
			case 'ArrowDown':
				next = Math.min(current + 7, daysInMonth);
				break;
			case 'ArrowUp':
				next = Math.max(current - 7, 1);
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				selectDay(current);
				return;
		}
		if (next !== null) {
			e.preventDefault();
			focusedDay = next;
			focusDayButton(next);
		}
	}

	// ── CRUD ──
	let addingEvent = $state(false);
	let editorReturnFocus: HTMLElement | null = null;
	let addFormTitle = $state('');
	let addFormCourseId = $state('');
	let addFormCourse = $state('');
	let addFormType = $state('assignment');
	let addFormTime = $state('');
	let addFormWeight = $state('');
	let editingEventId = $state<string | null>(null);
	let mutationError = $state<string | null>(null);
	let actionNotice = $state('');
	let undoAction = $state<(() => Promise<void>) | null>(null);
	let savingEvent = $state(false);

	function showNotice(message: string, undo: (() => Promise<void>) | null = null) {
		actionNotice = message;
		undoAction = undo;
	}

	function completionMessage(id: string) {
		const messages = ['Done — one less thing.', 'Checked off.', 'Deadline cleared.'];
		return messages[id.length % messages.length];
	}

	function resetEventForm() {
		addFormTitle = '';
		addFormCourseId = '';
		addFormCourse = '';
		addFormType = 'assignment';
		addFormTime = '';
		addFormWeight = '';
		editingEventId = null;
		addingEvent = false;
		const returnTarget = editorReturnFocus;
		editorReturnFocus = null;
		if (returnTarget) void tick().then(() => returnTarget.focus());
	}

	function openAddEvent(day = focusedDay ?? today) {
		if (courseColors.length === 0) {
			mutationError = 'Add a course before creating calendar events.';
			return;
		}
		editorReturnFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		selectedDay = day;
		focusedDay = day;
		editingEventId = null;
		mutationError = null;
		addingEvent = true;
	}

	function openEditEvent(event: CalendarEvent) {
		editorReturnFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		viewYear = event.year;
		viewMonth = event.month;
		selectedDay = event.date;
		focusedDay = event.date;
		editingEventId = event.id;
		addFormTitle = event.title;
		addFormCourseId = event.courseId ?? '';
		addFormCourse = event.courseCode;
		addFormType = event.type;
		addFormTime = event.time ?? '';
		addFormWeight = event.gradeWeight == null ? '' : String(event.gradeWeight);
		mutationError = null;
		addingEvent = true;
	}

	async function addEventSubmit() {
		if (!addFormTitle.trim() || !addFormCourse.trim() || selectedDay === null || savingEvent)
			return;
		savingEvent = true;
		mutationError = null;
		try {
			const res = await fetch(
				editingEventId
					? `/api/calendar/events/${encodeURIComponent(editingEventId)}`
					: '/api/calendar/events',
				{
					method: editingEventId ? 'PUT' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						courseId: addFormCourseId,
						courseCode: addFormCourse.trim(),
						title: addFormTitle.trim(),
						type: addFormType,
						date: selectedDay,
						month: viewMonth,
						year: viewYear,
						time: addFormTime.trim() || undefined,
						gradeWeight: addFormWeight.trim() ? parseInt(addFormWeight.trim()) : undefined
					})
				}
			);
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				mutationError = body?.error ?? 'Could not save this event.';
				return;
			}
			const wasEditing = editingEventId !== null;
			resetEventForm();
			await invalidateAll();
			showNotice(wasEditing ? 'Changes saved.' : 'Pinned to your calendar.');
		} catch {
			mutationError = 'Couldn’t save the event. Check your connection and try again.';
		} finally {
			savingEvent = false;
		}
	}

	async function updateEventStatus(id: string, status: string, announce = true) {
		mutationError = null;
		const previousStatus = events.find((event) => event.id === id)?.status ?? 'pending';
		try {
			const response = await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				mutationError = body?.error ?? 'Could not update this event.';
				return;
			}
			await invalidateAll();
			if (announce) {
				showNotice(status === 'completed' ? completionMessage(id) : 'Status updated.', async () => {
					await updateEventStatus(id, previousStatus, false);
					showNotice('Change undone.');
				});
			}
		} catch {
			mutationError = 'Couldn’t update the event. Check your connection and try again.';
		}
	}

	// Deletion is confirmed through the shared AlertDialog (danger variant),
	// not a native confirm().
	let deleteTargetId = $state<string | null>(null);
	const deleteTargetEvent = $derived(
		deleteTargetId !== null ? (events.find((e) => e.id === deleteTargetId) ?? null) : null
	);

	function requestDeleteEvent(id: string) {
		deleteTargetId = id;
	}

	async function restoreDeletedEvent(event: CalendarEvent) {
		const response = await fetch('/api/calendar/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				courseId: event.courseId,
				courseCode: event.courseCode,
				title: event.title,
				type: event.type,
				date: event.date,
				month: event.month,
				year: event.year,
				time: event.time ?? undefined,
				gradeWeight: event.gradeWeight ?? undefined
			})
		});
		if (!response.ok) throw new Error('restore failed');
		const body = (await response.json()) as { id: string };
		if (event.status && event.status !== 'pending') {
			await fetch(`/api/calendar/events/${encodeURIComponent(body.id)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: event.status })
			});
		}
		await invalidateAll();
		showNotice('Event restored.');
	}

	async function confirmDeleteEvent() {
		const id = deleteTargetId;
		const deletedEvent = deleteTargetEvent;
		deleteTargetId = null;
		if (id === null) return;
		mutationError = null;
		try {
			const response = await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				mutationError = body?.error ?? 'Could not delete this event.';
				return;
			}
			await invalidateAll();
			showNotice(
				'Removed from your calendar.',
				deletedEvent?.courseId ? () => restoreDeletedEvent(deletedEvent) : null
			);
		} catch {
			mutationError = 'Couldn’t delete the event. Check your connection and try again.';
		}
	}

	// Escape closes the event editor or the day popover and returns focus to
	// the day cell that opened it. The delete dialog manages its own Escape.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || deleteTargetId !== null) return;
		if (showYearPicker) {
			showYearPicker = false;
			return;
		}
		if (addingEvent) {
			const day = selectedDay;
			resetEventForm();
			if (day !== null) focusDayButton(day);
		} else if (selectedDay !== null) {
			const day = selectedDay;
			dismissPopover();
			focusDayButton(day);
		}
	}

	function typeBadge(t: string): string {
		switch (t) {
			case 'quiz':
				return 'Q';
			case 'midterm':
				return 'MT';
			case 'final':
				return 'F';
			case 'assignment':
				return 'A';
			case 'lecture':
				return 'L';
			case 'study_session':
				return 'S';
			default:
				return '•';
		}
	}

	const calendarRows = $derived(Math.ceil((startDay + daysInMonth) / 7));

	// ── Year picker callbacks ──
	function toggleYearPicker() {
		showYearPicker = !showYearPicker;
	}
	function setYear(year: number) {
		viewYear = year;
	}
	function setMonth(month: number) {
		viewMonth = month;
		showYearPicker = false;
	}
	function dismissPopover() {
		selectedDay = null;
	}

	// ── Week-to-month navigation ──
	function navigateToDay(day: CalendarDate) {
		viewYear = day.year;
		viewMonth = day.month;
		focusedDay = day.date;
		viewMode = 'day';
		selectedDay = day.date;
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<svelte:head><title>Calendar · Synapse</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<h1 class="page-title">Calendar</h1>
				<p class="page-tagline">
					{#if events.length > 0}
						<span class="tagline-num">{totalInViewedMonth}</span> event{totalInViewedMonth !== 1
							? 's'
							: ''} in {monthName.toLowerCase()}
						· <span class="tagline-num">{upcoming.length}</span> upcoming
						{#if overdueCount > 0}· <span class="tagline-num crit">{overdueCount}</span> overdue{/if}
						{#if atRiskCount > 0}· <span class="tagline-num crit">{atRiskCount}</span> at risk{/if}
					{:else}Track your deadlines across every course{/if}
				</p>
			</div>
			<div class="page-cover-actions">
				<button
					class="primary-calendar-action"
					disabled={courseColors.length === 0}
					onclick={() => openAddEvent()}>+ Add event</button
				>
				<ToggleGroup.Root
					type="single"
					bind:value={viewMode}
					class="page-cover-stamps"
					aria-label="Calendar view"
				>
					{#each ['month', 'week', 'day'] as mode (mode)}
						<ToggleGroup.Item value={mode} class="stamp-btn">{mode}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			</div>
		</div>
	</div>

	{#if allCourseCodes.length > 0}
		<div class="calendar-filters">
			<span>Courses</span>
			<ToggleGroup.Root
				type="multiple"
				bind:value={filterCourses}
				aria-label="Filter calendar by course"
			>
				{#each allCourseCodes as code (code)}
					<ToggleGroup.Item value={code}>{code}</ToggleGroup.Item>
				{/each}
			</ToggleGroup.Root>
			{#if hasActiveFilter}<button class="clear-filter" onclick={clearFilters}
					>Clear course filters</button
				>{/if}
		</div>
	{/if}

	{#if hasActiveFilter && filteredEvents.length === 0}
		<div class="calendar-setup-notice">
			<span>No events match the selected courses.</span>
			<button onclick={clearFilters}>Clear course filters</button>
		</div>
	{/if}

	{#if courseColors.length === 0}
		<div class="calendar-setup-notice">
			<span>Add a course before creating calendar events.</span>
			<a href={resolveRoute('/app/semesters')}>Add a course</a>
		</div>
	{/if}

	<div class="cal-layout">
		<div class="cal-main" class:cal-fade={transitioning}>
			{#if actionNotice}
				<div class="calendar-notice" role="status" aria-live="polite">
					<span>{actionNotice}</span>
					{#if undoAction}
						<button
							onclick={() => {
								const action = undoAction;
								undoAction = null;
								void action?.();
							}}>Undo</button
						>
					{/if}
					<button
						class="icon-btn"
						aria-label="Dismiss notification"
						title="Dismiss"
						onclick={() => showNotice('')}
					>
						<X class="size-[var(--icon-sm)]" aria-hidden="true" />
					</button>
				</div>
			{/if}
			{#if mutationError}
				<p class="calendar-error" role="alert">{mutationError}</p>
			{/if}

			{#if addingEvent && selectedDay !== null}
				<CalendarEditor
					{viewYear}
					{viewMonth}
					{selectedDay}
					{editingEventId}
					bind:title={addFormTitle}
					bind:courseId={addFormCourseId}
					bind:course={addFormCourse}
					bind:type={addFormType}
					bind:time={addFormTime}
					bind:weight={addFormWeight}
					{courseColors}
					{savingEvent}
					{mutationError}
					onClose={resetEventForm}
					onSubmit={addEventSubmit}
				/>
			{/if}

			{#if viewMode === 'month'}
				<CalendarMonthView
					{viewYear}
					{viewMonth}
					{currentYear}
					{currentMonthIdx}
					{today}
					{monthName}
					{showYearPicker}
					{selectedDay}
					{focusedDay}
					{isCurrentMonth}
					{calendarRows}
					{startDay}
					{daysInMonth}
					{selectedDayEvents}
					{eventsByDay}
					{colorByCode}
					{isSelectedDay}
					{eventIsOverdue}
					onPrevMonth={prevMonth}
					onNextMonth={nextMonth}
					onGoToday={goToday}
					onSelectDay={selectDay}
					onFocusedDay={(d: number) => (focusedDay = d)}
					onToggleYearPicker={toggleYearPicker}
					onYearChange={setYear}
					onMonthChange={setMonth}
					{onGridKeydown}
					onEditEvent={openEditEvent}
					onUpdateEventStatus={updateEventStatus}
					onDeleteEvent={requestDeleteEvent}
					onDismissPopover={dismissPopover}
				/>
			{/if}

			{#if viewMode === 'week'}
				<CalendarWeekView
					{weekDays}
					{currentYear}
					{currentMonthIdx}
					{today}
					{eventsByDay}
					{colorByCode}
					onShiftWeek={shiftWeek}
					onGoToday={goToday}
					onNavigateToDay={navigateToDay}
				/>
			{/if}

			{#if viewMode === 'day'}
				<CalendarDayView
					{viewYear}
					{viewMonth}
					{viewDay}
					{todayEvents}
					{courseColor}
					{typeBadge}
					onPrevDay={prevDay}
					onNextDay={nextDay}
					onGoToday={goToday}
					onEditEvent={openEditEvent}
					onUpdateEventStatus={updateEventStatus}
					onDeleteEvent={requestDeleteEvent}
				/>
			{/if}
		</div>

		<CalendarSidebar
			{events}
			{upcoming}
			gradeStakesByCourse={gradeStakesByCourse as GradeStakesGroup[]}
			{courseColor}
			{eventIsOverdue}
		/>
	</div>
</div>

<AlertDialog
	open={deleteTargetId !== null}
	title="Delete event?"
	description={deleteTargetEvent
		? `"${deleteTargetEvent.title}" (${deleteTargetEvent.courseCode}) will be removed from your calendar.`
		: ''}
	confirmLabel="Delete"
	onConfirm={confirmDeleteEvent}
	onCancel={() => (deleteTargetId = null)}
/>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}
	.page-tagline {
		color: var(--ink-soft);
		font-size: var(--text-small);
		margin: 0.5rem 0 0;
	}
	.crit {
		color: var(--accent);
	}
	.page-cover-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: flex-end;
	}
	.primary-calendar-action {
		min-height: 40px;
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--paper);
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 120ms var(--ease-out-quart),
			box-shadow 120ms var(--ease-out-quart);
	}
	.primary-calendar-action:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 2px 2px 0 var(--shadow-ink);
	}
	.primary-calendar-action:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: none;
	}
	.primary-calendar-action:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
	:global(.stamp-btn) {
		min-height: 32px;
		background: none;
		border: 1px solid var(--rule);
		padding: 0.22rem 0.6rem;
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--ink-soft);
		cursor: pointer;
		line-height: 1;
	}
	:global(.stamp-btn:hover) {
		border-color: var(--ink);
		color: var(--ink);
	}
	:global(.stamp-btn[data-state='on']) {
		background: var(--highlight) !important;
		border-color: var(--ink) !important;
		color: var(--ink) !important;
		font-weight: 600;
	}

	.calendar-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.calendar-filters > span {
		margin-right: 0.25rem;
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: none;
		letter-spacing: normal;
	}
	.calendar-filters :global([data-toggle-group-item]),
	.calendar-filters .clear-filter,
	.calendar-setup-notice a,
	.calendar-setup-notice button {
		min-height: 32px;
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		font: 600 0.68rem/1 var(--font-body);
		cursor: pointer;
	}
	.calendar-filters :global([data-toggle-group-item][data-state='on']) {
		border-color: var(--ink);
		background: var(--highlight);
		color: var(--ink);
	}
	.calendar-filters .clear-filter {
		border-color: transparent;
		background: transparent;
		font-family: var(--font-body);
	}
	.calendar-setup-notice {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
		padding: 0.75rem;
		border: 1px dashed var(--rule);
		color: var(--ink-soft);
		font-size: var(--text-caption);
	}
	.calendar-setup-notice a,
	.calendar-setup-notice button {
		flex: 0 0 auto;
		color: var(--ink);
		text-decoration: none;
	}

	.calendar-notice {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--ink);
		background: var(--highlight-soft);
		color: var(--ink);
		font-size: var(--text-caption);
		animation: notice-arrive 180ms var(--ease-out-quart);
	}
	.calendar-notice span {
		flex: 1;
	}
	.calendar-notice button {
		min-height: 32px;
		border: 0;
		background: transparent;
		color: var(--ink);
		font-weight: 700;
		cursor: pointer;
	}

	.calendar-error {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--accent);
		font-size: var(--text-caption);
	}

	.cal-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 280px;
		gap: 1.5rem;
		align-items: start;
	}
	.cal-main {
		min-width: 0;
		transition: opacity 0.15s var(--ease-out-quart);
	}
	.cal-fade {
		opacity: 0.6;
	}

	@keyframes notice-arrive {
		from {
			transform: translateY(-4px);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.calendar-notice {
			animation: none;
		}
		.primary-calendar-action {
			transition: none;
		}
	}

	@media (max-width: 768px) {
		.cal-layout {
			grid-template-columns: 1fr;
		}
		.page-cover-actions {
			width: 100%;
			justify-content: space-between;
		}
		.calendar-setup-notice {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (pointer: coarse) {
		:global(.stamp-btn),
		.calendar-filters :global([data-toggle-group-item]),
		.calendar-filters .clear-filter,
		.calendar-setup-notice a,
		.calendar-setup-notice button {
			min-height: 44px;
		}
	}
</style>
