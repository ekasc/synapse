<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import CourseMapEdge from './CourseMapEdge.svelte';
	import CourseMapNode from './CourseMapNode.svelte';
	import DependencyInspector from './DependencyInspector.svelte';
	import PlanningScenarioPanel from './PlanningScenarioPanel.svelte';
	import SavedScenariosPanel from './SavedScenariosPanel.svelte';
	import {
		applyPlanningMove,
		createPlanningScenario,
		resetPlanningScenario,
		undoLastPlanningMove,
		undoPlanningMove
	} from './planning';
	import {
		decodeSharedScenario,
		encodeSharedScenario,
		replaySharedScenario,
		type SharedScenarioSourceState
	} from './sharing';
	import {
		CANVAS_PADDING,
		COLUMN_GAP,
		createStaticLayout,
		getOrderedColumns,
		NODE_WIDTH
	} from './layout';
	import { findPrerequisiteCycles, getAllDependants, getAllPrerequisites } from './traversal';
	import type { MapCourse, MapRelation, MapSemester } from './types';
	import {
		isAssociationDirty,
		type SavedScenarioAssociation,
		type StoredScenario
	} from './saved-scenarios';

	interface Props {
		courses: MapCourse[];
		semesters: MapSemester[];
		relations: MapRelation[];
	}

	let { courses, semesters, relations }: Props = $props();
	let selectedId = $state<string | null>(null);
	let canScrollFurther = $state(true);
	let scenario = $derived(createPlanningScenario(courses, semesters, relations));
	let sharedSource = $state<SharedScenarioSourceState>({ status: 'none' });
	let savedAssociation = $state<SavedScenarioAssociation | null>(null);
	const displayedCourses = $derived(scenario.currentCourses);
	const layout = $derived(createStaticLayout(displayedCourses, semesters));
	const columns = $derived(getOrderedColumns(courses, semesters));
	const visibleRelations = $derived(
		relations.filter(
			(relation) =>
				relation.type === 'prereq' &&
				relation.reviewStatus !== 'rejected' &&
				layout.positions[relation.source] &&
				layout.positions[relation.target]
		)
	);
	const upstream = $derived(new Set(selectedId ? getAllPrerequisites(selectedId, relations) : []));
	const downstream = $derived(new Set(selectedId ? getAllDependants(selectedId, relations) : []));
	const cycles = $derived(findPrerequisiteCycles(courses, relations));
	const selectedCourse = $derived(displayedCourses.find((course) => course.id === selectedId));
	const conflictIds = $derived(
		new Set(scenario.comparison.newConflicts.map((violation) => violation.courseId))
	);
	const resolvedIds = $derived(
		new Set(scenario.comparison.resolvedConflicts.map((violation) => violation.courseId))
	);
	const movedIds = $derived(new Set(scenario.comparison.changedCourseIds));
	const storedMoves = $derived(
		scenario.moves.map(({ courseId, targetSemesterId }) => ({ courseId, targetSemesterId }))
	);
	const savedScenarioDirty = $derived(isAssociationDirty(savedAssociation, storedMoves));
	const selectedCycle = $derived(
		selectedId ? cycles.find((cycle) => cycle.slice(0, -1).includes(selectedId!)) : undefined
	);

	function inspect(courseId: string) {
		selectedId = selectedId === courseId ? null : courseId;
	}

	function nodeState(courseId: string) {
		if (conflictIds.has(courseId)) return 'conflict' as const;
		if (resolvedIds.has(courseId)) return 'resolved' as const;
		if (!selectedId || courseId === selectedId) return 'default' as const;
		if (upstream.has(courseId)) return 'upstream' as const;
		if (downstream.has(courseId)) return 'downstream' as const;
		return 'muted' as const;
	}

	function edgeIsMuted(relation: MapRelation) {
		if (!selectedId) return false;
		const connected = new Set([selectedId, ...upstream, ...downstream]);
		return !connected.has(relation.source) || !connected.has(relation.target);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			selectedId = null;
		}
	}

	function applyMove(courseId: string, targetSemesterId: string) {
		const applied = applyPlanningMove(scenario, courseId, targetSemesterId, semesters, relations);
		scenario = applied.scenario;
		if (
			(applied.result.status === 'valid' || applied.result.status === 'invalid') &&
			sharedSource.status === 'loaded'
		) {
			sharedSource = { ...sharedSource, modified: true };
		}
		return applied.result;
	}

	function jumpToCourse(courseId: string) {
		selectedId = courseId;
	}

	function updateScrollCue(event: Event) {
		const scrollRegion = event.currentTarget as HTMLDivElement;
		canScrollFurther =
			scrollRegion.scrollLeft + scrollRegion.clientWidth < scrollRegion.scrollWidth - 2;
	}

	function updateScenario(nextScenario: typeof scenario) {
		scenario = nextScenario;
		if (sharedSource.status === 'loaded') sharedSource = { ...sharedSource, modified: true };
	}

	async function copyScenarioLink() {
		const encoded = encodeSharedScenario(scenario.moves);
		if (encoded.status === 'invalid') return { status: 'failed' as const, url: '' };
		const url = new URL(page.url);
		url.searchParams.set('plan', encoded.value);
		try {
			await navigator.clipboard.writeText(url.toString());
			return { status: 'copied' as const, url: url.toString() };
		} catch {
			return { status: 'failed' as const, url: url.toString() };
		}
	}

	function clearSharedScenario() {
		scenario = createPlanningScenario(courses, semesters, relations);
		sharedSource = { status: 'none' };
		const url = new URL(window.location.href);
		url.searchParams.delete('plan');
		window.history.replaceState(window.history.state, '', url);
	}

	function loadSavedScenario(stored: StoredScenario) {
		const replay = replaySharedScenario(
			{ version: 1, moves: stored.moves },
			courses,
			semesters,
			relations
		);
		scenario = replay.scenario;
		sharedSource = { status: 'none' };
		const url = new URL(window.location.href);
		url.searchParams.delete('plan');
		window.history.replaceState(window.history.state, '', url);
		return replay;
	}

	function resetScenario() {
		if (sharedSource.status === 'loaded' || sharedSource.status === 'invalid') {
			clearSharedScenario();
			return;
		}
		scenario = resetPlanningScenario(scenario, semesters, relations);
	}

	onMount(() => {
		const decoded = decodeSharedScenario(page.url.searchParams.get('plan'));
		if (decoded.status === 'invalid') {
			sharedSource = decoded;
			return;
		}
		if (decoded.status === 'valid') {
			const replay = replaySharedScenario(decoded.payload, courses, semesters, relations);
			scenario = replay.scenario;
			sharedSource = { status: 'loaded', replay, modified: false };
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="map-shell">
	<p class:at-end={!canScrollFurther} class="scroll-cue font-mono">Swipe to explore semesters</p>
	<SavedScenariosPanel
		moves={storedMoves}
		association={savedAssociation}
		dirty={savedScenarioDirty}
		onassociationchange={(association) => (savedAssociation = association)}
		onloadscenario={loadSavedScenario}
	/>
	<PlanningScenarioPanel
		{scenario}
		{semesters}
		{sharedSource}
		onundo={(moveId) => updateScenario(undoPlanningMove(scenario, moveId, semesters, relations))}
		onundolast={() => updateScenario(undoLastPlanningMove(scenario, semesters, relations))}
		onreset={resetScenario}
		onjump={jumpToCourse}
		oncopy={copyScenarioLink}
		onclearshared={clearSharedScenario}
	/>
	{#if scenario.moves.length > 0}
		<div class="scenario-legend font-mono" aria-label="Planning scenario legend">
			<span><i class="preview-mark"></i> Moved course</span>
			{#if conflictIds.size > 0}<span><i class="conflict-mark"></i> New conflict</span>{/if}
			{#if resolvedIds.size > 0}<span><i class="resolved-mark"></i> Resolved issue</span>{/if}
		</div>
	{/if}
	<div class:at-end={!canScrollFurther} class="scroll-frame">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="scroll-region"
			role="region"
			tabindex="0"
			aria-label="Course prerequisite map. Scroll horizontally to see later semesters."
			onscroll={updateScrollCue}
		>
			<div class="canvas" style:width={`${layout.width}px`} style:height={`${layout.height}px`}>
				{#each columns as column, index (column.id)}
					<div
						class="semester-heading"
						style:left={`${CANVAS_PADDING + index * (NODE_WIDTH + COLUMN_GAP)}px`}
						style:width={`${NODE_WIDTH}px`}
					>
						<span class="font-mono">
							{column.id === '__unplaced__' ? 'Not yet scheduled' : `Semester ${index + 1}`}
						</span>
						<strong>{column.label}</strong>
					</div>
				{/each}

				<svg class="edges" width={layout.width} height={layout.height} aria-hidden="true">
					<defs>
						<marker
							id="course-map-arrow"
							viewBox="0 0 10 10"
							refX="8"
							refY="5"
							markerWidth="5"
							markerHeight="5"
							orient="auto-start-reverse"
						>
							<path d="M 0 0 L 10 5 L 0 10 z" class="arrow" />
						</marker>
					</defs>
					{#each visibleRelations as relation (relation.id)}
						<CourseMapEdge
							{relation}
							source={layout.positions[relation.source]}
							target={layout.positions[relation.target]}
							muted={edgeIsMuted(relation)}
						/>
					{/each}
				</svg>

				{#each displayedCourses as course (course.id)}
					{@const position = layout.positions[course.id]}
					{#if position}
						<CourseMapNode
							{course}
							{position}
							state={nodeState(course.id)}
							selected={selectedId === course.id}
							preview={movedIds.has(course.id)}
							oninspect={inspect}
						/>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	{#if selectedCourse}
		{#key selectedCourse.id}
			<DependencyInspector
				course={selectedCourse}
				courses={displayedCourses}
				{semesters}
				{relations}
				cycle={selectedCycle}
				onapplymove={applyMove}
			/>
		{/key}
	{/if}
</div>

<style>
	.scroll-frame {
		position: relative;
	}

	.scroll-frame::after {
		position: absolute;
		top: 1px;
		right: 1px;
		bottom: 1px;
		z-index: 3;
		width: 42px;
		background: linear-gradient(to right, transparent, var(--paper-shelf));
		content: '';
		pointer-events: none;
		transition: opacity 0.15s ease;
	}

	.scroll-frame.at-end::after {
		opacity: 0;
	}

	.scroll-cue {
		display: none;
		margin: 0 0 0.45rem;
		font-size: 0.65rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.scroll-cue.at-end {
		visibility: hidden;
	}

	.scenario-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 1rem;
		margin: 0 0 0.5rem;
		font-size: 0.62rem;
		color: var(--ink-soft);
	}

	.scenario-legend span {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
	}

	.scenario-legend i {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid;
	}

	.preview-mark,
	.resolved-mark {
		border-color: var(--ok) !important;
	}

	.preview-mark {
		border-style: double !important;
	}

	.conflict-mark {
		border-color: var(--accent) !important;
	}

	.scroll-region {
		max-width: 100%;
		overflow-x: auto;
		border: 1px solid var(--ink);
		background: var(--paper-shelf);
		overscroll-behavior-inline: contain;
	}

	.scroll-region:focus-visible {
		outline: 3px solid var(--highlight);
		outline-offset: 2px;
	}

	.canvas {
		position: relative;
		min-width: 100%;
		background-image: linear-gradient(to bottom, transparent 31px, rgba(31, 28, 20, 0.06) 32px);
		background-size: 100% 32px;
	}

	.semester-heading {
		position: absolute;
		top: 28px;
		z-index: 2;
		padding-bottom: 0.55rem;
		border-bottom: 2px solid var(--ink);
	}

	.semester-heading span,
	.semester-heading strong {
		display: block;
	}

	.semester-heading span {
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.semester-heading strong {
		margin-top: 0.15rem;
		font-family: var(--font-display);
		font-size: 1.1rem;
	}

	.edges {
		position: absolute;
		inset: 0;
		z-index: 1;
		overflow: visible;
		pointer-events: none;
	}

	.arrow {
		fill: var(--ink-soft);
	}

	@media (max-width: 768px) {
		.scroll-cue {
			display: block;
		}
	}
</style>
