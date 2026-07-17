<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Dialog } from '$lib/components/ui';

	type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';

	type Course = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		tag?: string;
		color?: string;
		signals?: {
			status?: CourseStatus;
			riskLevel?: RiskLevel;
			currentGrade?: number;
			topics?: string[];
		};
	};

	type Semester = { id: string; term: string; year: number; order: number };

	let {
		open = $bindable(false),
		course = null,
		semesters = [],
		defaultSemesterId,
		lockSemester = false,
		onSaved
	}: {
		open?: boolean;
		course?: Course | null;
		semesters?: Semester[];
		defaultSemesterId?: string;
		lockSemester?: boolean;
		onSaved?: () => void;
	} = $props();

	const TAGS = ['core', 'programming', 'math', 'systems', 'ai', 'writing'];

	const COLOR_PRESETS = [
		'#4a6fa5',
		'#5a7a4a',
		'#7a5a8a',
		'#3a8a7a',
		'#b08a3a',
		'#b04a6a',
		'#6a5a8a',
		'#5a6a7a',
		'#b05a4a',
		'#4a7a6a'
	];

	let saving = $state(false);
	let error = $state<string | null>(null);
	let form = $state({
		code: '',
		name: '',
		semesterId: '',
		instructor: '',
		credits: '',
		tag: '',
		color: '',
		status: 'planned' as CourseStatus,
		riskLevel: 'none' as RiskLevel,
		currentGrade: '',
		topics: ''
	});

	const isEditing = $derived(course !== null);

	function resetForm() {
		if (course) {
			form = {
				code: course.code,
				name: course.name,
				semesterId: course.semesterId,
				instructor: course.instructor ?? '',
				credits: course.credits ? String(course.credits) : '',
				tag: course.tag ?? '',
				color: course.color ?? '',
				status: course.signals?.status ?? 'planned',
				riskLevel: course.signals?.riskLevel ?? 'none',
				currentGrade:
					course.signals?.currentGrade !== undefined ? String(course.signals.currentGrade) : '',
				topics: course.signals?.topics ? course.signals.topics.join(', ') : ''
			};
		} else {
			const presetSemester = semesters.some((semester) => semester.id === defaultSemesterId)
				? defaultSemesterId
				: semesters[0]?.id;
			form = {
				code: '',
				name: '',
				semesterId: presetSemester ?? '',
				instructor: '',
				credits: '',
				tag: '',
				color: '',
				status: 'planned',
				riskLevel: 'none',
				currentGrade: '',
				topics: ''
			};
		}
		error = null;
	}

	$effect(() => {
		if (open) resetForm();
	});

	function closeModal() {
		open = false;
		error = null;
	}

	async function save() {
		if (!form.code.trim() || !form.name.trim() || !form.semesterId) {
			error = 'Code, name, and semester are required.';
			return;
		}

		saving = true;
		error = null;

		const topics = form.topics
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);

		const signals = {
			status: form.status,
			riskLevel: form.status === 'active' ? form.riskLevel : 'none',
			...(form.status === 'active' && form.currentGrade
				? { currentGrade: parseFloat(form.currentGrade) }
				: {}),
			...(topics.length > 0 ? { topics } : {})
		};

		const body: Record<string, unknown> = {
			code: form.code.trim().toUpperCase(),
			name: form.name.trim(),
			semesterId: form.semesterId,
			instructor: form.instructor.trim() || undefined,
			credits: form.credits ? parseInt(form.credits) : undefined,
			tag: form.tag.trim() || undefined,
			color: form.color || undefined,
			signals
		};

		try {
			const res = isEditing
				? await fetch('/api/courses', {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: course!.id, ...body })
					})
				: await fetch('/api/courses', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: crypto.randomUUID(), ...body })
					});
			if (!res.ok) {
				error = isEditing ? 'Failed to update course' : 'Failed to create course';
				return;
			}
			await invalidateAll();
			closeModal();
			onSaved?.();
		} catch {
			error = 'Network error. Is the server running?';
		} finally {
			saving = false;
		}
	}
</script>

