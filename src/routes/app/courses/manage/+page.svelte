<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { AlertDialog, Dialog } from '$lib/components/ui';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';

	let { data }: { data: { semesters: Semester[]; courses: Course[] } } = $props();

	type Semester = { id: string; term: string; year: number; order: number };
	type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';
	type CourseSignal = {
		status?: CourseStatus;
		riskLevel?: RiskLevel;
		currentGrade?: number;
		topics?: string[];
	};
	type Course = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		tag?: string;
		signals?: CourseSignal;
	};

	const courses = $derived(data.courses);
	const semesters = $derived(data.semesters);
	let searchQuery = $state('');

	let showModal = $state(false);
	let editingId = $state<string | null>(null);
	let form = $state({
		code: '',
		name: '',
		semesterId: '',
		instructor: '',
		credits: '',
		tag: '',
		status: 'planned' as CourseStatus,
		riskLevel: 'none' as RiskLevel,
		currentGrade: '',
		topics: ''
	});
	let saving = $state(false);
	let deleteConfirm = $state<string | null>(null);
	let error = $state<string | null>(null);

	const TAGS = ['core', 'programming', 'math', 'systems', 'ai', 'writing'];

	const semestersById = $derived.by(() => {
		const m: Record<string, Semester> = {};
		for (const s of semesters) m[s.id] = s;
		return m;
	});

	const currentTermLabel = $derived.by(() => {
		if (semesters.length === 0) return 'No terms';
		const sorted = [...semesters].sort((a, b) => b.order - a.order);
		const term = sorted.find((s) => courses.some((c) => c.semesterId === s.id)) ?? sorted[0];
		return `${term.term} ${term.year}`;
	});

	const filtered = $derived(
		searchQuery
			? courses.filter(
					(c) =>
						c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
						c.name.toLowerCase().includes(searchQuery.toLowerCase())
				)
			: courses
	);

	function semesterLabel(semesterId: string): string {
		const s = semestersById[semesterId];
		return s ? `${s.term} ${s.year}` : 'Unplaced';
	}

	function openAdd() {
		editingId = null;
		form = {
			code: '',
			name: '',
			semesterId: semesters[0]?.id ?? '',
			instructor: '',
			credits: '',
			tag: '',
			status: 'planned',
			riskLevel: 'none',
			currentGrade: '',
			topics: ''
		};
		error = null;
		showModal = true;
	}

	function openEdit(course: Course) {
		editingId = course.id;
		form = {
			code: course.code,
			name: course.name,
			semesterId: course.semesterId,
			instructor: course.instructor ?? '',
			credits: course.credits ? String(course.credits) : '',
			tag: course.tag ?? '',
			status: course.signals?.status ?? 'planned',
			riskLevel: course.signals?.riskLevel ?? 'none',
			currentGrade:
				course.signals?.currentGrade !== undefined ? String(course.signals.currentGrade) : '',
			topics: course.signals?.topics ? course.signals.topics.join(', ') : ''
		};
		error = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingId = null;
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

		const signals: CourseSignal = {
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
			signals
		};

		try {
			const res = editingId
				? await fetch('/api/courses', {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: editingId, ...body })
					})
				: await fetch('/api/courses', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: crypto.randomUUID(), ...body })
					});
			if (!res.ok) {
				error = editingId ? 'Failed to update course' : 'Failed to create course';
				return;
			}
			await invalidateAll();
			closeModal();
		} catch {
			error = 'Network error. Is the server running?';
		} finally {
			saving = false;
		}
	}

	async function confirmDelete(id: string) {
		error = null;
		try {
			const res = await fetch('/api/courses', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) throw new Error('Failed to delete course');
			await invalidateAll();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Failed to delete course';
		}
		deleteConfirm = null;
	}
</script>

<svelte:head><title>Synapse · Manage Courses</title></svelte:head>

