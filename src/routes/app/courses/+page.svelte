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

<svelte:head><title>Course Map · Synapse</title></svelte:head>

<main class="courses-page">
	<header class="page-cover">
		<h1 class="page-title">Course Map</h1>
		<p class="page-tagline">Prerequisites by semester.</p>
	</header>

	{#if semesters.length === 0}
		<section class="empty-panel" aria-labelledby="empty-title">
			<h2 id="empty-title">Add a semester before building your course map.</h2>
			<a class="btn empty-action" href={resolve('/app/semesters')}>Add semester</a>
		</section>
	{:else if courses.length === 0}
		<section class="empty-panel" aria-labelledby="empty-title">
			<h2 id="empty-title">Add courses to see your degree path.</h2>
			<a class="btn empty-action" href={resolve('/app/semesters')}>Add course</a>
		</section>
	{:else}
		<section class="map-section" aria-label="Prerequisite plan">
			{#if !hasPrerequisites}
				<div class="no-relations">
					<strong>No prerequisites yet.</strong>
					<a
						class="btn"
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

<style>
	.courses-page {
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
		padding: clamp(1.25rem, 3vw, 2.5rem);
	}

	.map-section {
		min-width: 0;
		max-width: 100%;
		margin-top: 2rem;
	}

	.empty-panel h2 {
		font-family: var(--font-body);
		font-weight: 700;
		color: var(--ink);
	}

	.empty-action {
		margin-top: 1rem;
	}

	.no-relations {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 1rem;
		align-items: center;
		margin: 0 0 0.75rem;
		padding: 0.8rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		font-size: 0.82rem;
		color: var(--ink-soft);
	}

	.no-relations .btn {
		flex: 0 0 auto;
	}

	.empty-panel {
		margin-top: 2rem;
		padding: clamp(1rem, 3vw, 1.5rem);
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		box-shadow: 6px 6px 0 var(--shadow-ink);
	}

	.empty-panel h2 {
		margin: 0;
		font-size: 1.35rem;
	}

	@media (max-width: 720px) {
		.courses-page {
			padding: 1rem;
		}
	}
</style>
