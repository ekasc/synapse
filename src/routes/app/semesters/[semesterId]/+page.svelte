<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { AlertDialog } from '$lib/components/ui';
	import CourseEditDialog from '$lib/components/course/CourseEditDialog.svelte';
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
		credits?: number;
		signals?: CourseSignal;
	};
	type Semester = {
		id: string;
		term: 'Winter' | 'Spring' | 'Summer' | 'Fall';
		year: number;
		order: number;
	};
	let { data } = $props<{
		data: { semester: Semester; semesters: Semester[]; courses: Course[] };
	}>();
	let showCourse = $state(false),
		editing = $state<Course | null>(null),
		deleteCourse = $state<Course | null>(null);
	let deleteSemester = $state(false),
		saving = $state(false),
		error = $state<string | null>(null);
	const courses = $derived(data.courses);
	const status = (course: Course) => course.signals?.status?.replaceAll('-', ' ') ?? 'planned';
	const message = async (res: Response, fallback: string) =>
		(await res.json().catch(() => null))?.error ?? fallback;
	function courseHref(id: string) {
		return `/app/semesters/${encodeURIComponent(data.semester.id)}/courses/${encodeURIComponent(id)}`;
	}
	function openAdd() {
		editing = null;
		showCourse = true;
	}
	async function removeCourse() {
		if (!deleteCourse) return;
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/courses', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: deleteCourse.id })
			});
			if (!res.ok) {
				error = await message(res, 'Could not delete course.');
				return;
			}
			deleteCourse = null;
			await invalidateAll();
		} catch {
			error = 'Network error. Is the server running?';
		} finally {
			saving = false;
		}
	}
	async function removeSemester() {
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/semesters', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: data.semester.id })
			});
			if (!res.ok) {
				error = await message(res, 'Could not delete semester.');
				return;
			}
			deleteSemester = false;
			await goto('/app/semesters', { invalidateAll: true, replaceState: true });
		} catch {
			error = 'Network error. Is the server running?';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Synapse · {data.semester.term} {data.semester.year}</title></svelte:head>
<div class="page page-enter">
	<header class="cover">
		<div>
			<h1 class="page-title font-display">{data.semester.term} {data.semester.year}</h1>
			<p class="meta font-mono">{courses.length} course{courses.length === 1 ? '' : 's'}</p>
		</div>
		<div class="actions">
			<button class="btn btn-primary btn-sm" onclick={openAdd}>+ add course</button>
		</div>
	</header>
	{#if error}<p class="form-error" role="alert">{error}</p>{/if}
	{#if courses.length === 0}<section class="empty">
			<p>No courses in this semester yet.</p>
			<button class="btn btn-primary" onclick={openAdd}>Add your first course</button>
		</section>{:else}<ul class="course-list">
			{#each courses as course (course.id)}<li>
					<a href={courseHref(course.id)}
						><strong class="font-mono">{course.code}</strong><span>{course.name}</span></a
					><span class="meta font-mono">{status(course)} · {course.credits ?? '—'} credits</span
					><button
						class="btn btn-ghost btn-sm"
						disabled={saving}
						onclick={() => {
							editing = course;
							showCourse = true;
						}}>edit</button
					><button
						class="btn btn-ghost btn-sm"
						disabled={saving}
						onclick={() => (deleteCourse = course)}>delete</button
					>
				</li>{/each}
		</ul>{/if}
	<div class="semester-actions">
		<button
			class="btn btn-ghost btn-sm danger"
			disabled={saving}
			onclick={() => (deleteSemester = true)}>delete semester</button
		>
	</div>
</div>
<CourseEditDialog
	bind:open={showCourse}
	course={editing}
	semesters={data.semesters}
	defaultSemesterId={data.semester.id}
	lockSemester={true}
/>
<AlertDialog
	open={deleteCourse !== null}
	title="Delete course?"
	description={deleteCourse
		? `Delete ${deleteCourse.code}? This also removes its graph connections.`
		: ''}
	confirmLabel="Delete"
	onConfirm={removeCourse}
	onCancel={() => (deleteCourse = null)}
/>
<AlertDialog
	open={deleteSemester}
	title="Delete semester?"
	description="All courses in this semester and their graph edges will be removed."
	confirmLabel="Delete semester"
	onConfirm={removeSemester}
	onCancel={() => (deleteSemester = false)}
/>

<style>
	.page {
		max-width: var(--page-width);
		margin: auto;
		padding: 2rem 1rem 4rem;
	}
	.cover {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		border-bottom: 1px solid var(--ink);
		padding-bottom: 1.25rem;
	}
	.page-title {
		margin: 0;
		color: var(--ink);
		font-size: clamp(2.2rem, 4vw, 3rem);
	}
	.meta {
		color: var(--ink-faint);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.actions,
	.semester-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.course-list {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0;
	}
	.course-list li {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.8rem;
		border-bottom: 1px solid var(--rule);
	}
	.course-list a {
		display: flex;
		gap: 1rem;
		color: var(--ink);
		text-decoration: none;
	}
	.course-list a strong {
		min-width: 6rem;
	}
	.empty {
		padding: 3rem 0;
		color: var(--ink-soft);
	}
	.semester-actions {
		border-top: 1px solid var(--rule);
		padding-top: 1rem;
	}
	.danger {
		color: var(--accent);
	}
	.form-error {
		color: var(--accent);
		font-size: 0.85rem;
	}
	@media (max-width: 640px) {
		.cover {
			flex-direction: column;
		}
		.course-list li {
			grid-template-columns: 1fr auto;
		}
		.course-list .meta {
			grid-column: 1;
		}
		.course-list button {
			grid-row: 2;
		}
	}
</style>
