<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import type { CalendarEventRow } from '$lib/server/db/d1';

	type CalendarEvent = CalendarEventRow & { course?: string; type: string };

	type ViewMode = 'month' | 'week' | 'day';

	let {
		data
	}: {
		data: {
			events?: CalendarEvent[];
			courseColors?: { code: string; color: string; name: string }[];
		};
	} = $props();
	const courseColors = $derived(data.courseColors ?? []);

	const now = new Date();
	const today = now.getDate();
	const currentMonthIdx = now.getMonth();
	const currentYear = now.getFullYear();

	let viewYear = $state(currentYear);
	let viewMonth = $state(currentMonthIdx);
	let viewMode = $state<ViewMode>('month');
	let selectedDay = $state<number | null>(null);
	let focusedDay = $state<number | null>(now.getDate());
	let showYearPicker = $state(false);

	onMount(() => {
		const m = $page.url.searchParams.get('month');
		const y = $page.url.searchParams.get('year');
		if (m !== null) {
			const parsed = parseInt(m, 10);
			if (parsed >= 0 && parsed <= 11) viewMonth = parsed;
		}
		if (y !== null) {
			const parsed = parseInt(y, 10);
			if (parsed >= 1970 && parsed <= 2100) viewYear = parsed;
		}
	});
	let showCourseFilter = $state(false);
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
	const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const monthName = $derived(MONTHS[viewMonth]);
	const monthShort = $derived(monthName.slice(0, 3));
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

	function courseColor(code: string): string {
		const known = courseColors.find((c) => c.code === code);
		if (known) return known.color;
		const PALETTE = ['var(--ink)', 'var(--accent)', 'var(--ink-soft)', 'var(--ink-faint)'];
		const idx = (code.charCodeAt(0) + (code.charCodeAt(1) || 0)) % PALETTE.length;
		return PALETTE[idx];
	}

	const filteredEvents = $derived(
		!hasActiveFilter ? events : events.filter((e) => filterCourses.includes(e.courseCode))
	);

	function eventsInMonth(): CalendarEvent[] {
		return filteredEvents.filter((e) => e.month === viewMonth && e.year === viewYear);
	}
	function eventsForDay(day: number): CalendarEvent[] {
		return eventsInMonth().filter((e) => e.date === day);
	}

	const totalInViewedMonth = $derived(eventsInMonth().length);
	const selectedDayEvents = $derived(selectedDay ? eventsForDay(selectedDay) : []);

	// ── Intelligence: crunch, stakes, gaps ──
	const upcoming = $derived(
		filteredEvents
			.filter((e) => {
				if (e.year > currentYear) return true;
				if (e.year < currentYear) return false;
				if (e.month > currentMonthIdx) return true;
				if (e.month < currentMonthIdx) return false;
				return e.date >= today;
			})
			.sort((a, b) => a.year - b.year || a.month - b.month || a.date - b.date)
	);

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
			const diff = (nd.getTime() - cd.getTime()) / 86400000;
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
					return Math.abs((cd.getTime() - pe.getTime()) / 86400000) <= 4;
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
						days: Math.round(diff)
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
	const totalWeight = $derived(gradeStakes.reduce((s, e) => s + (e.gradeWeight ?? 0), 0));
	const atRiskCount = $derived(events.filter((e) => e.status === 'at_risk').length);
	const overdueCount = $derived(
		filteredEvents.filter((e) => {
			if (e.year > currentYear) return false;
			if (e.year < currentYear) return true;
			if (e.month > currentMonthIdx) return false;
			if (e.month < currentMonthIdx) return true;
			return e.date < today;
		}).length
	);

	function isOverdue(day: number) {
		return isCurrentMonth && day < today;
	}
	function isSelectedDay(day: number) {
		return selectedDay === day;
	}

	function selectDay(day: number) {
		selectedDay = selectedDay === day ? null : day;
		focusedDay = day;
	}

	// ── Week view ──
	const weekStart = $derived(
		Math.max(1, (focusedDay ?? today) - new Date(viewYear, viewMonth, focusedDay ?? today).getDay())
	);
	const weekDays = $derived(
		Array.from({ length: 7 }, (_, i) => Math.min(weekStart + i, daysInMonth))
	);
	function weekEvents(day: number): CalendarEvent[] {
		return filteredEvents.filter(
			(e) => e.month === viewMonth && e.year === viewYear && e.date === day
		);
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
	function onGridKeydown(e: KeyboardEvent) {
		const current = focusedDay ?? today;
		switch (e.key) {
			case 'ArrowRight':
				e.preventDefault();
				focusedDay = Math.min(current + 1, daysInMonth);
				break;
			case 'ArrowLeft':
				e.preventDefault();
				focusedDay = Math.max(current - 1, 1);
				break;
			case 'ArrowDown':
				e.preventDefault();
				focusedDay = Math.min(current + 7, daysInMonth);
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusedDay = Math.max(current - 7, 1);
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				selectDay(current);
				break;
		}
	}

	// ── CRUD ──
	let addingEvent = $state(false);
	let addFormTitle = $state('');
	let addFormCourse = $state('');
	let addFormType = $state('assignment');
	let addFormTime = $state('');
	let addFormWeight = $state('');

	async function addEventSubmit() {
		if (!addFormTitle.trim() || !addFormCourse.trim() || selectedDay === null) return;
		try {
			const res = await fetch('/api/calendar/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					courseCode: addFormCourse.trim(),
					title: addFormTitle.trim(),
					type: addFormType,
					date: selectedDay,
					month: viewMonth,
					year: viewYear,
					time: addFormTime.trim() || undefined,
					gradeWeight: addFormWeight.trim() ? parseInt(addFormWeight.trim()) : undefined
				})
			});
			if (res.ok) {
				addFormTitle = '';
				addFormCourse = '';
				addFormTime = '';
				addFormWeight = '';
				addingEvent = false;
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to add event:', err);
		}
	}

	async function updateEventStatus(id: string, status: string) {
		try {
			await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			await invalidateAll();
		} catch (err) {
			console.error('Failed to update event:', err);
		}
	}

	async function deleteCalendarEvent(id: string) {
		try {
			await fetch(`/api/calendar/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete event:', err);
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

	function weekNumber(y: number, m: number, d: number): number {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local date math only, not component state.
		const dt = new Date(y, m, d);
		dt.setHours(0, 0, 0, 0);
		dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
		const w1 = new Date(dt.getFullYear(), 0, 4);
		return (
			1 + Math.round(((dt.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
		);
	}

	const calendarRows = $derived(Math.ceil((startDay + daysInMonth) / 7));
</script>

<svelte:head><title>Synapse · Calendar</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<h1 class="page-title font-display">Calendar</h1>
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
						onclick={() => (viewMode = mode as ViewMode)}>{mode}</button
					>
				{/each}
			</div>
		</div>
	</div>

	<!-- Filter chips -->
	{#if allCourseCodes.length > 1}
		<div class="filter-bar">
			<button
				class="filter-toggle font-mono"
				onclick={() => (showCourseFilter = !showCourseFilter)}
				aria-label="Toggle course filter"
			>
				{hasActiveFilter ? `${filterCourses.length} filtered` : 'All courses'}
				{showCourseFilter ? '▲' : '▼'}
			</button>
			{#if hasActiveFilter}<button class="filter-clear font-mono" onclick={clearFilters}
					>clear</button
				>{/if}
		</div>
		{#if showCourseFilter}
			<div class="filter-chips">
				<button
					class="filter-chip font-mono"
					class:filter-chip-active={!hasActiveFilter}
					onclick={clearFilters}>All</button
				>
				{#each allCourseCodes as code (code)}
					<button
						class="filter-chip font-mono"
						class:filter-chip-active={filterCourses.includes(code)}
						onclick={() => toggleCourseFilter(code)}>{code}</button
					>
				{/each}
			</div>
		{/if}
	{/if}

	<div class="cal-layout">
		<div class="cal-main" class:cal-fade={transitioning}>
			{#if viewMode === 'month'}
				<div class="cal-grid surface-polaroid">
					<div class="cal-header">
						<div class="cal-month-nav">
							<button class="cal-nav-btn font-mono" onclick={prevMonth} aria-label="Previous month"
								>←</button
							>
							<button
								class="cal-month-label font-display"
								onclick={() => (showYearPicker = !showYearPicker)}
								aria-label="Select month">{monthName} {viewYear}</button
							>
							<button class="cal-nav-btn font-mono" onclick={nextMonth} aria-label="Next month"
								>→</button
							>
							<button class="cal-today-btn font-mono" onclick={goToday}>today</button>
							<button
								class="cal-nav-btn-wide font-mono"
								onclick={() => {
									selectedDay = focusedDay ?? today;
									addingEvent = true;
								}}
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
										onclick={() => {
											viewMonth = m;
											showYearPicker = false;
										}}>{MONTHS[m].slice(0, 3)}</button
									>
								{/each}
							</div>
							<div class="cal-year-picker-years">
								<button
									class="cal-nav-btn font-mono"
									onclick={() => viewYear--}
									aria-label="Previous year">←</button
								>
								<span class="cal-year-picker-year font-mono">{viewYear}</span>
								<button
									class="cal-nav-btn font-mono"
									onclick={() => viewYear++}
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
						tabindex="0"
						aria-label="Calendar grid for {monthName} {viewYear}"
						onkeydown={onGridKeydown}
					>
						{#each Array.from({ length: calendarRows }, (_, row) => row) as row (row)}
							{@const rn = weekNumber(viewYear, viewMonth, Math.max(1, row * 7 + 1 - startDay))}
							<span class="cal-week-num font-mono" title="Week {rn}">{rn}</span>
							{#each Array.from({ length: 7 }, (_, col) => col) as col (col)}
								{@const day = row * 7 + col - startDay + 1}
								{@const dayEvents = day >= 1 && day <= daysInMonth ? eventsForDay(day) : []}
								{#if day < 1 || day > daysInMonth}
									<div class="cal-day cal-day-empty" aria-hidden="true"></div>
								{:else}
									<button
										class="cal-day"
										class:cal-today={isCurrentMonth && day === today}
										class:cal-overdue={isOverdue(day)}
										class:cal-day-selected={isSelectedDay(day)}
										class:cal-day-focused={focusedDay === day}
										role="gridcell"
										aria-label={`${day} — ${dayEvents.map((e) => `${e.title} (${e.courseCode})`).join(', ')}`}
										onclick={() => selectDay(day)}
										onfocus={() => (focusedDay = day)}
									>
										<span class="cal-day-num font-mono">{day}</span>
										{#if dayEvents.length > 0}
											<div class="cal-dot-group" aria-hidden="true">
												{#each dayEvents.slice(0, 4) as e (e.id)}
													<span
														class="cal-dot"
														style="background: {courseColor(e.courseCode)}"
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
								<button
									class="cal-popover-close"
									onclick={() => (selectedDay = null)}
									aria-label="Close">×</button
								>
							</div>
							<div class="cal-popover-list">
								{#each selectedDayEvents as ev (ev.id)}
									<div
										class="cal-popover-item"
										class:cal-popover-item-overdue={isOverdue(selectedDay!)}
									>
										<span class="cal-popover-dot" style="background: {courseColor(ev.courseCode)}"
										></span>
										<div class="cal-popover-item-body">
											<div class="cal-popover-item-head">
												<span class="cal-popover-item-title"
													>{ev.title}
													<span class="cal-popover-type font-mono">{typeBadge(ev.type)}</span>
												</span>
												<div class="cal-popover-item-actions">
													{#if ev.status !== 'completed'}
														<button
															class="cal-popover-action-btn"
															onclick={() => updateEventStatus(ev.id, 'completed')}
															title="Mark done">✓</button
														>
													{/if}
													{#if ev.status !== 'at_risk'}
														<button
															class="cal-popover-action-btn cal-popover-action-danger"
															onclick={() => updateEventStatus(ev.id, 'at_risk')}
															title="Flag at risk">!</button
														>
													{/if}
													<button
														class="cal-popover-action-btn cal-popover-action-del"
														onclick={() => deleteCalendarEvent(ev.id)}
														title="Delete">×</button
													>
												</div>
											</div>
											<div class="cal-popover-item-meta">
												<span class="cal-popover-item-course font-mono">{ev.courseCode}</span>
												{#if ev.time}<span class="cal-popover-item-time font-mono">{ev.time}</span
													>{/if}
												{#if ev.gradeWeight != null && ev.gradeWeight > 0}
													<span
														class="cal-popover-item-weight"
														style="background: {courseColor(ev.courseCode)}">{ev.gradeWeight}%</span
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
								<button
									class="cal-popover-add font-mono"
									onclick={() => (addingEvent = !addingEvent)}
								>
									{addingEvent ? 'cancel' : '+ add event'}
								</button>
							</div>
							{#if addingEvent}
								<div class="cal-popover-form">
									<input
										type="text"
										class="cal-popover-input"
										placeholder="Course code (e.g. CSIS 3375)"
										bind:value={addFormCourse}
									/>
									<input
										type="text"
										class="cal-popover-input"
										placeholder="Event title"
										bind:value={addFormTitle}
									/>
									<div class="cal-popover-form-row">
										<select class="cal-popover-select" bind:value={addFormType}>
											<option value="assignment">Assignment</option>
											<option value="midterm">Midterm</option>
											<option value="final">Final</option>
											<option value="quiz">Quiz</option>
											<option value="lecture">Lecture</option>
											<option value="study_session">Study Session</option>
										</select>
										<input
											type="text"
											class="cal-popover-input"
											placeholder="Time"
											bind:value={addFormTime}
										/>
										<input
											type="number"
											class="cal-popover-input"
											placeholder="Weight %"
											bind:value={addFormWeight}
											min="0"
											max="100"
										/>
									</div>
									<button class="cal-popover-form-btn" onclick={addEventSubmit}>Add</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			{#if viewMode === 'week'}
				<div class="surface-polaroid" style="padding: 1.5rem">
					<div class="cal-header" style="margin-bottom: 0.75rem">
						<div class="cal-month-nav">
							<button class="cal-nav-btn font-mono" onclick={prevMonth} aria-label="Previous month"
								>←</button
							>
							<span class="cal-month-label font-display" style="cursor: default">{monthName}</span>
							<button class="cal-nav-btn font-mono" onclick={nextMonth} aria-label="Next month"
								>→</button
							>
							<button class="cal-today-btn font-mono" onclick={goToday}>today</button>
							<button
								class="cal-nav-btn-wide font-mono"
								onclick={() => {
									selectedDay = focusedDay ?? today;
									addingEvent = true;
								}}
								style="margin-left: 0.25rem">+ event</button
							>
						</div>
					</div>
					<div class="cal-weekdays">
						{#each DAYS_SHORT as day, i (i)}<span class="cal-weekday font-mono">{day}</span>{/each}
					</div>
					<div class="cal-week-grid">
						{#each weekDays as day (day)}
							{@const evts = weekEvents(day)}
							<button
								class="cal-week-cell"
								class:cal-today={isCurrentMonth && day === today}
								class:cal-week-cell-empty={evts.length === 0}
								onclick={() => {
									viewMode = 'month';
									selectDay(day);
								}}
							>
								<div class="cal-week-cell-head">
									<span class="cal-week-cell-day font-mono"
										>{DAYS_SHORT[new Date(viewYear, viewMonth, day).getDay()]}</span
									><span class="cal-week-cell-date font-mono">{day}</span>
								</div>
								<div class="cal-week-cell-events">
									{#each evts.slice(0, 2) as ev (ev.id)}
										<span
											class="cal-week-cell-event"
											style="border-color: {courseColor(ev.courseCode)}"
										>
											<span class="cal-week-cell-title">{ev.title}</span>
											{#if ev.time}<span class="cal-week-cell-time font-mono">{ev.time}</span>{/if}
											{#if ev.gradeWeight != null && ev.gradeWeight > 0}
												<span class="cal-week-cell-weight font-mono">{ev.gradeWeight}%</span>
											{/if}
										</span>
									{/each}
									{#if evts.length > 2}<span class="cal-week-cell-more font-mono"
											>+{evts.length - 2} more</span
										>{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if viewMode === 'day'}
				<div class="surface-polaroid" style="padding: 1.5rem">
					<div class="cal-header" style="margin-bottom: 0.75rem">
						<div class="cal-month-nav">
							<button class="cal-nav-btn font-mono" onclick={prevDay} aria-label="Previous day"
								>←</button
							>
							<span class="cal-month-label font-display" style="cursor: default"
								>{new Date(viewYear, viewMonth, viewDay).toLocaleDateString('en-US', {
									weekday: 'long',
									month: 'long',
									day: 'numeric'
								})}</span
							>
							<button class="cal-nav-btn font-mono" onclick={nextDay} aria-label="Next day"
								>→</button
							>
							<button class="cal-today-btn font-mono" onclick={goToday}>today</button>
							<button
								class="cal-nav-btn-wide font-mono"
								onclick={() => {
									selectedDay = focusedDay ?? today;
									addingEvent = true;
								}}
								style="margin-left: 0.25rem">+ event</button
							>
						</div>
					</div>
					{#if todayEvents.length === 0}
						<div style="padding: 2rem; text-align: center">
							<span class="font-mono" style="color: var(--ink-faint)">No events for this day</span>
						</div>
					{:else}
						<div class="cal-day-view-list">
							{#each todayEvents as ev (ev.id)}
								<div class="cal-day-view-item" style="border-color: {courseColor(ev.courseCode)}">
									<div class="cal-day-view-item-head">
										<span class="cal-popover-type font-mono">{typeBadge(ev.type)}</span>
										<span class="cal-day-view-item-time font-mono">{ev.time ?? 'all day'}</span>
										<span class="cal-day-view-item-course font-mono">{ev.courseCode}</span>
										{#if ev.gradeWeight != null && ev.gradeWeight > 0}
											<span class="cal-day-view-item-weight">{ev.gradeWeight}%</span>
										{/if}
									</div>
									<span class="cal-day-view-item-title">{ev.title}</span>
									<div class="cal-day-view-item-actions">
										{#if ev.status !== 'completed'}
											<button
												class="cal-day-view-action"
												onclick={() => updateEventStatus(ev.id, 'completed')}>✓ done</button
											>
										{/if}
										<button
											class="cal-day-view-action cal-day-view-action-del"
											onclick={() => deleteCalendarEvent(ev.id)}>delete</button
										>
									</div>
								</div>
							{/each}
						</div>
					{/if}
					<div style="display: flex; justify-content: space-between; margin-top: 1rem">
						<button class="cal-nav-btn-wide font-mono" onclick={prevDay}>← Previous day</button>
						<button class="cal-nav-btn-wide font-mono" onclick={nextDay}>Next day →</button>
					</div>
				</div>
			{/if}
		</div>

		<aside class="upcoming-panel">
			{#if allCourseCodes.length > 0}
				<SectionHead eyebrow="Filter" title="Courses" />
				<div class="filter-bar-sidebar">
					{#each allCourseCodes as code (code)}
						<button
							class="filter-chip-sm font-mono"
							class:filter-chip-sm-active={filterCourses.includes(code)}
							onclick={() => toggleCourseFilter(code)}>{code}</button
						>
					{/each}
					{#if hasActiveFilter}<button class="filter-chip-sm font-mono" onclick={clearFilters}
							>clear</button
						>{/if}
				</div>
			{/if}

			{#if events.length === 0}
				<div class="sidebar-empty">
					<div class="sidebar-empty-icon">◷</div>
					<p class="sidebar-empty-title font-display">Empty calendar</p>
					<p class="sidebar-empty-text">
						Add events to track exams, assignments, and study sessions. Each event can include a
						grade weight so Synapse can calculate your stakes.
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
							{#if cp.weight > 0}
								<div class="crunch-weight font-mono">{cp.weight}% of grade at stake</div>
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

			<!-- Weight summary -->
			{#if gradeStakes.length > 0}
				<SectionHead title="Grade stakes" eyebrow={`${totalWeight}% total`} />
				<div class="weight-list">
					{#each gradeStakes.slice(0, 5) as ev (ev.id)}
						<div class="weight-item">
							<div class="weight-bar-track">
								<div
									class="weight-bar-fill"
									style="width: {ev.gradeWeight}%; background: {courseColor(ev.courseCode)}"
								></div>
							</div>
							<div class="weight-info">
								<span class="weight-title">{ev.title}</span>
								<span class="weight-meta font-mono">{ev.courseCode} · {ev.gradeWeight}%</span>
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
						<div class="upcoming-mini-item" class:upcoming-mini-overdue={isOverdue(ev.date)}>
							<span class="upcoming-mini-dot" style="background: {courseColor(ev.courseCode)}"
							></span>
							<div class="upcoming-mini-body">
								<span class="upcoming-mini-title"
									>{ev.title}<span class="cal-popover-type font-mono">{typeBadge(ev.type)}</span
									></span
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
	</div>
</div>

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

	/* ── Filter ── */
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.filter-toggle {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.7rem;
	}
	.filter-toggle:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.filter-clear {
		padding: 0.25rem 0.5rem;
		border: none;
		background: none;
		color: var(--accent);
		cursor: pointer;
		font-size: 0.7rem;
	}
	.filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.filter-chip {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.65rem;
		letter-spacing: 0.08em;
	}
	.filter-chip:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.filter-chip-active {
		background: var(--highlight) !important;
		border-color: var(--ink) !important;
		color: var(--ink) !important;
		font-weight: 500;
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

	/* ── Layout ── */
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

	/* ── Grid ── */
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
	.cal-month-label {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1;
		letter-spacing: -0.01em;
		border: none;
		background: none;
		cursor: pointer;
		padding: 0;
	}
	.cal-month-label:hover {
		text-decoration: underline;
		text-decoration-color: var(--rule);
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

	/* ── Year picker ── */
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

	/* ── Month grid cells ── */
	.cal-weekdays {
		display: grid;
		grid-template-columns: 1.5rem repeat(7, 1fr);
		gap: 2px;
		margin-bottom: 4px;
	}
	.cal-week-num-header {
		font-size: 0.55rem;
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
	.cal-grid-body {
		display: grid;
		grid-template-columns: 1.5rem repeat(7, 1fr);
		gap: 2px;
	}
	.cal-week-num {
		font-size: 0.5rem;
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

	/* ── Popover ── */
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
		font-size: 0.55rem;
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
		font-size: 0.55rem;
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
	.cal-popover-form {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}
	.cal-popover-input {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border-input);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
	}
	.cal-popover-input:focus {
		border-color: var(--ink);
		outline: 1px solid var(--highlight);
	}
	.cal-popover-select {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border-input);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
	}
	.cal-popover-form-row {
		display: flex;
		gap: 0.35rem;
	}
	.cal-popover-form-row > * {
		flex: 1;
	}
	.cal-popover-form-btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--paper);
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
	}
	.cal-popover-form-btn:hover {
		opacity: 0.85;
	}

	/* ── Week view ── */
	.cal-week-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
	}
	.cal-week-cell {
		display: flex;
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
	.cal-week-cell-head {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-bottom: 4px;
	}
	.cal-week-cell-day {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--ink);
		text-transform: uppercase;
	}
	.cal-week-cell-date {
		font-size: 0.72rem;
		color: var(--ink-soft);
	}
	.cal-week-cell-events {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}
	.cal-week-cell-event {
		display: block;
		padding: 2px 4px;
		border: 1px solid var(--rule);
		font-size: 0.65rem;
		line-height: 1.2;
		background: var(--paper-shelf);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cal-week-cell-title {
		color: var(--ink);
	}
	.cal-week-cell-time {
		color: var(--ink-faint);
		margin-left: 0.25rem;
		font-size: 0.6rem;
	}
	.cal-week-cell-weight {
		color: var(--ink-soft);
		margin-left: auto;
		font-size: 0.6rem;
	}
	.cal-week-cell-more {
		font-size: 0.6rem;
		color: var(--ink-faint);
		padding: 2px 4px;
	}

	/* ── Day view ── */
	.cal-day-view-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.cal-day-view-item {
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.cal-day-view-item-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}
	.cal-day-view-item-time {
		font-size: 0.65rem;
		color: var(--ink-soft);
	}
	.cal-day-view-item-course {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-left: auto;
	}
	.cal-day-view-item-weight {
		font-size: 0.6rem;
		background: var(--ink);
		color: var(--paper);
		padding: 0 4px;
	}
	.cal-day-view-item-title {
		font-size: 0.9rem;
		color: var(--ink);
		line-height: 1.3;
		display: block;
	}
	.cal-day-view-item-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}
	.cal-day-view-action {
		border: 1px solid var(--rule);
		background: transparent;
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
	}
	.cal-day-view-action:hover {
		border-color: var(--ok);
		color: var(--ok);
	}
	.cal-day-view-action-del:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.cal-nav-btn-wide {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font-size: 0.8rem;
		padding: 0.35rem 0.65rem;
		line-height: 1;
	}
	.cal-nav-btn-wide:hover {
		border-color: var(--ink);
	}

	/* ── Sidebar ── */
	.upcoming-panel {
		position: sticky;
		top: 2rem;
		padding: 0;
		margin-top: 0.5rem;
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
		font-size: 1.1rem;
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

	/* ── Crunch cards ── */
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
		font-size: 0.6rem;
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
		font-size: 0.55rem;
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

	/* ── Weight stakes ── */
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
		transition: width 0.3s var(--ease-out-quart);
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
		font-size: 0.6rem;
		color: var(--ink-faint);
	}

	/* ── Upcoming mini-list ── */
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
		font-size: 0.6rem;
		color: var(--ink-soft);
		flex-shrink: 0;
	}
	.upcoming-mini-badge {
		font-size: 0.6rem;
		color: var(--ok);
		flex-shrink: 0;
		margin-top: 2px;
	}
	.upcoming-mini-risk {
		color: var(--accent);
	}

	@media (max-width: 768px) {
		.cal-layout {
			grid-template-columns: 1fr;
		}
		.upcoming-panel {
			position: static;
		}
		.cal-day {
			min-height: 48px;
		}
		.cal-week-cell {
			min-height: 80px;
		}
	}
	@media (max-width: 480px) {
		.cal-weekdays,
		.cal-grid-body {
			grid-template-columns: 1.5rem repeat(7, 1fr);
			gap: 1px;
		}
		.cal-week-num {
			display: none;
		}
		.cal-week-num-header {
			display: none;
		}
		.cal-weekdays {
			grid-template-columns: repeat(7, 1fr);
		}
		.cal-grid-body {
			grid-template-columns: repeat(7, 1fr);
		}
		.cal-day {
			min-height: 36px;
			padding: 1px;
			font-size: 0.65rem;
		}
		.cal-day-num {
			font-size: 0.6rem;
		}
		.cal-week-cell {
			min-height: 60px;
			padding: 3px;
			font-size: 0.6rem;
		}
		.cal-week-cell-event {
			font-size: 0.55rem;
			padding: 1px 3px;
		}
		.cal-nav-btn-wide {
			font-size: 0.6rem;
			padding: 0.25rem 0.4rem;
		}
		.cal-grid {
			padding: 0.75rem;
		}
	}
</style>