<CatalogHeader term={currentTermLabel} />

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<h1 class="page-title font-hand">Manage Courses</h1>
			<div class="page-actions">
				<button class="btn btn-primary btn-sm" onclick={openAdd}>+ add course</button>
			</div>
		</div>
		<div class="page-cover-row">
			<p class="page-tagline">
				<span class="tagline-num">{filtered.length}</span> of
				<span class="tagline-num">{courses.length}</span> course{courses.length === 1 ? '' : 's'} across
				<span class="tagline-num">{semesters.length}</span> term{semesters.length === 1 ? '' : 's'}
			</p>
			<label class="page-search" for="course-search">
				<span class="sr-only">Search courses</span>
				<input
					id="course-search"
					type="text"
					class="search-input font-mono"
					placeholder="Filter by code or name…"
					bind:value={searchQuery}
				/>
			</label>
		</div>
	</div>

	{#if error}
		<p class="error-toast font-mono">{error}</p>
	{/if}

	<SectionHead
		eyebrow={`${filtered.length} ${filtered.length === 1 ? 'row' : 'rows'}`}
		title="In the catalog"
	/>

	<div class="table-wrap surface-polaroid">
		<table class="course-table">
			<thead>
				<tr>
					<th class="font-mono">Code</th>
					<th class="font-mono">Name</th>
					<th class="font-mono">Semester</th>
					<th class="font-mono">Status</th>
					<th class="font-mono">Grade</th>
					<th class="font-mono">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as course (course.id)}
					<tr>
						<td class="cell-code font-mono">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a dynamic course id, not a static route -->
							<a
								href={`${resolveRoute(`/app/courses/${course.id}`)}?from=${encodeURIComponent('/app/courses/manage')}`}
								class="cell-code-link">{course.code}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</td>
						<td class="cell-name">{course.name}</td>
						<td class="cell-semester font-mono">{semesterLabel(course.semesterId)}</td>
						<td class="cell-status font-mono">
							{course.signals?.status ? course.signals.status.replaceAll('-', ' ') : '—'}
						</td>
						<td class="cell-grade font-mono">
							{course.signals?.currentGrade !== undefined ? course.signals.currentGrade : '—'}
						</td>
						<td class="cell-actions">
							<button class="btn btn-ghost btn-sm font-mono" onclick={() => openEdit(course)}
								>edit</button
							>
							<button
								class="btn btn-ghost btn-sm cell-delete font-mono"
								onclick={() => (deleteConfirm = course.id)}>delete</button
							>
						</td>
					</tr>
				{/each}
				{#if filtered.length === 0}
					<tr>
						<td colspan="6" class="empty-row">
							{courses.length === 0
								? 'No courses yet. Add one above.'
								: 'No courses match "' + searchQuery + '"'}
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<Dialog bind:open={showModal} title={editingId ? 'Edit Course' : 'Add Course'} class="modal">
	<div class="modal-body">
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
		<label>
			<span class="field-label font-mono">Semester *</span>
			<select class="modal-input" bind:value={form.semesterId}>
				<option value="">Select semester…</option>
				{#each semesters as sem (sem.id)}
					<option value={sem.id}>{sem.term} {sem.year}</option>
				{/each}
			</select>
		</label>
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

		{#if error}
			<p class="modal-error font-mono">{error}</p>
		{/if}
	</div>

	<div class="modal-actions">
		<button type="button" class="btn btn-ghost btn-sm" onclick={closeModal}>cancel</button>
		<button type="button" class="btn btn-primary btn-sm" onclick={save} disabled={saving}>
			{saving ? 'saving…' : editingId ? 'save changes' : 'add course'}
		</button>
	</div>
</Dialog>

<AlertDialog
	open={deleteConfirm !== null}
	title="Delete Course"
	description={`Remove ${courses.find((course) => course.id === deleteConfirm)?.code ?? 'this course'} from your course list? This will also remove its graph edges.`}
	confirmLabel="Delete"
	onConfirm={() => (deleteConfirm ? confirmDelete(deleteConfirm) : undefined)}
	onCancel={() => (deleteConfirm = null)}
/>

<style>
	.page {
		max-width: 1100px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0;
	}

	.page-actions {
		display: flex;
		gap: 0.5rem;
	}

	.page-search {
		min-width: 220px;
	}

	.search-input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.82rem;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--ink);
	}

	.error-toast {
		padding: 0.65rem 0.9rem;
		border: 1px solid var(--accent);
		background: var(--paper);
		color: var(--accent);
		font-size: 0.78rem;
		margin-bottom: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.table-wrap {
		padding: 0;
		overflow-x: auto;
	}

	.course-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.course-table th {
		text-align: left;
		padding: 0.6rem 0.75rem;
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		background: var(--paper-shelf);
		border-bottom: 1px solid var(--ink);
	}

	.course-table td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--rule);
		color: var(--ink);
	}

	.course-table tbody tr:hover {
		background: var(--paper-shelf);
	}

	.course-table tbody tr:last-child td {
		border-bottom: none;
	}

	.cell-code {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
	}

	.cell-code-link {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.12s;
	}

	.cell-code-link:hover {
		border-bottom-color: var(--accent);
	}

	.cell-name {
		color: var(--ink-soft);
	}

	.cell-semester {
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.cell-actions {
		white-space: nowrap;
	}

	.cell-delete:hover {
		color: var(--accent);
	}

	.empty-row {
		text-align: center;
		color: var(--ink-faint);
		font-size: 0.8rem;
		padding: 2rem !important;
		font-style: italic;
	}

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

	.modal-row {
		display: flex;
		gap: 1rem;
	}

	.modal-row label {
		flex: 1;
	}

	.modal-error {
		font-size: 0.72rem;
		color: var(--accent);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
