<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';

	type CourseOption = { id: string; code: string; name?: string };

	let {
		open = $bindable(false),
		courses,
		onsaved
	}: {
		open?: boolean;
		courses: CourseOption[];
		onsaved: () => Promise<void> | void;
	} = $props();

	const typeChoices = [
		{ value: 'assignment', label: 'Assignment' },
		{ value: 'midterm', label: 'Midterm' },
		{ value: 'final', label: 'Final exam' },
		{ value: 'quiz', label: 'Quiz' },
		{ value: 'lecture', label: 'Class / lecture' },
		{ value: 'study_session', label: 'Study session' }
	];

	const localToday = () => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	};

	let courseId = $state('');
	let title = $state('');
	let type = $state('assignment');
	let dateStr = $state(localToday());
	let timeStr = $state('');
	let gradeWeight = $state<number | null>(null);
	let error = $state('');
	let saving = $state(false);

	const selectedCourse = $derived(courses.find((course) => course.id === courseId));

	async function submit() {
		error = '';
		if (!selectedCourse || !title.trim() || !dateStr) {
			error = 'Course, title, and date are required.';
			return;
		}
		if (
			gradeWeight !== null &&
			(!Number.isInteger(gradeWeight) || gradeWeight < 0 || gradeWeight > 100)
		) {
			error = 'Grade weight must be a whole number from 0 to 100.';
			return;
		}
		const [year, month, date] = dateStr.split('-').map(Number);
		saving = true;
		try {
			const response = await fetch('/api/calendar/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					courseId: selectedCourse.id,
					courseCode: selectedCourse.code,
					title: title.trim(),
					type,
					year,
					month: month - 1,
					date,
					time: timeStr || null,
					gradeWeight
				})
			});
			const body = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) {
				error = body.error ?? 'Could not add the deadline.';
				return;
			}
			title = '';
			timeStr = '';
			gradeWeight = null;
			await onsaved();
		} catch {
			error = 'Network error. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

{#if open}
	<Dialog
		bind:open
		title="Add a deadline"
		description="It will appear on your dashboard right away."
	>
		<form
			class="deadline-form"
			onsubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<label>
				Course
				<select bind:value={courseId} required>
					<option value="" disabled>Select a course…</option>
					{#each courses as course (course.id)}
						<option value={course.id}>{course.code}{course.name ? ` — ${course.name}` : ''}</option>
					{/each}
				</select>
			</label>

			<label>
				Title
				<input
					type="text"
					bind:value={title}
					maxlength="160"
					placeholder="e.g. Progress Report 2"
					required
				/>
			</label>

			<div class="form-row">
				<label>
					Type
					<select bind:value={type}>
						{#each typeChoices as choice (choice.value)}
							<option value={choice.value}>{choice.label}</option>
						{/each}
					</select>
				</label>
				<label>
					Date
					<input type="date" bind:value={dateStr} required />
				</label>
			</div>

			<div class="form-row">
				<label>
					Time <span class="optional">(optional)</span>
					<input type="time" bind:value={timeStr} />
				</label>
				<label>
					Grade weight % <span class="optional">(optional)</span>
					<input
						type="number"
						bind:value={gradeWeight}
						min="0"
						max="100"
						step="1"
						placeholder="—"
					/>
				</label>
			</div>

			{#if error}
				<p class="form-error" role="alert">{error}</p>
			{/if}

			<button class="btn btn-primary" type="submit" disabled={saving}>
				{saving ? 'Adding…' : 'Add deadline'}
			</button>
		</form>
	</Dialog>
{/if}

<style>
	.deadline-form {
		display: grid;
		gap: 0.9rem;
		margin-top: 1rem;
	}
	.deadline-form label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ink-soft);
	}
	.deadline-form input,
	.deadline-form select {
		padding: 0.6rem;
		border: 1px solid var(--border-input);
		background: var(--surface-paper);
		font: 400 0.95rem/1.3 var(--font-body);
		color: var(--ink);
	}
	.deadline-form input:focus-visible,
	.deadline-form select:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem;
	}
	.optional {
		font-weight: 400;
		color: var(--ink-faint);
	}
	.form-error {
		margin: 0;
		color: var(--pen-red);
		font-size: 0.85rem;
	}
	@media (max-width: 480px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
