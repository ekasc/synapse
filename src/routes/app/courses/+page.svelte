<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import type { PageData } from './$types';

	type Course = PageData['courses'][number];
	type Semester = PageData['semesters'][number];
	type GraphEdge = PageData['graph']['edges'][number];

	type SemesterConnection = {
		id: string;
		from: Semester;
		to: Semester;
		total: number;
		types: { type: string; count: number }[];
		edges: {
			id: string;
			type: string;
			label: string;
			source: Course;
			target: Course;
		}[];
	};

	let { data }: { data: PageData } = $props();
	let { semesters, courses, graph } = $derived(data);

	const sortedSemesters = $derived([...semesters].sort((a, b) => a.order - b.order));

	const currentTermLabel = $derived.by(() => {
		if (sortedSemesters.length === 0) return 'All terms';

		const courseCounts: Record<string, number> = {};
		for (const course of courses) {
			courseCounts[course.semesterId] = (courseCounts[course.semesterId] ?? 0) + 1;
		}

		const latestTermWithCourses = [...sortedSemesters]
			.reverse()
			.find((semester) => (courseCounts[semester.id] ?? 0) > 0);
		const term = latestTermWithCourses ?? sortedSemesters[sortedSemesters.length - 1];

		return `${term.term} ${term.year}`;
	});

	const coursesById = $derived.by(() => {
		const byId: Record<string, Course> = {};
		for (const course of courses) byId[course.id] = course;
		return byId;
	});

	const coursesBySemester = $derived.by(() => {
		const grouped: Record<string, Course[]> = {};
		for (const semester of sortedSemesters) grouped[semester.id] = [];

		for (const course of courses) {
			(grouped[course.semesterId] ??= []).push(course);
		}

		for (const semesterCourses of Object.values(grouped)) {
			semesterCourses.sort((a, b) => a.code.localeCompare(b.code));
		}

		return grouped;
	});

	const connectionGraph = $derived.by(() => {
		const semestersById: Record<string, Semester> = {};
		for (const semester of sortedSemesters) semestersById[semester.id] = semester;
		const byPair: Record<string, SemesterConnection> = {};

		for (const edge of graph.edges) {
			if (edge.reviewStatus === 'rejected') continue;

			const source = coursesById[edge.source];
			const target = coursesById[edge.target];
			if (!source || !target || source.semesterId === target.semesterId) continue;

			const from = semestersById[source.semesterId];
			const to = semestersById[target.semesterId];
			if (!from || !to) continue;

			const pairKey = `${from.id}->${to.id}`;
			const type = cleanRelationType(edge);
			const connection = byPair[pairKey] ?? {
				id: pairKey,
				from,
				to,
				total: 0,
				types: [],
				edges: []
			};

			connection.total += 1;
			connection.edges.push({
				id: edge.id ?? `${edge.source}-${edge.target}-${type}-${connection.total}`,
				type,
				label: edge.label?.trim() || type,
				source,
				target
			});

			byPair[pairKey] = connection;
		}

		const orderBySemesterId: Record<string, number> = {};
		for (const [index, semester] of sortedSemesters.entries()) {
			orderBySemesterId[semester.id] = index;
		}

		const connections = Object.values(byPair).map((connection) => {
			const typeCounts: Record<string, number> = {};
			for (const edge of connection.edges) {
				typeCounts[edge.type] = (typeCounts[edge.type] ?? 0) + 1;
			}

			return {
				...connection,
				edges: connection.edges.sort((a, b) => a.source.code.localeCompare(b.source.code)),
				types: Object.entries(typeCounts)
					.map(([type, count]) => ({ type, count }))
					.sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
			};
		});

		connections.sort((a, b) => {
			const fromDiff = (orderBySemesterId[a.from.id] ?? 0) - (orderBySemesterId[b.from.id] ?? 0);
			if (fromDiff !== 0) return fromDiff;
			return (orderBySemesterId[a.to.id] ?? 0) - (orderBySemesterId[b.to.id] ?? 0);
		});

		return connections;
	});

	const totalInterSemesterLinks = $derived(
		connectionGraph.reduce((total, connection) => total + connection.total, 0)
	);

	const totalCatalogedCourses = $derived(courses.length);

	function cleanRelationType(edge: GraphEdge) {
		return edge.type?.trim() || edge.label?.trim() || 'related';
	}

	function semesterLabel(semester: Semester) {
		return `${semester.term} ${semester.year}`;
	}

	function courseCountLabel(count: number) {
		return `${count} course${count === 1 ? '' : 's'}`;
	}

	function relationTypeLabel(type: string) {
		return type.replaceAll('-', ' ');
	}