<Dialog bind:open title={isEditing ? 'Edit Course' : 'Add Course'} class="modal">
	<form
		id="course-edit-form"
		class="modal-body"
		onsubmit={(event) => {
			event.preventDefault();
			void save();
		}}
	>
		<label>
			<span class="field-label font-mono">Course Code *</span>
			<input
				type="text"
				class="modal-input font-mono"
				placeholder="e.g. CSIS 3375"
				bind:value={form.code}
			/>
		</label>
		<label>
			<span class="field-label font-mono">Course Name *</span>
			<input
				type="text"
				class="modal-input"
				placeholder="e.g. Database Systems"
				bind:value={form.name}
			/>
		</label>
		{#if !isEditing && lockSemester}
			{@const selectedSemester = semesters.find((sem) => sem.id === form.semesterId)}
			<p class="semester-context">
				Adding to {selectedSemester
					? `${selectedSemester.term} ${selectedSemester.year}`
					: 'the selected semester'}
			</p>
		{/if}
		<details open={isEditing}>
			<summary>More details</summary>
			{#if isEditing || !lockSemester}
				<label>
					<span class="field-label font-mono">Semester *</span>
					<select class="modal-input" bind:value={form.semesterId}>
						<option value="">Select semester…</option>
						{#each semesters as sem (sem.id)}<option value={sem.id}>{sem.term} {sem.year}</option
							>{/each}
					</select>
				</label>
			{/if}
			<label>
				<span class="field-label font-mono">Instructor</span>
				<input
					type="text"
					class="modal-input"
					placeholder="e.g. Dr. Anil Goel"
					bind:value={form.instructor}
				/>
			</label>
			<div class="modal-row">
				<label>
					<span class="field-label font-mono">Credits</span>
					<input
						type="number"
						class="modal-input short"
						placeholder="3"
						min="1"
						max="6"
						bind:value={form.credits}
					/>
				</label>
				<label>
					<span class="field-label font-mono">Tag</span>
					<input
						type="text"
						class="modal-input"
						placeholder="e.g. core"
						list="known-tags"
						bind:value={form.tag}
					/>
					<datalist id="known-tags">
						{#each TAGS as tag (tag)}
							<option value={tag}></option>
						{/each}
					</datalist>
				</label>
			</div>

			<div class="color-picker">
				<span class="field-label font-mono">Color</span>
				<div class="color-swatches">
					<button
						type="button"
						class="color-swatch"
						class:selected={form.color === ''}
						onclick={() => (form.color = '')}
						aria-label="No color">—</button
					>
					{#each COLOR_PRESETS as color (color)}
						<button
							type="button"
							class="color-swatch"
							style="background: {color}"
							class:selected={form.color === color}
							onclick={() => (form.color = color)}
							aria-label="Color {color}"
						></button>
					{/each}
				</div>
			</div>

			<div class="modal-row">
				<label>
					<span class="field-label font-mono">Status</span>
					<select class="modal-input" bind:value={form.status}>
						<option value="planned">planned</option>
						<option value="active">active</option>
						<option value="completed">completed</option>
						<option value="at-risk">at-risk</option>
					</select>
				</label>
				{#if form.status === 'active'}
					<label>
						<span class="field-label font-mono">Risk Level</span>
						<select class="modal-input" bind:value={form.riskLevel}>
							<option value="none">none</option>
							<option value="low">low</option>
							<option value="medium">medium</option>
							<option value="high">high</option>
						</select>
					</label>
				{/if}
			</div>

			{#if form.status === 'active'}
				<label>
					<span class="field-label font-mono">Current Grade</span>
					<input
						type="number"
						class="modal-input short"
						placeholder="e.g. 87.5"
						min="0"
						max="100"
						step="0.1"
						bind:value={form.currentGrade}
					/>
				</label>
			{/if}

			<label>
				<span class="field-label font-mono">Topics (comma-separated)</span>
				<textarea
					class="modal-input"
					rows="2"
					placeholder="e.g. SQL, normalization, indexing"
					bind:value={form.topics}
				></textarea>
			</label>
		</details>

		{#if error}
			<p class="modal-error" role="alert">{error}</p>
		{/if}
	</form>

	<div class="modal-actions">
		<button type="button" class="btn btn-ghost btn-sm" onclick={closeModal}>cancel</button>
		<button type="submit" form="course-edit-form" class="btn btn-primary btn-sm" disabled={saving}>
			{saving ? 'saving…' : isEditing ? 'save changes' : 'add course'}
		</button>
	</div>
</Dialog>

<style>
	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		margin-bottom: 1.25rem;
	}

	.modal-body label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-label {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.modal-input {
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--rule);
		background: white;
		color: var(--ink);
		font-size: 0.85rem;
		font-family: var(--font-body);
		outline: none;
	}

	.modal-input:focus {
		outline: 2px solid var(--ink);
		outline-offset: -1px;
	}

	.modal-input.short {
		width: 100px;
	}

	.semester-context {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--ink-soft);
		margin: -0.2rem 0 0;
	}

	details {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	summary {
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--ink-soft);
		padding: 0.25rem 0;
	}

	summary:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.modal-row {
		display: flex;
		gap: 1rem;
	}

	.modal-row label {
		flex: 1;
	}

	.color-picker {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.color-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.color-swatch {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 1.5px solid var(--rule);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		font-size: 0.7rem;
		color: var(--ink-faint);
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			border-color 0.12s,
			transform 0.12s;
	}

	.color-swatch:hover {
		border-color: var(--ink);
		transform: scale(1.15);
	}

	.color-swatch.selected {
		border-color: var(--ink);
		border-width: 2.5px;
		transform: scale(1.15);
	}

	.modal-error {
		font-size: 0.72rem;
		color: var(--accent);
		margin: 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
