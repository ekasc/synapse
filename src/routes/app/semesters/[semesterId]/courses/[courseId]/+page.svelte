<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import CourseEditDialog from '$lib/components/course/CourseEditDialog.svelte';

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
			semester: Semester | null;
			semesters: Semester[];
			incoming: Edge[];
			outgoing: Edge[];
			courses: Course[];
		};
	} = $props();

	const course = $derived(data.course);
	const semester = $derived(data.semester);
	const semesters = $derived(data.semesters);
	const incoming = $derived(data.incoming);
	const outgoing = $derived(data.outgoing);
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

	let edgeFormTarget = $state<string>('');
	let edgeFormDirection = $state<'incoming' | 'outgoing'>('incoming');
	let edgeFormType = $state<string>('prereq');
	let edgeFormSubmitting = $state(false);
	let edgeFormError = $state<string | null>(null);

	let patchingEdgeId = $state<string | null>(null);
	let deletingEdgeId = $state<string | null>(null);
	let edgeMutationError = $state<string | null>(null);

	const isEdgeMutating = $derived(patchingEdgeId !== null || deletingEdgeId !== null);

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
				body: JSON.stringify({ source, target, type: edgeFormType, reviewStatus: 'accepted' })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				edgeFormError = body?.error ?? 'Failed to add connection';
				return;
			}
			await invalidateAll();
			edgeFormTarget = '';
			edgeFormDirection = 'incoming';
			edgeFormType = 'prereq';
		} catch {
			edgeFormError = 'Failed to add connection. Is the server running?';
		} finally {
			edgeFormSubmitting = false;
		}
	}

	async function updateEdgeType(edge: Edge, type: string) {
		if (!edge.id || patchingEdgeId) return;
		patchingEdgeId = edge.id;
		edgeMutationError = null;
		try {
			const res = await fetch('/api/graph/edge', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: edge.id, type })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				edgeMutationError = body?.error ?? 'Failed to update type';
				return;
			}
			await invalidateAll();
		} catch {
			edgeMutationError = 'Failed to update type. Is the server running?';
		} finally {
			patchingEdgeId = null;
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
			<button class="btn btn-secondary btn-sm" onclick={() => (showEditModal = true)}>edit</button>
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

		<div class="conn-form">
			<label for="edge-target" class="sr-only">Target course</label>
			<select
				id="edge-target"
				class="conn-select"
				bind:value={edgeFormTarget}
				disabled={edgeFormSubmitting}
			>
				<option value="">Choose course…</option>
				{#each data.courses as c (c.id)}
					<option value={c.id}>{c.code} · {c.name}</option>
				{/each}
			</select>
			<label for="edge-direction" class="sr-only">Direction</label>
			<select
				id="edge-direction"
				class="conn-select"
				bind:value={edgeFormDirection}
				disabled={edgeFormSubmitting}
			>
				<option value="incoming">feeds into this</option>
				<option value="outgoing">unlocked by this</option>
			</select>
			<label for="edge-form-type" class="sr-only">Relation type</label>
			<select
				id="edge-form-type"
				class="conn-select"
				bind:value={edgeFormType}
				disabled={edgeFormSubmitting}
			>
				<option value="prereq">prereq</option>
				<option value="coreq">coreq</option>
				<option value="unlocks">unlocks</option>
				<option value="related">related</option>
			</select>
			<button
				class="btn btn-secondary btn-sm"
				disabled={!edgeFormTarget || edgeFormSubmitting}
				onclick={addEdge}
				aria-label="Add connection"
			>
				{edgeFormSubmitting ? '…' : 'add'}
			</button>
		</div>

		{#if edgeFormError}
			<p class="conn-error font-mono">{edgeFormError}</p>
		{/if}

		{#if incoming.length === 0 && outgoing.length === 0}
			<p class="empty font-mono">No saved connections to other courses.</p>
		{:else}
			{#if incoming.length > 0}
				<div class="conn-group">
					<div class="conn-label font-mono">Prereqs feed in</div>
					<ul class="conn-list">
						{#each incoming as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
							{@const source = coursesById.get(edge.source)}
							<li class="conn-row" class:conn-row-editable={!!edge.id}>
								<span class="conn-source font-mono">
									{#if source}{source.code} · {source.name}{:else}—{/if}
								</span>
								<span class="conn-arrow font-mono" aria-hidden="true">→</span>
								<span class="conn-this font-mono">this course</span>
								{#if edge.id}
									<select
										class="conn-select"
										value={edge.type ?? 'prereq'}
										disabled={isEdgeMutating}
										onchange={(e) => updateEdgeType(edge, e.currentTarget.value)}
										aria-label="Relation type"
									>
										<option value="prereq">prereq</option>
										<option value="coreq">coreq</option>
										<option value="unlocks">unlocks</option>
										<option value="related">related</option>
									</select>
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

			{#if outgoing.length > 0}
				<div class="conn-group">
					<div class="conn-label font-mono">This course unlocks</div>
					<ul class="conn-list">
						{#each outgoing as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
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
										value={edge.type ?? 'prereq'}
										disabled={isEdgeMutating}
										onchange={(e) => updateEdgeType(edge, e.currentTarget.value)}
										aria-label="Relation type"
									>
										<option value="prereq">prereq</option>
										<option value="coreq">coreq</option>
										<option value="unlocks">unlocks</option>
										<option value="related">related</option>
									</select>
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

<CourseEditDialog
	bind:open={showEditModal}
	{course}
	{semesters}
	defaultSemesterId={course.semesterId}
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

	.conn-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.85rem;
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
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
