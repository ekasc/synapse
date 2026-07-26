<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import { Combobox } from 'bits-ui';
	import { onMount, tick } from 'svelte';
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
	let courseJumpId = $state('');
	let courseJumpQuery = $state('');
	let courseJumpOpen = $state(false);
	let lastJumpedCourseId = '';
	let scrollRegion: HTMLDivElement;
	let scenario = $derived(createPlanningScenario(courses, semesters, relations));
	let sharedSource = $state<SharedScenarioSourceState>({ status: 'none' });
	let savedAssociation = $state<SavedScenarioAssociation | null>(null);
	const displayedCourses = $derived(scenario.currentCourses);
	const layout = $derived(createStaticLayout(displayedCourses, semesters));
	const orderedDisplayedCourses = $derived(
		[...displayedCourses].sort((a, b) => {
			const aPosition = layout.positions[a.id];
			const bPosition = layout.positions[b.id];
			return (aPosition?.x ?? 0) - (bPosition?.x ?? 0) || (aPosition?.y ?? 0) - (bPosition?.y ?? 0);
		})
	);
	const filteredJumpCourses = $derived.by(() => {
		const query = courseJumpQuery.trim().toLowerCase();
		if (!query) return orderedDisplayedCourses;
		return orderedDisplayedCourses.filter(
			(course) =>
				course.code.toLowerCase().includes(query) || course.name.toLowerCase().includes(query)
		);
	});

	$effect(() => {
		if (!courseJumpId) {
			lastJumpedCourseId = '';
			return;
		}
		if (courseJumpId === lastJumpedCourseId) return;
		lastJumpedCourseId = courseJumpId;
		courseJumpOpen = false;
		void jumpToCourse(courseJumpId);
	});
	const columns = $derived(getOrderedColumns(courses, semesters));
	const semesterIds = $derived(new Set(semesters.map((semester) => semester.id)));
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

	async function inspect(courseId: string) {
		selectedId = selectedId === courseId ? null : courseId;
		if (!selectedId) return;
		await tick();
		document.querySelector<HTMLElement>('[data-dependency-inspector] h2')?.focus();
	}

	async function closeInspector() {
		const courseId = selectedId;
		selectedId = null;
		await tick();
		if (courseId) {
			scrollRegion
				?.querySelector<HTMLButtonElement>(`[data-course-inspect="${CSS.escape(courseId)}"]`)
				?.focus();
		}
	}

	function nodeState(courseId: string) {
		if (conflictIds.has(courseId)) return 'conflict' as const;
		if (resolvedIds.has(courseId)) return 'resolved' as const;
		if (!selectedId || courseId === selectedId) return 'default' as const;
		if (upstream.has(courseId)) return 'upstream' as const;
		if (downstream.has(courseId)) return 'downstream' as const;
		return 'muted' as const;
	}

	const connectedIds = $derived(
		selectedId ? new Set([selectedId, ...upstream, ...downstream]) : null
	);

	function edgeIsMuted(relation: MapRelation) {
		if (!connectedIds) return false;
		return !connectedIds.has(relation.source) || !connectedIds.has(relation.target);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && selectedId) {
			void closeInspector();
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

	function clearCourseJump() {
		courseJumpId = '';
		courseJumpQuery = '';
		courseJumpOpen = false;
	}

	async function jumpToCourse(courseId: string) {
		if (!courseId) return;
		selectedId = courseId;
		courseJumpId = courseId;
		await tick();
		const node = scrollRegion?.querySelector<HTMLElement>(
			`[data-course-node="${CSS.escape(courseId)}"]`
		);
		if (!node) return;
		scrollRegion.scrollTo({
			left: Math.max(0, node.offsetLeft - (scrollRegion.clientWidth - node.offsetWidth) / 2),
			behavior: 'smooth'
		});
		node.querySelector<HTMLButtonElement>('[data-course-inspect]')?.focus();
	}

	function jumpToSemester(semesterId: string) {
		if (!semesterId) return;
		const index = columns.findIndex((column) => column.id === semesterId);
		if (index < 0) return;
		scrollRegion.scrollTo({
			left: Math.max(0, CANVAS_PADDING + index * (NODE_WIDTH + COLUMN_GAP) - CANVAS_PADDING),
			behavior: 'smooth'
		});
	}

	function columnIdFor(course: MapCourse) {
		return semesterIds.has(course.semesterId) ? course.semesterId : '__unplaced__';
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
	<div class="map-tools" aria-label="Course map navigation">
		<Combobox.Root
			type="single"
			bind:value={courseJumpId}
			inputValue={courseJumpQuery}
			bind:open={courseJumpOpen}
		>
			<label for="map-course-search" class="sr-only">Find a course</label>
			<div
				class="relative min-w-0 border border-[var(--ink)] bg-[var(--paper)] focus-within:shadow-[2px_2px_0_var(--ink)]"
			>
				<Combobox.Input
					id="map-course-search"
					class={cn(
						'w-full min-w-0 border-0 bg-transparent py-2 pr-[3.8rem] pl-2.5 text-[0.82rem] font-[var(--font-body)] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:outline-2 focus:outline-offset-[-2px] focus:outline-[var(--highlight)]'
					)}
					placeholder="Find a course…"
					oninput={(event) => {
						courseJumpQuery = event.currentTarget.value;
						if (courseJumpId) courseJumpId = '';
						courseJumpOpen = true;
					}}
					onkeydown={(event) => {
						if (event.key === 'Enter' && filteredJumpCourses.length > 0) {
							event.preventDefault();
							const first = filteredJumpCourses[0];
							courseJumpId = first.id;
							courseJumpOpen = false;
						}
					}}
				/>
				{#if courseJumpId}
					<button
						class="absolute top-0 right-8 bottom-0 flex w-6 items-center justify-center border-0 bg-transparent text-[0.65rem] font-[var(--font-mono)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
						onclick={clearCourseJump}
						aria-label="Clear selected course"
						type="button">✕</button
					>
				{/if}
				<Combobox.Trigger
					class={cn(
						'absolute top-0 right-0 bottom-0 flex w-8 items-center justify-center border-0 bg-transparent text-[0.75rem] font-[var(--font-mono)] text-[var(--ink-faint)] transition-[color,transform] hover:text-[var(--ink)] data-[state=open]:rotate-180 data-[state=open]:text-[var(--ink)]'
					)}
					aria-label="Show course choices">▾</Combobox.Trigger
				>
			</div>
			<Combobox.Content
				class={cn(
					'z-[var(--z-dropdown)] max-h-72 overflow-y-auto border border-[var(--ink)] bg-[var(--paper)] shadow-[4px_4px_0_var(--shadow-ink)]'
				)}
			>
				<Combobox.Viewport>
					{#if filteredJumpCourses.length === 0}
						<p
							class="m-0 p-3 text-[0.72rem] font-[var(--font-mono)] tracking-[0.08em] text-[var(--ink-faint)] uppercase"
						>
							No matching courses
						</p>
					{:else}
						{#each filteredJumpCourses as course (course.id)}
							<Combobox.Item
								value={course.id}
								class={cn(
									'grid min-h-11 w-full grid-cols-[minmax(5.5rem,auto)_1fr] items-baseline gap-2.5 border-0 border-b border-dashed border-[var(--rule)] bg-transparent px-3 py-2 text-left text-[var(--ink)] last:border-b-0 hover:bg-[var(--highlight-soft)] hover:shadow-[inset_2px_0_0_var(--ink)] data-[highlighted]:bg-[var(--highlight-soft)] data-[highlighted]:shadow-[inset_2px_0_0_var(--ink)] data-[state=checked]:bg-[var(--highlight)] data-[state=checked]:shadow-[inset_2px_0_0_var(--ink)]'
								)}
							>
								<span class="text-[0.68rem] font-[var(--font-mono)] font-bold tracking-[0.08em]">
									{course.code}
								</span>
								<span
									class="overflow-hidden text-[0.82rem] leading-[1.35] text-ellipsis whitespace-nowrap text-[var(--ink-soft)]"
								>
									{course.name}
								</span>
							</Combobox.Item>
						{/each}
					{/if}
				</Combobox.Viewport>
			</Combobox.Content>
		</Combobox.Root>
		<details class="map-legend" name="course-map-panel">
			<summary>Legend</summary>
			<div aria-label="Course map legend">
				<span><i class="legend-line accepted"></i> Confirmed prerequisite</span>
				<span><i class="legend-line pending"></i> Pending review</span>
				<span><i class="legend-box upstream"></i> Prerequisite of selected course</span>
				<span><i class="legend-box downstream"></i> Depends on selected course</span>
			</div>
		</details>
	</div>

	<nav class="semester-overview" aria-label="Semester overview">
		{#each columns as column (column.id)}
			{@const courseCount = orderedDisplayedCourses.filter(
				(course) => columnIdFor(course) === column.id
			).length}
			<button type="button" onclick={() => jumpToSemester(column.id)}>
				<strong>{column.label}</strong>
				<span>{courseCount} course{courseCount === 1 ? '' : 's'}</span>
			</button>
		{/each}
	</nav>

	{#if scenario.moves.length > 0}
		<div class="scenario-legend font-mono" aria-label="Draft plan legend">
			<span><i class="preview-mark"></i> Changed course</span>
			{#if conflictIds.size > 0}<span><i class="conflict-mark"></i> Plan conflict</span>{/if}
			{#if resolvedIds.size > 0}<span><i class="resolved-mark"></i> Resolved conflict</span>{/if}
		</div>
	{/if}

	<p class:at-end={!canScrollFurther} class="scroll-cue font-mono">Swipe to see later semesters</p>
	<div class:at-end={!canScrollFurther} class="scroll-frame">
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			bind:this={scrollRegion}
			class="scroll-region"
			role="region"
			tabindex="0"
			aria-label="Course prerequisite map. Arrows point from a prerequisite to the course that requires it. Scroll horizontally to see later semesters."
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

				{#each orderedDisplayedCourses as course (course.id)}
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
				onclose={closeInspector}
			/>
		{/key}
	{/if}

	<details class="planning-tools" name="course-map-panel">
		<summary>
			Draft plans{scenario.moves.length
				? ` · ${scenario.moves.length} unsaved change${scenario.moves.length === 1 ? '' : 's'}`
				: ''}
		</summary>
		<div class="details-panel planning-panel">
			<p class="planning-help">
				Draft plans are for comparison only. They never change your saved course schedule.
			</p>
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
				onundo={(moveId) =>
					updateScenario(undoPlanningMove(scenario, moveId, semesters, relations))}
				onundolast={() => updateScenario(undoLastPlanningMove(scenario, semesters, relations))}
				onreset={resetScenario}
				onjump={jumpToCourse}
				oncopy={copyScenarioLink}
				onclearshared={clearSharedScenario}
			/>
		</div>
	</details>
</div>

<style>
	.map-shell {
		display: grid;
		min-width: 0;
		max-width: 100%;
		gap: 0.85rem;
	}

	.map-tools {
		display: grid;
		min-width: 0;
		max-width: 100%;
		grid-template-columns: minmax(16rem, 32rem) auto;
		justify-content: space-between;
		gap: 0.55rem;
		align-items: end;
	}

	.map-legend {
		position: relative;
		z-index: 120;
		justify-self: end;
		font: 500 0.82rem/1.4 var(--font-body);
		color: var(--ink);
	}

	.map-legend summary {
		min-height: 44px;
		padding: 0.55rem 0.25rem;
		border: 0;
		color: var(--ink-soft);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.map-legend > div {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
		display: flex;
		width: min(36rem, calc(100vw - 2rem));
		flex-wrap: wrap;
		gap: 0.55rem 1rem;
		box-sizing: border-box;
		padding: 0.75rem;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		box-shadow: 5px 5px 0 var(--shadow-ink);
	}

	.map-legend span {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		min-height: 1.75rem;
	}

	.legend-line {
		display: inline-block;
		width: 28px;
		flex: 0 0 28px;
		border-top: 2px solid var(--ink);
	}

	.legend-line.pending {
		border-top-style: dashed;
	}

	.legend-box {
		display: inline-block;
		width: 14px;
		height: 14px;
		flex: 0 0 14px;
		border: 2px solid;
	}

	.legend-box.upstream {
		border-color: var(--pen-blue);
	}

	.legend-box.downstream {
		border-color: var(--pen-red);
	}

	.map-tools .sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.semester-overview button {
		min-height: 44px;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		color: var(--ink);
		font: 500 var(--text-small)/1.3 var(--font-body);
	}

	.semester-overview {
		display: flex;
		min-width: 0;
		max-width: 100%;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
	}

	.semester-overview button {
		display: grid;
		min-width: 8rem;
		padding: 0.45rem 0.65rem;
		text-align: left;
		cursor: pointer;
	}

	.semester-overview span {
		font-size: var(--text-caption);
		color: var(--ink-soft);
	}

	.planning-tools {
		position: relative;
		min-width: 0;
		border: 1px solid var(--rule);
		background: var(--surface-paper);
	}

	.planning-tools > summary {
		min-height: 44px;
		padding: 0.75rem 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.details-panel {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 100;
		width: min(48rem, calc(100vw - 2rem));
		max-width: 100%;
		max-height: min(70vh, 42rem);
		overflow: auto;
		box-sizing: border-box;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		box-shadow: 6px 6px 0 var(--shadow-ink);
	}

	.details-panel > p,
	.planning-help {
		margin: 0;
		padding: 0.8rem 1rem;
		font-size: var(--text-small);
		color: var(--ink-soft);
	}

	.planning-tools :global(.saved),
	.planning-tools :global(.planning-workspace) {
		margin: 0 0.8rem 0.8rem;
	}

	.planning-panel {
		width: min(56rem, calc(100vw - 2rem));
	}

	.scroll-frame {
		position: relative;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
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
		transition: opacity 0.15s var(--ease-out-quart);
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
		width: 100%;
		min-width: 0;
		max-width: 100%;
		overflow-x: auto;
		border: 1px solid var(--ink);
		background: var(--paper-shelf);
		overscroll-behavior-inline: contain;
	}

	.canvas {
		position: relative;
		min-width: 100%;
		background-image: linear-gradient(to bottom, transparent 31px, var(--backdrop-faint) 32px);
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
		font-family: var(--font-body);
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
		.map-tools {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}
</style>
