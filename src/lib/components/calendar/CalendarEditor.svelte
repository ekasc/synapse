<script lang="ts">
	import { Select } from 'bits-ui';
	import { onMount } from 'svelte';
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

	let editorElement: HTMLElement;
	onMount(() => editorElement.querySelector<HTMLElement>('[data-select-trigger]')?.focus());
</script>

<section
	bind:this={editorElement}
	class="calendar-editor surface-polaroid"
	aria-labelledby="calendar-editor-title"
>
	<div class="calendar-editor-head">
		<div>
			<p>{editingEventId ? 'Edit event' : 'Add event'}</p>
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
	<form
		class="cal-popover-form"
		onsubmit={(event) => {
			event.preventDefault();
			onSubmit();
		}}
	>
		<label class="cal-editor-field">
			<span class="cal-editor-label">Course</span>
			<Select.Root
				type="single"
				name="courseId"
				required
				items={courseColors.map((item) => ({
					value: item.id,
					label: `${item.code} · ${item.name}`
				}))}
				bind:value={courseId}
				onValueChange={(value) => {
					course = courseColors.find((item) => item.id === value)?.code ?? '';
				}}
			>
				<Select.Trigger
					class="flex min-h-10 w-full items-center border border-[var(--border-input)] bg-[var(--paper)] px-2 py-1.5 text-left text-[var(--ink)] text-[var(--text-caption)] outline-none focus-visible:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--highlight)]"
				>
					<Select.Value placeholder="Choose a course" />
				</Select.Trigger>
				<Select.Portal>
					<Select.Content
						class="z-[var(--z-dropdown)] max-h-72 overflow-y-auto border border-[var(--ink)] bg-[var(--paper)] shadow-[3px_3px_0_var(--shadow-ink)]"
					>
						<Select.Viewport>
							{#each courseColors as item (item.id)}
								<Select.Item
									value={item.id}
									label={`${item.code} · ${item.name}`}
									class="min-h-10 cursor-pointer px-2.5 py-2 text-[var(--text-caption)] outline-none data-[highlighted]:bg-[var(--highlight-soft)] data-[selected]:bg-[var(--highlight)]"
								>
									{item.code} · {item.name}
								</Select.Item>
							{/each}
						</Select.Viewport>
					</Select.Content>
				</Select.Portal>
			</Select.Root>
		</label>
		<label class="cal-editor-field">
			<span class="cal-editor-label">Title</span>
			<input
				type="text"
				class="cal-popover-input"
				name="title"
				placeholder="Event title"
				bind:value={title}
				maxlength="160"
				required
			/>
		</label>
		<div class="cal-popover-form-row">
			<label class="cal-editor-field">
				<span class="cal-editor-label">Type</span>
				<Select.Root
					type="single"
					name="type"
					items={[
						{ value: 'assignment', label: 'Assignment' },
						{ value: 'midterm', label: 'Midterm' },
						{ value: 'final', label: 'Final' },
						{ value: 'quiz', label: 'Quiz' },
						{ value: 'lecture', label: 'Lecture' },
						{ value: 'study_session', label: 'Study session' }
					]}
					bind:value={type}
				>
					<Select.Trigger
						class="flex min-h-10 w-full items-center border border-[var(--border-input)] bg-[var(--paper)] px-2 py-1.5 text-left text-[var(--ink)] text-[var(--text-caption)] outline-none focus-visible:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--highlight)]"
						><Select.Value /></Select.Trigger
					>
					<Select.Portal>
						<Select.Content
							class="z-[var(--z-dropdown)] border border-[var(--ink)] bg-[var(--paper)] shadow-[3px_3px_0_var(--shadow-ink)]"
						>
							<Select.Viewport>
								{#each [['assignment', 'Assignment'], ['midterm', 'Midterm'], ['final', 'Final'], ['quiz', 'Quiz'], ['lecture', 'Lecture'], ['study_session', 'Study session']] as item (item[0])}
									<Select.Item
										value={item[0]}
										label={item[1]}
										class="min-h-10 cursor-pointer px-2.5 py-2 text-[var(--text-caption)] outline-none data-[highlighted]:bg-[var(--highlight-soft)] data-[selected]:bg-[var(--highlight)]"
									>
										{item[1]}
									</Select.Item>
								{/each}
							</Select.Viewport>
						</Select.Content>
					</Select.Portal>
				</Select.Root>
			</label>
			<label class="cal-editor-field">
				<span class="cal-editor-label">Time</span>
				<input type="time" class="cal-popover-input" name="time" bind:value={time} />
			</label>
			<label class="cal-editor-field">
				<span class="cal-editor-label">Weight %</span>
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
		{#if mutationError}
			<p class="calendar-editor-error" role="alert">{mutationError}</p>
		{/if}
		<div class="calendar-editor-actions">
			<button
				type="submit"
				class="cal-popover-form-btn"
				disabled={savingEvent || !courseId || !title.trim()}
			>
				{savingEvent ? 'Saving…' : editingEventId ? 'Save changes' : 'Add event'}
			</button>
			<button type="button" class="cal-popover-add" onclick={onClose}>Cancel</button>
		</div>
	</form>
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
		font-size: var(--text-caption);
		letter-spacing: 0.1em;
		text-transform: none;
	}

	.calendar-editor-head h2 {
		margin-top: 0.2rem;
		font-family: var(--font-body);
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
		font-size: var(--text-caption);
		color: var(--ink-faint);
		text-transform: none;
		letter-spacing: 0.1em;
	}
	.cal-popover-input {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border-input);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-caption);
	}
	.cal-popover-input:focus {
		border-color: var(--ink);
		outline: 1px solid var(--highlight);
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
		font-size: var(--text-caption);
	}
	.cal-popover-form-btn:hover {
		opacity: 0.85;
	}
	.cal-popover-form-btn:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
	.calendar-editor-error {
		margin: 0;
		color: var(--accent);
		font-size: var(--text-caption);
	}
	.cal-popover-add {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		cursor: pointer;
		font-size: var(--text-caption);
		padding: 0.25rem 0.5rem;
	}
	.cal-popover-add:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
</style>
