<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import { cn } from '$lib/utils';
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

	const headerTerm = $derived(semester ? `${semester.term} ${semester.year}` : 'No term');

	const status = $derived(course.signals?.status ?? 'planned');
	const statusLabel = $derived(status.replaceAll('-', ' '));

	const statusVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		status === 'completed'
			? 'ok'
			: status === 'at-risk'
				? 'crit'
				: status === 'active'
					? 'warn'
					: 'idle'
	);

	const riskLabel = $derived(course.signals?.riskLevel ?? 'none');

	const riskVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		riskLabel === 'high'
			? 'crit'
			: riskLabel === 'medium'
				? 'warn'
				: riskLabel === 'low'
					? 'ok'
					: 'idle'
	);

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
		const course = availableConnectionCourses.find((c) => c.id === id);
		if (course) {
			edgeTargetQuery = `${course.code} · ${course.name}`;
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

<svelte:head><title>Synapse · {course.code}</title></svelte:head>

<div class="page page-enter">
	<button class="back-link font-mono" onclick={goBack}>← back</button>

	<div class="page-cover">
		<div class="cover-head">
			<div class="cover-meta">
				<h1 class="page-title font-display">{course.code}</h1>
				<p class="course-name">{course.name}</p>
				<p class="course-line font-mono">
					{#if semester}{semester.term} {semester.year} ·
					{/if}
					{#if course.instructor}{course.instructor} ·
					{/if}
					{#if course.credits !== undefined}{course.credits} credit{course.credits === 1
							? ''
							: 's'}{/if}
				</p>
				{#if course.tag || course.signals?.requirementGroup}
					<div class="course-tags">
						{#if course.tag}
							<span class="tag-chip font-mono">{course.tag}</span>
						{/if}
						{#if course.signals?.requirementGroup}
							<span class="tag-chip tag-chip-req font-mono">{course.signals.requirementGroup}</span>
						{/if}
					</div>
				{/if}
			</div>
			<div class="cover-actions">
				<button class="btn btn-secondary btn-sm" onclick={() => (showEditModal = true)}>edit</button
				>
				<button class="btn btn-ghost btn-sm danger" onclick={() => (showDeleteModal = true)}
					>delete</button
				>
			</div>
		</div>

		<div class="state-strip" aria-label="Course state">
			<div class="state-cell">
				<span class="state-label font-mono">Status</span>
				<span class="state-value state-{statusVariant} font-display">{statusLabel}</span>
			</div>
			<div class="state-cell">
				<span class="state-label font-mono">Grade</span>
				<span class="state-value font-display">
					{#if course.signals?.currentGrade !== undefined}
						{course.signals.currentGrade}
					{:else}
						<span class="state-empty">—</span>
					{/if}
				</span>
			</div>
			<div class="state-cell">
				<span class="state-label font-mono">Risk</span>
				<span class="state-value state-{riskVariant} font-display">{riskLabel}</span>
			</div>
			{#if course.signals?.nextDeadline}
				<div class="state-cell">
					<span class="state-label font-mono">Next</span>
					<span class="state-value state-next font-display">{course.signals.nextDeadline}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if professor || importantDates.length > 0}
		<section class="block">
			<header class="block-head">
				<h2 class="block-title font-mono">Syllabus details</h2>
				<span class="block-meta font-mono">saved to this course</span>
			</header>
			{#if professor}
				<dl class="activity">
					{#if professor.name && professor.name !== 'Not found'}
						<div class="activity-row">
							<dt>Instructor</dt>
							<dd>{professor.name}</dd>
						</div>
					{/if}
					{#if professor.email && professor.email !== 'Not found'}
						<div class="activity-row">
							<dt>Email</dt>
							<dd><a href={`mailto:${professor.email}`}>{professor.email}</a></dd>
						</div>
					{/if}
					{#if professor.office && professor.office !== 'Not found'}
						<div class="activity-row">
							<dt>Office</dt>
							<dd>{professor.office}</dd>
						</div>
					{/if}
					{#if professor.officeHours && professor.officeHours !== 'Not found'}
						<div class="activity-row">
							<dt>Office hours</dt>
							<dd>{professor.officeHours}</dd>
						</div>
					{/if}
				</dl>
			{/if}
			{#if importantDates.length > 0}
				<div class="syllabus-dates">
					{#each importantDates as item (`${item.label}-${item.date}`)}
						<div class="syllabus-date">
							<span>{item.label}</span>
							<time class="font-mono">{item.date}{item.needsReview ? ' · review' : ''}</time>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

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
			class={cn(
				'mb-3.5 inline-flex items-center gap-1.5 border border-[var(--rule)] bg-transparent px-2.5 py-1.5 text-[0.72rem] font-[var(--font-mono)] tracking-[0.12em] text-[var(--ink-soft)] uppercase transition-colors hover:border-[var(--ink)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]'
			)}
			onclick={() => {
				showConnForm = !showConnForm;
			}}
			aria-expanded={showConnForm}
		>
			<span class="text-[0.85rem] leading-none">{showConnForm ? '▾' : '+'}</span>
			add prerequisite
		</button>

		{#if showConnForm}
			<div
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
							'z-[var(--z-popover)] max-h-72 overflow-y-auto border border-[var(--ink)] bg-[var(--paper)] shadow-[4px_4px_0_rgba(31,28,20,0.12)]'
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
					<p class="m-0 text-[0.78rem] font-[var(--font-mono)] text-[var(--accent)]">
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

	{#if course.signals && (course.signals.deadlinesThisWeek || course.signals.studyHours || course.signals.materialCount || course.signals.noteCount)}
		<section class="block">
			<header class="block-head">
				<h2 class="block-title font-mono">Activity</h2>
			</header>
			<dl class="activity">
				{#if course.signals.deadlinesThisWeek !== undefined}
					<div class="activity-row">
						<dt>Deadlines this week</dt>
						<dd>{course.signals.deadlinesThisWeek}</dd>
					</div>
				{/if}
				{#if course.signals.studyHours !== undefined}
					<div class="activity-row">
						<dt>Study hours</dt>
						<dd>{course.signals.studyHours}</dd>
					</div>
				{/if}
				{#if course.signals.materialCount !== undefined}
					<div class="activity-row">
						<dt>Materials</dt>
						<dd>{course.signals.materialCount}</dd>
					</div>
				{/if}
				{#if course.signals.noteCount !== undefined}
					<div class="activity-row">
						<dt>Notes</dt>
						<dd>{course.signals.noteCount}</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}
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
	description={`Delete ${course.code}? This also removes its course-map connections. This cannot be undone.`}
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

	.back-link {
		display: inline-block;
		margin-bottom: 1rem;
		padding: 0;
		border: none;
		background: none;
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		cursor: pointer;
		transition: color 0.12s var(--ease-out-quart);
	}

	.back-link:hover {
		color: var(--ink);
	}

	.page-cover {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}

	.cover-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.cover-actions {
		display: flex;
		gap: 0.5rem;
	}

	.delete-error {
		margin: 0.75rem 0 0;
		color: var(--pen-red);
		font-size: 0.8rem;
	}

	.cover-meta {
		flex: 1;
		min-width: 0;
	}

	.page-title {
		font-size: clamp(2.6rem, 5vw, 3.4rem);
		color: var(--ink);
		margin: 0 0 0.4rem;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.course-name {
		font-family: var(--font-display);
		font-size: 1.4rem;
		color: var(--ink);
		margin: 0 0 0.5rem;
		line-height: 1.2;
	}

	.course-line {
		font-size: 0.78rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}

	.course-tags {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.tag-chip {
		padding: 0.2rem 0.55rem;
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
		font-size: 0.7rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.tag-chip-req {
		background: var(--paper);
	}

	.state-strip {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.state-cell {
		padding: 0.85rem 1rem;
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.state-cell:last-child {
		border-right: 0;
	}

	.state-label {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.state-value {
		font-size: 1.4rem;
		color: var(--ink);
		line-height: 1;
	}

	.state-empty {
		color: var(--ink-faint);
	}

	.state-next {
		font-size: 0.95rem;
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

	.rename-input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.15rem 0.3rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.9rem;
		outline: none;
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

	.conn-select {
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		min-height: 0;
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
		color: var(--accent);
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

	.activity {
		margin: 0;
		display: grid;
		gap: 0.4rem;
	}

	.activity-row {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
		border-bottom: 1px dashed var(--rule);
	}

	.activity-row:last-child {
		border-bottom: none;
	}

	.activity-row dt {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.activity-row dd {
		font-size: 0.85rem;
		color: var(--ink);
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.activity-row a {
		color: inherit;
	}

	.syllabus-dates {
		display: grid;
		gap: 0.4rem;
		margin-top: 1rem;
	}

	.syllabus-date {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px dashed var(--rule);
		font-size: 0.85rem;
	}

	.syllabus-date time {
		color: var(--ink-soft);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.state-strip {
			grid-template-columns: repeat(2, 1fr);
		}

		.state-cell:nth-child(2) {
			border-right: 0;
		}

		.state-cell:nth-child(-n + 2) {
			border-bottom: 1px solid var(--rule);
		}

		.conn-row,
		.conn-row.conn-row-editable {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}
</style>
