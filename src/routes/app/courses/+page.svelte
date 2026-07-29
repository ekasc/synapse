<script lang="ts">
	import { resolve } from '$app/paths';
	import CourseMap from '$lib/components/course-map/CourseMap.svelte';
	import type { MapCourse, MapRelation, MapSemester } from '$lib/components/course-map/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const semesters = $derived(data.semesters as MapSemester[]);
	const courses = $derived(data.courses as MapCourse[]);
	const relations = $derived.by(() =>
		data.graph.edges.flatMap((edge, index): MapRelation[] => {
			if (!edge.source || !edge.target || !edge.type) return [];
			return [
				{
					id: edge.id ?? `${edge.source}:${edge.target}:${edge.type}:${index}`,
					source: edge.source,
					target: edge.target,
					type: edge.type,
					reviewStatus: edge.reviewStatus
				}
			];
		})
	);
	const hasPrerequisites = $derived(
		relations.some((relation) => relation.type === 'prereq' && relation.reviewStatus !== 'rejected')
	);
</script>

<svelte:head><title>Course map · Synapse</title></svelte:head>

<main class="box-border max-w-full min-w-0 p-[clamp(1.25rem,3vw,2.5rem)] max-[720px]:p-4">
	<header class="page-cover">
		<h1 class="page-title">Course map</h1>
		<p class="page-tagline">Prerequisites by semester.</p>
	</header>

	{#if semesters.length === 0}
		<section
			class="mt-8 border border-[var(--ink)] bg-[var(--surface-paper)] p-[clamp(1rem,3vw,1.5rem)] shadow-[6px_6px_0_var(--shadow-ink)]"
			aria-labelledby="empty-title"
		>
			<h2
				id="empty-title"
				class="m-0 text-[1.35rem] font-[var(--font-body)] font-bold text-[var(--ink)]"
			>
				Add a semester before building your course map.
			</h2>
			<a class="btn mt-4" href={resolve('/app/semesters')}>Add semester</a>
		</section>
	{:else if courses.length === 0}
		<section
			class="mt-8 border border-[var(--ink)] bg-[var(--surface-paper)] p-[clamp(1rem,3vw,1.5rem)] shadow-[6px_6px_0_var(--shadow-ink)]"
			aria-labelledby="empty-title"
		>
			<h2
				id="empty-title"
				class="m-0 text-[1.35rem] font-[var(--font-body)] font-bold text-[var(--ink)]"
			>
				Add courses to see your degree path.
			</h2>
			<a class="btn mt-4" href={resolve('/app/semesters')}>Add course</a>
		</section>
	{:else}
		<section class="mt-8 max-w-full min-w-0" aria-label="Prerequisite plan">
			{#if !hasPrerequisites}
				<div
					class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-[0.45rem] border border-[var(--rule)] bg-[var(--paper-shelf)] p-[0.8rem] text-[var(--ink-soft)] text-[var(--text-caption)]"
				>
					<strong>No prerequisites yet.</strong>
					<a
						class="btn shrink-0"
						href={resolve('/app/semesters/[semesterId]/courses/[courseId]', {
							semesterId: courses[0].semesterId,
							courseId: courses[0].id
						})}>Choose a course</a
					>
				</div>
			{/if}

			<CourseMap {courses} {semesters} {relations} />
		</section>
	{/if}
</main>
