<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { AlertDialog } from '$lib/components/ui';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import CourseEditDialog from '$lib/components/course/CourseEditDialog.svelte';

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
		color?: string;
		signals?: CourseSignal;
	};

	const courses = $derived(data.courses);
	const semesters = $derived(data.semesters);
	let searchQuery = $state('');

	let showModal = $state(false);
	let editingCourse = $state<Course | null>(null);
	let deleteConfirm = $state<string | null>(null);
	let error = $state<string | null>(null);

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
		editingCourse = null;
		showModal = true;
	}

	function openEdit(course: Course) {
		editingCourse = course;
		showModal = true;
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

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<h1 class="page-title font-display">Manage Courses</h1>
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

<CourseEditDialog bind:open={showModal} course={editingCourse} {semesters} />

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
		max-width: var(--page-width);
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
		transition: border-color 0.12s var(--ease-out-quart);
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
</style>
