<script lang="ts">
	import type { CourseColor } from './types';

	let {
		viewYear,
		viewMonth,
		selectedDay,
		editingEventId = null,
		title = $bindable(''),
		courseId = $bindable(''),
		course = $bindable(''),
		type = $bindable('assignment'),
		time = $bindable(''),
		weight = $bindable(''),
		courseColors = [] as CourseColor[],
		savingEvent = false,
		mutationError = null as string | null,
		onClose = () => {},
		onSubmit = () => {}
	}: {
		viewYear: number;
		viewMonth: number;
		selectedDay: number;
		editingEventId: string | null;
		title: string;
		courseId: string;
		course: string;
		type: string;
		time: string;
		weight: string;
		courseColors: CourseColor[];
		savingEvent: boolean;
		mutationError: string | null;
		onClose: () => void;
		onSubmit: () => void;
	} = $props();
</script>

<section class="calendar-editor surface-polaroid" aria-labelledby="calendar-editor-title">
	<div class="calendar-editor-head">
		<div>
			<p class="font-mono">{editingEventId ? 'Edit event' : 'Add event'}</p>
			<h2 id="calendar-editor-title">
				{new Date(viewYear, viewMonth, selectedDay).toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				})}
			</h2>
		</div>
		<button
			type="button"
			class="cal-popover-close"
			onclick={onClose}
			aria-label="Close event editor">×</button
		>
	</div>
	<div class="cal-popover-form">
		<label class="cal-editor-field">
			<span class="cal-editor-label font-mono">Course</span>
			<select
				class="cal-popover-select"
				name="courseId"
				bind:value={courseId}
				onchange={() => {
					course = courseColors.find((c) => c.id === courseId)?.code ?? '';
				}}
				required
			>
				<option value="">Choose a course</option>
				{#each courseColors as c (c.id)}
					<option value={c.id}>{c.code} · {c.name}</option>
				{/each}
			</select>
		</label>
		<label class="cal-editor-field">
			<span class="cal-editor-label font-mono">Title</span>
			<input
				type="text"
				class="cal-popover-input"
				name="title"
				placeholder="Event title"
				bind:value={title}
				maxlength="160"
			/>
		</label>
		<div class="cal-popover-form-row">
			<label class="cal-editor-field">
				<span class="cal-editor-label font-mono">Type</span>
				<select class="cal-popover-select" name="type" bind:value={type}>
					<option value="assignment">Assignment</option>
					<option value="midterm">Midterm</option>
					<option value="final">Final</option>
					<option value="quiz">Quiz</option>
					<option value="lecture">Lecture</option>
					<option value="study_session">Study session</option>
				</select>
			</label>
			<label class="cal-editor-field">
				<span class="cal-editor-label font-mono">Time</span>
				<input type="time" class="cal-popover-input" name="time" bind:value={time} />
			</label>
			<label class="cal-editor-field">
				<span class="cal-editor-label font-mono">Weight %</span>
				<input
					type="number"
					class="cal-popover-input"
					name="weight"
					bind:value={weight}
					min="0"
					max="100"
				/>
			</label>
		</div>
		<div class="calendar-editor-actions">
			<button
				class="cal-popover-form-btn"
				onclick={onSubmit}
				disabled={savingEvent || !courseId || !title.trim()}
			>
				{savingEvent ? 'Saving…' : editingEventId ? 'Save changes' : 'Add event'}
			</button>
			<button type="button" class="cal-popover-add font-mono" onclick={onClose}>Cancel</button>
		</div>
	</div>
</section>

<style>
	.calendar-editor {
		margin-bottom: 1rem;
		padding: 1rem;
	}

	.calendar-editor-head,
	.calendar-editor-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.calendar-editor-head {
		margin-bottom: 0.75rem;
	}

	.calendar-editor-head p,
	.calendar-editor-head h2 {
		margin: 0;
	}

	.calendar-editor-head p {
		color: var(--ink-faint);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.calendar-editor-head h2 {
		margin-top: 0.2rem;
		font-family: var(--font-hand);
		font-size: 1.3rem;
		font-weight: 700;
		line-height: 1.1;
	}

	.calendar-editor-actions {
		justify-content: flex-start;
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

	.cal-popover-form {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin-top: 0.5rem;
	}
	.cal-editor-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.cal-editor-label {
		font-size: 0.58rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
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
</style>
