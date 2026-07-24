<script lang="ts">
	import type { CalendarEvent } from './types';

	let {
		viewYear,
		viewMonth,
		viewDay,
		todayEvents = [] as CalendarEvent[],
		focusedDay = null as number | null,
		today,
		courseColor = (_code: string) => 'var(--ink)',
		typeBadge = (_t: string) => '•',
		onPrevDay = () => {},
		onNextDay = () => {},
		onGoToday = () => {},
		onAddEvent = (_day: number) => {},
		onEditEvent = (_event: CalendarEvent) => {},
		onUpdateEventStatus = (_id: string, _status: string) => {},
		onDeleteEvent = (_id: string) => {}
	}: {
		viewYear: number;
		viewMonth: number;
		viewDay: number;
		todayEvents: CalendarEvent[];
		focusedDay: number | null;
		today: number;
		courseColor: (code: string) => string;
		typeBadge: (t: string) => string;
		onPrevDay: () => void;
		onNextDay: () => void;
		onGoToday: () => void;
		onAddEvent: (day: number) => void;
		onEditEvent: (event: CalendarEvent) => void;
		onUpdateEventStatus: (id: string, status: string) => void;
		onDeleteEvent: (id: string) => void;
	} = $props();
</script>

<div class="surface-polaroid" style="padding: 1.5rem">
	<div class="cal-header" style="margin-bottom: 0.75rem">
		<div class="cal-month-nav">
			<button class="cal-nav-btn font-mono" onclick={onPrevDay} aria-label="Previous day">←</button>
			<span class="cal-month-label"
				>{new Date(viewYear, viewMonth, viewDay).toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric'
				})}</span
			>
			<button class="cal-nav-btn font-mono" onclick={onNextDay} aria-label="Next day">→</button>
			<button class="cal-today-btn font-mono" onclick={onGoToday}>today</button>
			<button
				class="cal-nav-btn-wide font-mono"
				onclick={() => onAddEvent(focusedDay ?? today)}
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
						<button class="cal-day-view-action" onclick={() => onEditEvent(ev)}>edit</button>
						{#if ev.status !== 'completed'}
							<button
								class="cal-day-view-action"
								onclick={() => onUpdateEventStatus(ev.id, 'completed')}>✓ done</button
							>
						{/if}
						<button
							class="cal-day-view-action cal-day-view-action-del"
							onclick={() => onDeleteEvent(ev.id)}>delete</button
						>
					</div>
				</div>
			{/each}
		</div>
	{/if}
	<div style="display: flex; justify-content: space-between; margin-top: 1rem">
		<button class="cal-nav-btn-wide font-mono" onclick={onPrevDay}>← Previous day</button>
		<button class="cal-nav-btn-wide font-mono" onclick={onNextDay}>Next day →</button>
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
		font-size: 0.62rem;
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

	.cal-popover-type {
		display: inline-block;
		padding: 0 0.25rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		line-height: 1.2;
		vertical-align: middle;
	}

	/* Touch: raise toolbar + event actions to the 44px WCAG hit-area floor. */
	@media (pointer: coarse) {
		.cal-nav-btn,
		.cal-today-btn,
		.cal-nav-btn-wide {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
		.cal-day-view-action {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
			padding: 0 0.65rem;
		}
	}
</style>
