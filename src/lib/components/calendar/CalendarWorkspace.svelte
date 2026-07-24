<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import {
		gradeWeightByCourse,
		isEventOverdue,
		shiftCalendarDate,
		upcomingEvents,
		weekDates,
		type CalendarDate
	} from '$lib/calendar/domain';
	import { daysBetween } from '$lib/calendar/week';
	import { AlertDialog } from '$lib/components/ui';
	import type { CalendarEvent, CrunchPeriod, GradeStakesGroup } from './types';
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
			viewMode = 'month';
		});
	}

	const events = $derived(data.events ?? []);
	const allCourseCodes = $derived([...new Set(events.map((e) => e.courseCode))].sort());
	const hasActiveFilter = $derived(filterCourses.length > 0);

	function toggleCourseFilter(code: string) {
		filterCourses = filterCourses.includes(code)
			? filterCourses.filter((item) => item !== code)
			: [...filterCourses, code];
	}

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

	const crunchPeriods = $derived.by(() => {
		const periods: {
			start: string;
			end: string;
			events: CalendarEvent[];
			weight: number;
			courses: string[];
			days: number;
		}[] = [];
		for (let i = 0; i < upcoming.length - 1; i++) {
			const c = upcoming[i],
				n = upcoming[i + 1];
			const cd = new Date(c.year, c.month, c.date),
				nd = new Date(n.year, n.month, n.date);
			const diff = daysBetween(cd, nd);
			if (diff > 0 && diff <= 4) {
				const fmt = (d: number, m: number) => {
					const ms = [
						'Jan',
						'Feb',
						'Mar',
						'Apr',
						'May',
						'Jun',
						'Jul',
						'Aug',
						'Sep',
						'Oct',
						'Nov',
						'Dec'
					];
					return `${ms[m]} ${d}`;
				};
				const existing = periods.find((p) => {
					const pe = new Date(p.end);
					return Math.abs(daysBetween(cd, pe)) <= 4;
				});
				if (existing) {
					if (!existing.events.find((e) => e.id === c.id)) existing.events.push(c);
					if (!existing.events.find((e) => e.id === n.id)) existing.events.push(n);
					existing.end = fmt(n.date, n.month);
				} else {
					periods.push({
						start: fmt(c.date, c.month),
						end: fmt(n.date, n.month),
						events: [c, n],
						weight: 0,
						courses: [],
						days: diff
					});
				}
			}
		}
		return periods.map((p) => ({
			...p,
			weight: p.events.reduce((s, e) => s + (e.gradeWeight ?? 0), 0),
			courses: [...new Set(p.events.map((e) => e.courseCode))]
		}));
	});

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
	let addFormTitle = $state('');
	let addFormCourseId = $state('');
	let addFormCourse = $state('');
	let addFormType = $state('assignment');
	let addFormTime = $state('');
	let addFormWeight = $state('');
	let editingEventId = $state<string | null>(null);
	let mutationError = $state<string | null>(null);
	let savingEvent = $state(false);

	function resetEventForm() {
		addFormTitle = '';
		addFormCourseId = '';
		addFormCourse = '';
		addFormType = 'assignment';
		addFormTime = '';
		addFormWeight = '';
		editingEventId = null;
		addingEvent = false;
	}

	function openAddEvent(day = focusedDay ?? today) {
		selectedDay = day;
		focusedDay = day;
		editingEventId = null;
		mutationError = null;
		addingEvent = true;
	}

	function openEditEvent(event: CalendarEvent) {
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
			resetEventForm();
			await invalidateAll();
		} catch {
			mutationError = 'Network error. Is the server running?';
		} finally {
			savingEvent = false;
		}
	}

	async function updateEventStatus(id: string, status: string) {
		mutationError = null;
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
		} catch {
			mutationError = 'Network error. Is the server running?';
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

	async function confirmDeleteEvent() {
		const id = deleteTargetId;
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
		} catch {
			mutationError = 'Network error. Is the server running?';
		}
	}

	// Escape closes the event editor or the day popover and returns focus to
	// the day cell that opened it. The delete dialog manages its own Escape.
	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || deleteTargetId !== null) return;
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
		viewMode = 'month';
		selectDay(day.date);
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
			<div class="page-cover-stamps">
				{#each ['month', 'week', 'day'] as mode (mode)}
					<button
						class="stamp-sm font-mono"
						class:stamp-active={viewMode === mode}
						onclick={() => (viewMode = mode as 'month' | 'week' | 'day')}>{mode}</button
					>
				{/each}
			</div>
		</div>
	</div>

	<div class="cal-layout">
		<div class="cal-main" class:cal-fade={transitioning}>
			{#if mutationError}
				<p class="calendar-error font-mono" role="alert">{mutationError}</p>
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
					{typeBadge}
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
					onAddEvent={openAddEvent}
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
					{focusedDay}
					onShiftWeek={shiftWeek}
					onGoToday={goToday}
					onAddEvent={openAddEvent}
					onNavigateToDay={navigateToDay}
				/>
			{/if}

			{#if viewMode === 'day'}
				<CalendarDayView
					{viewYear}
					{viewMonth}
					{viewDay}
					{todayEvents}
					{focusedDay}
					{today}
					{courseColor}
					{typeBadge}
					onPrevDay={prevDay}
					onNextDay={nextDay}
					onGoToday={goToday}
					onAddEvent={openAddEvent}
					onEditEvent={openEditEvent}
					onUpdateEventStatus={updateEventStatus}
					onDeleteEvent={requestDeleteEvent}
				/>
			{/if}
		</div>

		<CalendarSidebar
			{events}
			{allCourseCodes}
			{filterCourses}
			{hasActiveFilter}
			{upcoming}
			crunchPeriods={crunchPeriods as CrunchPeriod[]}
			gradeStakesByCourse={gradeStakesByCourse as GradeStakesGroup[]}
			{courseColor}
			{typeBadge}
			{eventIsOverdue}
			onToggleCourseFilter={toggleCourseFilter}
			onClearFilters={clearFilters}
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
	.crit {
		color: var(--accent);
	}
	.stamp-active {
		background: var(--highlight) !important;
		border-color: var(--ink) !important;
		color: var(--ink) !important;
		font-weight: 600;
	}

	.calendar-error {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--accent);
		font-size: 0.75rem;
	}

	.cal-layout {
		display: grid;
		grid-template-columns: 1fr 280px;
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

	@media (max-width: 768px) {
		.cal-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
