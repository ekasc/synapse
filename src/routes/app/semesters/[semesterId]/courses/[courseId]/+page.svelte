<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import { cn } from '$lib/utils';
	import CourseHeader from '$lib/components/course/CourseHeader.svelte';
	import SyllabusDetails from '$lib/components/course/SyllabusDetails.svelte';
	import CourseActivity from '$lib/components/course/CourseActivity.svelte';
	import CourseEditDialog from '$lib/components/course/CourseEditDialog.svelte';
	import { AlertDialog } from '$lib/components/ui';
	import { Combobox } from 'bits-ui';

	type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';

	type Course = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		tag?: string;
		color?: string;
		signals?: {
			status?: CourseStatus;
			riskLevel?: RiskLevel;
			currentGrade?: number;
			projectedGrade?: number;
			deadlinesThisWeek?: number;
			nextDeadline?: string;
			studyHours?: number;
			materialCount?: number;
			noteCount?: number;
			requirementGroup?: string;
			topics?: string[];
		};
	};

	type Semester = { id: string; term: string; year: number; order: number };

	type SyllabusImport = {
		extractedData: {
			professor: { name: string; email: string; office: string; officeHours: string };
			dates: { label: string; date: string; type: string; needsReview?: boolean }[];
		};
	};

	type Edge = {
		id?: string;
		source: string;
		target: string;
		label?: string;
		type?: string;
		reviewStatus?: 'accepted' | 'pending' | 'rejected';
	};

	let {
		data
	}: {
		data: {
			course: Course;
			syllabus: SyllabusImport | null;
			semester: Semester | null;
			semesters: Semester[];
			incoming: Edge[];
			outgoing: Edge[];
			courses: Course[];
		};
	} = $props();

	const course = $derived(data.course);
	const syllabus = $derived(data.syllabus);
	const professor = $derived(syllabus?.extractedData.professor ?? null);
	const importantDates = $derived(syllabus?.extractedData.dates ?? []);
	const semester = $derived(data.semester);
	const semesters = $derived(data.semesters);
	const incoming = $derived(data.incoming);
	const outgoing = $derived(data.outgoing);
	const prerequisites = $derived(incoming.filter((edge) => edge.type === 'prereq'));
	const requiredFor = $derived(outgoing.filter((edge) => edge.type === 'prereq'));
	const otherRelationships = $derived(
		[...incoming, ...outgoing].filter((edge) => edge.type !== 'prereq')
	);
	const coursesById = $derived(new Map(data.courses.map((c) => [c.id, c])));

	const topics = $derived(course.signals?.topics ?? []);
	const availableConnectionCourses = $derived(
		data.courses.filter((candidate) => candidate.id !== course.id)
	);

	function edgeLabel(edge: Edge): string {
		return edge.type?.replaceAll('-', ' ') ?? edge.label ?? 'related';
	}

	const backHref = $derived.by(() => {
		const from = $page.url.searchParams.get('from');
		if (from && from.startsWith('/') && !from.startsWith('//')) return from;
		return resolveRoute(`/app/semesters/${encodeURIComponent(course.semesterId)}`);
	});

	function goBack() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- backHref is a user-supplied ?from= param, validated to be an internal path
		void goto(backHref);
	}

	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let deletingCourse = $state(false);
	let deleteCourseError = $state<string | null>(null);

	let showConnForm = $state(false);
	let edgeFormTarget = $state<string>('');
	let edgeTargetQuery = $state('');
	let edgeTargetOpen = $state(false);
	let edgeFormDirection = $state<'incoming' | 'outgoing'>('incoming');
	let edgeFormSubmitting = $state(false);
	let edgeFormError = $state<string | null>(null);

	let patchingEdgeId = $state<string | null>(null);
	let deletingEdgeId = $state<string | null>(null);
	let edgeMutationError = $state<string | null>(null);

	const isEdgeMutating = $derived(patchingEdgeId !== null || deletingEdgeId !== null);
	const selectedConnectionCourse = $derived(
		availableConnectionCourses.find((candidate) => candidate.id === edgeFormTarget)
	);
	const filteredConnectionCourses = $derived(
		availableConnectionCourses.filter((candidate) => {
			const query = edgeTargetQuery.trim().toLowerCase();
			return !query || `${candidate.code} ${candidate.name}`.toLowerCase().includes(query);
		})
	);

	// Sync input display when a course is selected (covers both mouse AND keyboard)
	$effect(() => {
		const id = edgeFormTarget;
		if (!id) return;
		const c = availableConnectionCourses.find((candidate) => candidate.id === id);
		if (c) {
			edgeTargetQuery = `${c.code} · ${c.name}`;
		}
	});

	function clearEdgeSelection() {
		edgeFormTarget = '';
		edgeTargetQuery = '';
	}

	async function removeCourse() {
		if (deletingCourse) return;
		deletingCourse = true;
		deleteCourseError = null;
		try {
			const response = await fetch('/api/courses', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: course.id })
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				deleteCourseError = body?.error ?? 'Could not delete course.';
				return;
			}
			await goto(resolveRoute(`/app/semesters/${encodeURIComponent(course.semesterId)}`), {
				invalidateAll: true,
				replaceState: true
			});
		} catch {
			deleteCourseError = 'Network error. Is the server running?';
		} finally {
			deletingCourse = false;
		}
	}

	async function addEdge() {
		if (!edgeFormTarget || edgeFormSubmitting) return;
		edgeFormSubmitting = true;
		edgeFormError = null;
		try {
			const source = edgeFormDirection === 'incoming' ? edgeFormTarget : course.id;
			const target = edgeFormDirection === 'incoming' ? course.id : edgeFormTarget;
			const res = await fetch('/api/graph/edge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ source, target, type: 'prereq', reviewStatus: 'accepted' })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				edgeFormError = body?.error ?? 'Failed to add prerequisite';
				return;
			}
			await invalidateAll();
			edgeFormTarget = '';
			edgeTargetQuery = '';
			edgeTargetOpen = false;
			edgeFormDirection = 'incoming';
		} catch {
			edgeFormError = 'Failed to add prerequisite. Is the server running?';
		} finally {
			edgeFormSubmitting = false;
		}
	}

	async function updateEdgeReviewStatus(edge: Edge, reviewStatus: string) {
		if (!edge.id || patchingEdgeId) return;
		patchingEdgeId = edge.id;
		edgeMutationError = null;
		try {
			const res = await fetch('/api/graph/edge', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: edge.id, reviewStatus })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				edgeMutationError = body?.error ?? 'Failed to update review status';
				return;
			}
			await invalidateAll();
		} catch {
			edgeMutationError = 'Failed to update review status. Is the server running?';
		} finally {
			patchingEdgeId = null;
		}
	}

	async function deleteEdge(edge: Edge) {
		if (!edge.id || deletingEdgeId) return;
		deletingEdgeId = edge.id;
		edgeMutationError = null;
		try {
			const res = await fetch('/api/graph/edge', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: edge.id })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				edgeMutationError = body?.error ?? 'Failed to delete connection';
				return;
			}
			await invalidateAll();
		} catch {
			edgeMutationError = 'Failed to delete connection. Is the server running?';
		} finally {
			deletingEdgeId = null;
		}
	}
