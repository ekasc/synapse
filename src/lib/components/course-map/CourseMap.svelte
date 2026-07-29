<script lang="ts">
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import { Collapsible, Combobox, Popover } from 'bits-ui';
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

<div class="grid max-w-full min-w-0 gap-[0.85rem]">
	<div
		class="grid max-w-full min-w-0 grid-cols-[minmax(16rem,32rem)_auto] items-end justify-between gap-[0.55rem] max-[768px]:grid-cols-[minmax(0,1fr)_auto]"
		aria-label="Course map navigation"
	>
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
						'w-full min-w-0 border-0 bg-transparent py-2 pr-[3.8rem] pl-2.5 font-[var(--font-body)] text-[var(--ink)] text-[var(--text-caption)] outline-none placeholder:text-[var(--ink-faint)] focus:outline-2 focus:outline-offset-[-2px] focus:outline-[var(--highlight)]'
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
						class="absolute top-0 right-8 bottom-0 flex w-6 items-center justify-center border-0 bg-transparent text-[var(--ink-soft)] text-[var(--text-caption)] hover:text-[var(--ink)]"
						onclick={clearCourseJump}
						aria-label="Clear selected course"
						type="button">✕</button
					>
				{/if}
				<Combobox.Trigger
					class={cn(
						'absolute top-0 right-0 bottom-0 flex w-8 items-center justify-center border-0 bg-transparent  text-[var(--ink-faint)] text-[var(--text-caption)] transition-[color,transform] hover:text-[var(--ink)] data-[state=open]:rotate-180 data-[state=open]:text-[var(--ink)]'
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
						<p class="m-0 p-3 text-[var(--ink-faint)] text-[var(--text-caption)]">
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
								<span class=" font-bold text-[var(--text-caption)]">
									{course.code}
								</span>
								<span
									class="overflow-hidden leading-[1.35] text-ellipsis whitespace-nowrap text-[var(--ink-soft)] text-[var(--text-caption)]"
								>
									{course.name}
								</span>
							</Combobox.Item>
						{/each}
					{/if}
				</Combobox.Viewport>
			</Combobox.Content>
		</Combobox.Root>
		<Popover.Root>
			<Popover.Trigger
				class="min-h-11 justify-self-end border-0 bg-transparent px-1 py-[0.55rem] font-semibold text-[var(--ink-soft)] text-[var(--text-caption)]"
				>Legend</Popover.Trigger
			>
			<Popover.Portal>
				<Popover.Content
					sideOffset={4}
					align="end"
					class="z-[var(--z-dropdown)] box-border flex w-[min(36rem,calc(100vw-2rem))] flex-wrap gap-x-4 gap-y-[0.55rem] border border-[var(--ink)] bg-[var(--surface-paper)] p-3 text-[var(--text-caption)] shadow-[5px_5px_0_var(--shadow-ink)] [&_span]:inline-flex [&_span]:min-h-7 [&_span]:items-center [&_span]:gap-2"
					aria-label="Course map legend"
				>
					<span
						><i class="inline-block w-7 shrink-0 border-t-2 border-[var(--ink)]"></i> Confirmed prerequisite</span
					>
					<span
						><i class="inline-block w-7 shrink-0 border-t-2 border-dashed border-[var(--ink)]"></i> Pending
						review</span
					>
					<span
						><i class="inline-block size-3.5 shrink-0 border-2 border-[var(--pen-blue)]"></i> Prerequisite
						of selected course</span
					>
					<span
						><i class="inline-block size-3.5 shrink-0 border-2 border-[var(--pen-red)]"></i> Depends on
						selected course</span
					>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	</div>

	<nav
		class="flex max-w-full min-w-0 gap-[0.4rem] overflow-x-auto pb-[0.2rem]"
		aria-label="Semester overview"
	>
		{#each columns as column (column.id)}
			{@const courseCount = orderedDisplayedCourses.filter(
				(course) => columnIdFor(course) === column.id
			).length}
			<button
				type="button"
				class="grid min-h-11 min-w-32 cursor-pointer border border-[var(--ink)] bg-[var(--surface-paper)] px-[0.65rem] py-[0.45rem] text-left text-[var(--ink)] [font:500_var(--text-small)/1.3_var(--font-body)]"
				onclick={() => jumpToSemester(column.id)}
			>
				<strong>{column.label}</strong>
				<span class="text-[length:var(--text-caption)] text-[var(--ink-soft)]"
					>{courseCount} course{courseCount === 1 ? '' : 's'}</span
				>
			</button>
		{/each}
	</nav>

	{#if scenario.moves.length > 0}
		<div
			class="mb-2 flex flex-wrap gap-x-4 gap-y-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)] [&_span]:inline-flex [&_span]:items-center [&_span]:gap-[0.35rem]"
			aria-label="Draft plan legend"
		>
			<span
				><i class="inline-block size-3 border-2 border-double border-[var(--ok)]"></i> Changed course</span
			>
			{#if conflictIds.size > 0}<span
					><i class="inline-block size-3 border-2 border-[var(--accent)]"></i> Plan conflict</span
				>{/if}
			{#if resolvedIds.size > 0}<span
					><i class="inline-block size-3 border-2 border-[var(--ok)]"></i> Resolved conflict</span
				>{/if}
		</div>
	{/if}

	<p
		class={[
			'mb-[0.45rem] hidden  text-[var(--ink-soft)] text-[var(--text-caption)] max-[768px]:block',
			!canScrollFurther && 'invisible'
		]}
	>
		Swipe to see later semesters
	</p>
	<div
		class:at-end={!canScrollFurther}
		class="scroll-frame relative max-w-full min-w-0 overflow-hidden"
	>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			bind:this={scrollRegion}
			class="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain border border-[var(--ink)] bg-[var(--paper-shelf)]"
			role="region"
			tabindex="0"
			aria-label="Course prerequisite map. Arrows point from a prerequisite to the course that requires it. Scroll horizontally to see later semesters."
			onscroll={updateScrollCue}
		>
			<div
				class="relative min-w-full bg-[image:linear-gradient(to_bottom,transparent_31px,var(--backdrop-faint)_32px)] bg-[length:100%_32px]"
				style:width={`${layout.width}px`}
				style:height={`${layout.height}px`}
			>
				{#each columns as column, index (column.id)}
					<div
						class="absolute top-7 z-2 border-b-2 border-[var(--ink)] pb-[0.55rem]"
						style:left={`${CANVAS_PADDING + index * (NODE_WIDTH + COLUMN_GAP)}px`}
						style:width={`${NODE_WIDTH}px`}
					>
						<span class="block text-[var(--ink-faint)] text-[var(--text-caption)]">
							{column.id === '__unplaced__' ? 'Not yet scheduled' : `Semester ${index + 1}`}
						</span>
						<strong class="mt-[0.15rem] block text-[1.1rem] font-[var(--font-body)]"
							>{column.label}</strong
						>
					</div>
				{/each}

				<svg
					class="pointer-events-none absolute inset-0 z-1 overflow-visible"
					width={layout.width}
					height={layout.height}
					aria-hidden="true"
				>
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
							<path d="M 0 0 L 10 5 L 0 10 z" class="fill-[var(--ink-soft)]" />
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

	<Collapsible.Root class="relative min-w-0 border border-[var(--rule)] bg-[var(--surface-paper)]">
		<Collapsible.Trigger
			class="min-h-11 w-full cursor-pointer border-0 bg-transparent px-4 py-3 text-left font-bold"
		>
			Draft plans{scenario.moves.length
				? ` · ${scenario.moves.length} unsaved change${scenario.moves.length === 1 ? '' : 's'}`
				: ''}
		</Collapsible.Trigger>
		<Collapsible.Content
			class="absolute top-[calc(100%+0.35rem)] left-0 z-100 box-border max-h-[min(70vh,42rem)] w-[min(56rem,calc(100vw-2rem))] max-w-full overflow-auto border border-[var(--ink)] bg-[var(--surface-paper)] shadow-[6px_6px_0_var(--shadow-ink)]"
		>
			<p class="m-0 px-4 py-[0.8rem] text-[length:var(--text-small)] text-[var(--ink-soft)]">
				Draft plans are for comparison only. They never change your saved course schedule.
			</p>
			<div class="mx-[0.8rem] mb-[0.8rem]">
				<SavedScenariosPanel
					moves={storedMoves}
					association={savedAssociation}
					dirty={savedScenarioDirty}
					onassociationchange={(association) => (savedAssociation = association)}
					onloadscenario={loadSavedScenario}
				/>
			</div>
			<div class="mx-[0.8rem] mb-[0.8rem]">
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
		</Collapsible.Content>
	</Collapsible.Root>
</div>

<style>
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
</style>