</script>

<svelte:head><title>Synapse · Semester Connection Graph</title></svelte:head>

<CatalogHeader term={currentTermLabel} />

<main class="courses-page">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<h1 class="page-title">Semester Connection Graph</h1>
				<p class="page-tagline">
					A catalog overview of how courses in one term feed into courses in another. Connections
					are summarized from saved course graph edges.
				</p>
			</div>

			<div class="catalog-stats" aria-label="Graph totals">
				<div class="catalog-stat">
					<span class="stat-value">{sortedSemesters.length}</span>
					<span class="stat-label">terms</span>
				</div>
				<div class="catalog-stat">
					<span class="stat-value">{totalCatalogedCourses}</span>
					<span class="stat-label">courses</span>
				</div>
				<div class="catalog-stat">
					<span class="stat-value">{totalInterSemesterLinks}</span>
					<span class="stat-label">cross-term links</span>
				</div>
			</div>
		</div>
	</div>

	<section class="semester-board" aria-labelledby="semester-board-title">
		<SectionHead eyebrow="Academic catalog" title="Terms in sequence" />

		{#if sortedSemesters.length === 0}
			<div class="empty-panel">
				<h2>No semesters cataloged yet.</h2>
				<p>Add semesters and courses to see a static connection map here.</p>
			</div>
		{:else}
			<div class="semester-columns" id="semester-board-title">
				{#each sortedSemesters as semester (semester.id)}
					{@const semesterCourses = coursesBySemester[semester.id] ?? []}
					<article class="semester-card">
						<header class="semester-card-head">
							<div>
								<h2>{semesterLabel(semester)}</h2>
								<p class="font-mono">{courseCountLabel(semesterCourses.length)}</p>
							</div>
						</header>

						<div class="course-list">
							{#each semesterCourses as course (course.id)}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a dynamic course id, not a static route -->
								<a
									class="course-card"
									href={`${resolveRoute(`/app/courses/${course.id}`)}?from=${encodeURIComponent('/app/courses')}`}
								>
									<div class="course-code font-mono">{course.code}</div>
									<div class="course-name">{course.name}</div>
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{:else}
								<p class="empty-course font-mono">No courses in this term.</p>
							{/each}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="connection-section" aria-labelledby="connection-summary-title">
		<SectionHead eyebrow="Derived from graph.edges" title="Inter-semester connections" />

		{#if connectionGraph.length === 0}
			<div class="empty-panel connection-empty">
				<div>
					<h2 id="connection-summary-title">No inter-semester links yet.</h2>
					<p>
						Courses are cataloged, but the saved graph does not currently connect courses across
						semester boundaries. Once prerequisites, corequisites, or related course edges cross
						terms, this page will summarize those semester-to-semester paths.
					</p>
				</div>
			</div>
		{:else}
			<div class="connection-list" id="connection-summary-title">
				{#each connectionGraph as connection (connection.id)}
					<article class="connection-row">
						<div class="connection-route">
							<div class="term-node">
								<span class="term-node-label font-mono">from</span>
								<strong>{semesterLabel(connection.from)}</strong>
							</div>
							<span class="route-arrow-text font-mono" aria-hidden="true">→</span>
							<div class="term-node target">
								<span class="term-node-label font-mono">to</span>
								<strong>{semesterLabel(connection.to)}</strong>
							</div>
						</div>

						<div class="connection-detail">
							<div class="connection-count font-mono">
								{connection.total} course link{connection.total === 1 ? '' : 's'}
							</div>

							<div class="relation-pills" aria-label="Relation type counts">
								{#each connection.types as relation (relation.type)}
									<span class="relation-pill font-mono">
										{relationTypeLabel(relation.type)} · {relation.count}
									</span>
								{/each}
							</div>

							<div class="edge-samples" aria-label="Course-level links">
								{#each connection.edges as edge (edge.id)}
									<div class="edge-sample font-mono">
										<span>{edge.source.code}</span>
										<span aria-hidden="true">→</span>
										<span>{edge.target.code}</span>
										<em>{relationTypeLabel(edge.type)}</em>
									</div>
								{/each}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>

<style>
	.courses-page {
		padding: clamp(1.25rem, 3vw, 2.5rem);
	}

	.catalog-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(92px, 1fr));
		border: 1px solid var(--ink);
		background: var(--paper-shelf);
		min-width: min(100%, 430px);
	}

	.catalog-stat {
		padding: 0.9rem 1rem;
		border-right: 1px solid var(--ink);
	}

	.catalog-stat:last-child {
		border-right: 0;
	}

	.stat-value,
	.stat-label {
		display: block;
	}

	.stat-value {
		font-family: var(--font-display);
		font-size: clamp(1.7rem, 3vw, 2.25rem);
		line-height: 1;
		color: var(--ink);
	}

	.stat-label {
		margin-top: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.semester-board,
	.connection-section {
		margin-top: 2.2rem;
	}

	.semester-columns {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(260px, 1fr);
		align-items: stretch;
		gap: 0.85rem;
		overflow-x: auto;
		padding: 0.2rem 0 1rem;
	}

	.semester-card,
	.connection-row,
	.empty-panel {
		border: 1px solid var(--ink);
		background: #fbf8f0;
		box-shadow: 6px 6px 0 rgba(31, 28, 20, 0.09);
	}

	.semester-card {
		min-height: 100%;
	}

	.semester-card-head {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
		padding: 1rem;
		border-bottom: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.semester-card h2,
	.empty-panel h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.45rem;
		line-height: 1.05;
		color: var(--ink);
	}

	.semester-card-head p {
		margin: 0.25rem 0 0;
		font-size: 0.68rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.course-list {
		display: grid;
		gap: 0.65rem;
		padding: 0.85rem;
	}

	.course-card {
		padding: 0.75rem;
		border: 1px solid rgba(31, 28, 20, 0.2);
		background: var(--paper);
		color: var(--ink);
		text-decoration: none;
		transition: border-color 0.12s;
	}

	.course-card:hover {
		border-color: var(--ink);
	}

	.course-code {
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
	}

	.course-name {
		margin-top: 0.35rem;
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.2;
		color: var(--ink);
	}

	.empty-course {
		margin: 0;
		padding: 0.85rem;
		border: 1px dashed rgba(31, 28, 20, 0.3);
		font-size: 0.74rem;
		color: var(--ink-soft);
	}

	.empty-panel {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: clamp(1rem, 3vw, 1.5rem);
	}

	.empty-panel p {
		max-width: 62ch;
		margin: 0.35rem 0 0;
		color: var(--ink-soft);
		line-height: 1.5;
	}

	.connection-list {
		display: grid;
		gap: 1rem;
	}

	.connection-row {
		display: grid;
		grid-template-columns: minmax(280px, 0.9fr) minmax(280px, 1.1fr);
		gap: 1rem;
		padding: 1rem;
	}

	.connection-route {
		display: grid;
		grid-template-columns: 1fr minmax(90px, 150px) 1fr;
		align-items: center;
		gap: 0.5rem;
	}

	.term-node {
		padding: 0.8rem;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	.term-node.target {
		background: var(--paper-shelf);
	}

	.term-node-label {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.term-node strong {
		font-family: var(--font-display);
		font-size: 1.15rem;
		line-height: 1.05;
	}

	.route-arrow-text {
		font-family: var(--font-mono);
		font-size: 1.2rem;
		color: var(--ink-soft);
		text-align: center;
	}

	.connection-detail {
		display: grid;
		gap: 0.65rem;
		align-content: center;
	}

	.connection-count {
		font-size: 0.74rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.relation-pills,
	.edge-samples {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.relation-pill,
	.edge-sample {
		border: 1px solid rgba(31, 28, 20, 0.24);
		background: var(--paper);
		color: var(--ink);
	}

	.relation-pill {
		padding: 0.3rem 0.55rem;
		font-size: 0.64rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.edge-sample {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.34rem 0.5rem;
		font-size: 0.68rem;
	}

	.edge-sample em {
		font-style: normal;
		color: var(--ink-faint);
	}

	@media (max-width: 920px) {
		.catalog-stats {
			width: 100%;
		}

		.connection-row {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.courses-page {
			padding: 1rem;
		}

		.catalog-stats {
			grid-template-columns: 1fr;
		}

		.catalog-stat {
			border-right: 0;
			border-bottom: 1px solid var(--ink);
		}

		.catalog-stat:last-child {
			border-bottom: 0;
		}

		.connection-route {
			grid-template-columns: 1fr;
		}

		.route-arrow-text {
			transform: rotate(90deg);
			justify-self: center;
		}
	}
</style>