</script>

<svelte:head><title>{course.code} · Synapse</title></svelte:head>

<div class="page page-enter">
	<CourseHeader
		{course}
		{semester}
		{backHref}
		onEdit={() => (showEditModal = true)}
		onDelete={() => (showDeleteModal = true)}
		onBack={goBack}
	/>

	<SyllabusDetails {professor} dates={importantDates} />

	{#if topics.length > 0}
		<section class="block">
			<header class="block-head">
				<h2 class="block-title font-mono">Topics</h2>
				<span class="block-meta font-mono">{topics.length}</span>
			</header>
			<div class="topic-list">
				{#each topics as topic (topic)}
					<span class="topic-chip font-mono">{topic}</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="block">
		<header class="block-head">
			<h2 class="block-title font-mono">Connections</h2>
			<span class="block-meta font-mono">{incoming.length + outgoing.length}</span>
		</header>

		<button
			class="btn btn-secondary btn-sm conn-toggle font-mono"
			onclick={() => {
				showConnForm = !showConnForm;
			}}
			aria-expanded={showConnForm}
			aria-controls="add-prereq-panel"
		>
			<span class="conn-toggle-glyph" aria-hidden="true">{showConnForm ? '▾' : '+'}</span>
			add prerequisite
		</button>

		{#if showConnForm}
			<div
				id="add-prereq-panel"
				class="mb-3.5 flex flex-col gap-2.5 border border-[var(--rule)] bg-[var(--paper-shelf)] p-3.5"
			>
				<Combobox.Root
					type="single"
					bind:value={edgeFormTarget}
					inputValue={edgeTargetQuery}
					bind:open={edgeTargetOpen}
					disabled={edgeFormSubmitting}
				>
					<label for="conn-search" class="sr-only">Search for a course to connect</label>
					<div
						class="relative min-w-0 border border-[var(--ink)] bg-[var(--paper)] focus-within:shadow-[2px_2px_0_var(--ink)]"
					>
						<Combobox.Input
							id="conn-search"
							class={cn(
								'w-full min-w-0 border-0 bg-transparent py-2 pr-[3.8rem] pl-2.5 text-[0.82rem] font-[var(--font-body)] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:outline-2 focus:outline-offset-[-2px] focus:outline-[var(--highlight)]'
							)}
							placeholder="Find a course…"
							oninput={(event) => {
								edgeTargetQuery = event.currentTarget.value;
								if (edgeFormTarget) edgeFormTarget = '';
								edgeTargetOpen = true;
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' && filteredConnectionCourses.length > 0) {
									e.preventDefault();
									const first = filteredConnectionCourses[0];
									edgeFormTarget = first.id;
									edgeTargetOpen = false;
								}
							}}
						/>
						{#if edgeFormTarget}
							<button
								class="absolute top-0 right-8 bottom-0 flex w-6 items-center justify-center border-0 bg-transparent text-[0.65rem] font-[var(--font-mono)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
								onclick={clearEdgeSelection}
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
							'z-[var(--z-popover)] max-h-72 overflow-y-auto border border-[var(--ink)] bg-[var(--paper)] shadow-[4px_4px_0_var(--shadow-ink)]'
						)}
					>
						<Combobox.Viewport>
							{#if filteredConnectionCourses.length === 0}
								<p
									class="m-0 p-3 text-[0.72rem] font-[var(--font-mono)] tracking-[0.08em] text-[var(--ink-faint)] uppercase"
								>
									Nothing matches — try a different code or name
								</p>
							{:else}
								{#each filteredConnectionCourses as candidate (candidate.id)}
									<Combobox.Item
										value={candidate.id}
										class={cn(
											'grid min-h-11 w-full grid-cols-[minmax(5.5rem,auto)_1fr] items-baseline gap-2.5 border-0 border-b border-dashed border-[var(--rule)] bg-transparent px-3 py-2 text-left text-[var(--ink)] last:border-b-0 hover:bg-[var(--highlight-soft)] hover:shadow-[inset_2px_0_0_var(--ink)] data-[highlighted]:bg-[var(--highlight-soft)] data-[highlighted]:shadow-[inset_2px_0_0_var(--ink)] data-[state=checked]:bg-[var(--highlight)] data-[state=checked]:shadow-[inset_2px_0_0_var(--ink)]'
										)}
									>
										<span
											class="text-[0.68rem] font-[var(--font-mono)] font-bold tracking-[0.08em]"
										>
											{candidate.code}
										</span>
										<span
											class="overflow-hidden text-[0.82rem] leading-[1.35] text-ellipsis whitespace-nowrap text-[var(--ink-soft)]"
										>
											{candidate.name}
										</span>
									</Combobox.Item>
								{/each}
							{/if}
						</Combobox.Viewport>
					</Combobox.Content>
				</Combobox.Root>

				<div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
					<label
						class="flex flex-col gap-1 text-[0.65rem] font-[var(--font-mono)] tracking-[0.1em] text-[var(--ink-faint)] uppercase"
						for="edge-direction"
					>
						Relationship
						<select
							id="edge-direction"
							class="min-h-11 border border-[var(--rule)] bg-[var(--paper)] px-2.5 text-[0.78rem] font-[var(--font-mono)] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-45"
							bind:value={edgeFormDirection}
							disabled={edgeFormSubmitting}
						>
							<option value="incoming">This course requires…</option>
							<option value="outgoing">Another course requires this course</option>
						</select>
					</label>
					<button
						class="btn btn-secondary btn-sm min-h-11"
						disabled={!edgeFormTarget || edgeFormSubmitting}
						onclick={addEdge}
						aria-label="Add prerequisite"
					>
						{edgeFormSubmitting ? '…' : 'add prerequisite'}
					</button>
				</div>

				{#if selectedConnectionCourse}
					<p
						class="m-0 border-l-2 border-[var(--highlight)] pl-2.5 text-[0.82rem] text-[var(--ink-soft)]"
					>
						Preview:
						<strong class="text-[var(--ink)]">
							{edgeFormDirection === 'incoming'
								? `${course.code} requires ${selectedConnectionCourse.code}`
								: `${selectedConnectionCourse.code} requires ${course.code}`}
						</strong>
					</p>
				{/if}

				{#if edgeFormError}
					<p class="m-0 text-[0.78rem] font-[var(--font-mono)] text-[var(--pen-red)]">
						{edgeFormError}
					</p>
				{/if}
			</div>
		{/if}

		{#if prerequisites.length === 0 && requiredFor.length === 0 && otherRelationships.length === 0}
			<p class="empty font-mono">No prerequisite relationships have been added.</p>
		{:else}
			{#if prerequisites.length > 0}
				<div class="conn-group">
					<div class="conn-label font-mono">Prerequisites · this course requires</div>
					<ul class="conn-list">
						{#each prerequisites as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
							{@const source = coursesById.get(edge.source)}
							<li class="conn-row" class:conn-row-editable={!!edge.id}>
								<span class="conn-source font-mono">
									{#if source}{source.code} · {source.name}{:else}—{/if}
								</span>
								<span class="conn-arrow font-mono" aria-hidden="true">→</span>
								<span class="conn-this font-mono">required before this course</span>
								{#if edge.id}
									<select
										class="conn-select"
										value={edge.reviewStatus ?? 'accepted'}
										disabled={isEdgeMutating}
										onchange={(e) => updateEdgeReviewStatus(edge, e.currentTarget.value)}
										aria-label="Review status"
									>
										<option value="accepted">accepted</option>
										<option value="pending">pending</option>
										<option value="rejected">rejected</option>
									</select>
									<button
										class="btn btn-ghost btn-sm conn-remove"
										disabled={isEdgeMutating}
										onclick={() => deleteEdge(edge)}
										aria-label="Remove connection"
									>
										{deletingEdgeId === edge.id ? '…' : 'remove'}
									</button>
								{:else}
									<span class="conn-type font-mono">{edgeLabel(edge)}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if requiredFor.length > 0}
				<div class="conn-group">
					<div class="conn-label font-mono">Required for · these courses require this course</div>
					<ul class="conn-list">
						{#each requiredFor as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
							{@const target = coursesById.get(edge.target)}
							<li class="conn-row" class:conn-row-editable={!!edge.id}>
								<span class="conn-this font-mono">this course</span>
								<span class="conn-arrow font-mono" aria-hidden="true">→</span>
								<span class="conn-source font-mono">
									{#if target}{target.code} · {target.name}{:else}—{/if}
								</span>
								{#if edge.id}
									<select
										class="conn-select"
										value={edge.reviewStatus ?? 'accepted'}
										disabled={isEdgeMutating}
										onchange={(e) => updateEdgeReviewStatus(edge, e.currentTarget.value)}
										aria-label="Review status"
									>
										<option value="accepted">accepted</option>
										<option value="pending">pending</option>
										<option value="rejected">rejected</option>
									</select>
									<button
										class="btn btn-ghost btn-sm conn-remove"
										disabled={isEdgeMutating}
										onclick={() => deleteEdge(edge)}
										aria-label="Remove connection"
									>
										{deletingEdgeId === edge.id ? '…' : 'remove'}
									</button>
								{:else}
									<span class="conn-type font-mono">{edgeLabel(edge)}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if otherRelationships.length > 0}
				<details class="conn-group">
					<summary class="conn-label font-mono">Other relationships · legacy or imported</summary>
					<ul class="conn-list">
						{#each otherRelationships as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
							{@const related = coursesById.get(
								edge.source === course.id ? edge.target : edge.source
							)}
							<li class="conn-row" class:conn-row-editable={!!edge.id}>
								<span class="conn-source font-mono">
									{#if related}{related.code} · {related.name}{:else}—{/if}
								</span>
								<span class="conn-type font-mono">{edgeLabel(edge)}</span>
								{#if edge.id}
									<select
										class="conn-select"
										value={edge.reviewStatus ?? 'accepted'}
										disabled={isEdgeMutating}
										onchange={(e) => updateEdgeReviewStatus(edge, e.currentTarget.value)}
										aria-label="Review status"
									>
										<option value="accepted">confirmed</option>
										<option value="pending">needs review</option>
										<option value="rejected">rejected</option>
									</select>
									<button
										class="btn btn-ghost btn-sm conn-remove"
										disabled={isEdgeMutating}
										onclick={() => deleteEdge(edge)}
										aria-label="Remove relationship"
									>
										{deletingEdgeId === edge.id ? '…' : 'remove'}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		{/if}

		{#if edgeMutationError}
			<p class="conn-error font-mono">{edgeMutationError}</p>
		{/if}
	</section>

	<CourseActivity signals={course.signals} />
</div>

{#if deleteCourseError}<p class="delete-error" role="alert">{deleteCourseError}</p>{/if}

<CourseEditDialog
	bind:open={showEditModal}
	{course}
	{semesters}
	defaultSemesterId={course.semesterId}
/>

<AlertDialog
	open={showDeleteModal}
	title="Delete course?"
	description={`Delete ${course.code}? This also removes its course map connections. This cannot be undone.`}
	confirmLabel="Delete course"
	busy={deletingCourse}
	onConfirm={removeCourse}
	onCancel={() => (showDeleteModal = false)}
/>

<style>
	.page {
		max-width: 900px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.delete-error {
		margin: 0.75rem 0 0;
		color: var(--pen-red);
		font-size: 0.8rem;
	}

	.block {
		padding-block: 1.25rem;
		border-bottom: 1px solid var(--rule);
	}

	.block:last-of-type {
		border-bottom: none;
	}

	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.85rem;
	}

	.block-title {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-weight: 500;
		margin: 0;
	}

	.block-meta {
		font-size: 0.7rem;
		color: var(--ink-faint);
	}

	.topic-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.topic-chip {
		padding: 0.25rem 0.6rem;
		background: var(--paper);
		border: 1px solid var(--rule);
		font-size: 0.72rem;
		color: var(--ink);
	}

	.empty {
		font-size: 0.78rem;
		color: var(--ink-faint);
		margin: 0;
	}

	.conn-group + .conn-group {
		margin-top: 1rem;
	}

	.conn-label {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.conn-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.conn-row {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--paper);
		border: 1px solid var(--rule);
		font-size: 0.85rem;
	}

	.conn-row.conn-row-editable {
		grid-template-columns: 1fr auto auto auto auto auto;
	}

	.conn-source {
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.conn-arrow {
		color: var(--ink-soft);
	}

	.conn-this {
		color: var(--ink-faint);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.conn-type {
		color: var(--ink-soft);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
	}

	.conn-toggle {
		margin-bottom: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.conn-toggle-glyph {
		font-size: 0.85rem;
		line-height: 1;
	}

	.conn-select {
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		min-height: 2.5rem;
	}

	.conn-select:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.conn-remove {
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.conn-error {
		font-size: 0.78rem;
		color: var(--pen-red);
		margin: 0 0 0.85rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		border: 0;
	}

	@media (max-width: 900px) {
		.conn-row,
		.conn-row.conn-row-editable {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}
</style>
