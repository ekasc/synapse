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

<svelte:head><title>Synapse · Course Map</title></svelte:head>

<main class="courses-page">
	<header class="page-cover">
		<h1 class="page-title">Course Map</h1>
		<p class="page-tagline">
			Follow prerequisite paths across semesters and inspect what blocks each course.
		</p>
	</header>

	{#if semesters.length === 0}
		<section class="empty-panel" aria-labelledby="empty-title">
			<h2 id="empty-title">Add a semester before building your course map.</h2>
			<a class="empty-action" href={resolve('/app/semesters')}>Add semester</a>
		</section>
	{:else if courses.length === 0}
		<section class="empty-panel" aria-labelledby="empty-title">
			<h2 id="empty-title">Add courses to see your degree path.</h2>
			<a class="empty-action" href={resolve('/app/semesters')}>Add course</a>
		</section>
	{:else}
		<section class="map-section" aria-labelledby="map-title">
			<div class="map-heading">
				<div>
					<p class="eyebrow font-mono">Degree sequence</p>
					<h2 id="map-title">Prerequisite paths</h2>
				</div>
				<div class="legend font-mono" aria-label="Course map legend">
					<span><i class="legend-line accepted"></i> Accepted prerequisite</span>
					<span><i class="legend-line pending"></i> Pending review</span>
					<span><i class="legend-box upstream"></i> Prerequisite</span>
					<span><i class="legend-box downstream"></i> Unlocked course</span>
				</div>
			</div>

			{#if !hasPrerequisites}
				<p class="no-relations">No prerequisite relationships have been added yet.</p>
			{/if}

			<CourseMap {courses} {semesters} {relations} />
		</section>
	{/if}
</main>

<style>
	.courses-page {
		padding: clamp(1.25rem, 3vw, 2.5rem);
	}

	.map-section {
		margin-top: 2rem;
	}

	.map-heading {
		display: flex;
		gap: 1rem 2rem;
		align-items: end;
		justify-content: space-between;
		margin-bottom: 0.9rem;
	}

	.eyebrow,
	.map-heading h2 {
		margin: 0;
	}

	.eyebrow {
		font-size: 0.65rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.map-heading h2,
	.empty-panel h2 {
		font-family: var(--font-display);
		color: var(--ink);
	}

	.empty-action {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin-top: 1rem;
		padding: 0 1rem;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--surface-paper);
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
	}

	.empty-action:hover {
		background: var(--accent);
	}

	.empty-action:focus-visible {
		outline: 3px solid var(--accent);
		outline-offset: 3px;
	}

	.map-heading h2 {
		margin-top: 0.2rem;
		font-size: clamp(1.5rem, 3vw, 2rem);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 1rem;
		justify-content: flex-end;
		font-size: 0.62rem;
		color: var(--ink-soft);
	}

	.legend span {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}

	.legend-line {
		display: inline-block;
		width: 24px;
		border-top: 2px solid var(--ink-soft);
	}

	.legend-line.pending {
		border-top-style: dashed;
	}

	.legend-box {
		display: inline-block;
		width: 11px;
		height: 11px;
		border: 2px solid;
	}

	.legend-box.upstream {
		border-color: var(--pen-blue, #315c91);
	}

	.legend-box.downstream {
		border-color: var(--pen-red, #a43a32);
	}

	.no-relations {
		margin: 0 0 0.75rem;
		padding: 0.65rem 0.8rem;
		border-left: 3px solid var(--highlight);
		background: var(--paper-shelf);
		font-size: 0.82rem;
		color: var(--ink-soft);
	}

	.empty-panel {
		margin-top: 2rem;
		padding: clamp(1rem, 3vw, 1.5rem);
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		box-shadow: 6px 6px 0 rgba(31, 28, 20, 0.09);
	}

	.empty-panel h2 {
		margin: 0;
		font-size: 1.35rem;
	}

	@media (max-width: 1100px) {
		.map-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.legend {
			justify-content: flex-start;
		}
	}

	@media (max-width: 720px) {
		.courses-page {
			padding: 1rem;
		}
	}
</style>
