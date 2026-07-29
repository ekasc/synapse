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
	const message = async (res: Response, fallback: string) => {
		const body: unknown = await res.json().catch(() => null);
		return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
			? body.error
			: fallback;
	};
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

<svelte:head><title>{data.semester.term} {data.semester.year} · Synapse</title></svelte:head>
<div class="page-enter m-auto max-w-[var(--page-width)] pt-8 pb-16">
	<header
		class="flex items-start justify-between gap-4 border-b border-[var(--ink)] pb-5 max-sm:flex-col"
	>
		<div>
			<h1 class="page-title !m-0">{data.semester.term} {data.semester.year}</h1>
			<p class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]">
				{courses.length} course{courses.length === 1 ? '' : 's'}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<button class="btn btn-primary btn-sm" onclick={openAdd}>+ add course</button>
		</div>
	</header>
	{#if error}<p class="text-[var(--pen-red)] text-[var(--text-caption)]" role="alert">
			{error}
		</p>{/if}
	{#if courses.length === 0}<section class="py-12 text-[var(--ink-soft)]">
			<p>No courses in this semester yet.</p>
			<button class="btn btn-primary" onclick={openAdd}>Add your first course</button>
		</section>{:else}<ul class="my-6 list-none p-0">
			{#each courses as course (course.id)}<li
					class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-[var(--rule)] p-[0.8rem] max-sm:grid-cols-[1fr_auto]"
				>
					<a class="flex gap-4 text-[var(--ink)] no-underline" href={courseHref(course.id)}
						><strong class="min-w-24">{course.code}</strong><span>{course.name}</span></a
					><span
						class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)] max-sm:col-start-1"
						>{status(course)} · {course.credits ?? '—'} credits</span
					><button
						class="btn btn-ghost btn-sm max-sm:row-start-2"
						disabled={saving}
						onclick={() => {
							editing = course;
							showCourse = true;
						}}>edit</button
					><button
						class="btn btn-ghost btn-sm max-sm:row-start-2"
						disabled={saving}
						onclick={() => (deleteCourse = course)}>delete</button
					>
				</li>{/each}
		</ul>{/if}
	<div class="flex flex-wrap gap-2 border-t border-[var(--rule)] pt-4">
		<button class="btn btn-danger btn-sm" disabled={saving} onclick={() => (deleteSemester = true)}
			>delete semester</button
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
		? `Delete ${deleteCourse.code}? This also removes its course map connections.`
		: ''}
	confirmLabel="Delete"
	onConfirm={removeCourse}
	onCancel={() => (deleteCourse = null)}
/>
<AlertDialog
	open={deleteSemester}
	title="Delete semester?"
	description="All courses in this semester and their course map connections will be removed."
	confirmLabel="Delete semester"
	onConfirm={removeSemester}
	onCancel={() => (deleteSemester = false)}
/>
