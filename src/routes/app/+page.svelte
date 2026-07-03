<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import StatusChip from '$lib/components/catalog/StatusChip.svelte';

	const here = $derived($page.url.pathname);

	let { data } = $props();

	let { semesters, courses } = $derived(data);

	const sortedSemesters = $derived([...semesters].sort((a, b) => b.order - a.order));
	const currentTerm = $derived(
		sortedSemesters.find((s) => courses.some((c) => c.semesterId === s.id)) ??
			sortedSemesters[0] ??
			null
	);
	const currentTermLabel = $derived(currentTerm ? `${currentTerm.term} ${currentTerm.year}` : '—');

	function spineForSemester(semesterId: string): 'crit' | 'ok' | 'warn' | 'idle' {
		if (!currentTerm) return 'idle';
		if (semesterId === currentTerm.id) return 'warn';
		const sem = sortedSemesters.find((s) => s.id === semesterId);
		if (!sem) return 'idle';
		if (sem.order < currentTerm.order) return 'ok';
		return 'idle';
	}

	function semesterStatus(semesterId: string): {
		label: string;
		variant: 'crit' | 'ok' | 'warn' | 'idle';
	} {
		if (!currentTerm) return { label: '—', variant: 'idle' };
		if (semesterId === currentTerm.id) return { label: 'Current', variant: 'warn' };
		const sem = sortedSemesters.find((s) => s.id === semesterId);
		if (!sem) return { label: '—', variant: 'idle' };
		if (sem.order < currentTerm.order) return { label: 'Past', variant: 'ok' };
		return { label: 'Future', variant: 'idle' };
	}

	function termShort(id: string): string {
		const s = sortedSemesters.find((x) => x.id === id);
		if (!s) return '—';
		return `${s.term[0]}${String(s.year).slice(-2)}`;
	}

	const subjectColors: Record<string, string> = {
		COMP: 'var(--subject-comp)',
		MATH: 'var(--subject-math)',
		CSIS: 'var(--subject-csis)',
		STAT: 'var(--subject-stat)',
		ECON: 'var(--subject-econ)',
		ISYS: 'var(--subject-isys)',
		HUMN: 'var(--subject-humn)'
	};

	function courseColor(course: { code: string; color?: string }): string | undefined {
		if (course.color) return course.color;
		const prefix = course.code.split(/[\s-]/)[0];
		return subjectColors[prefix];
	}

	function semesterSubjectCount(semesterId: string): number {
		const subjectSet = new Set<string>();
		for (const c of courses.filter((c) => c.semesterId === semesterId)) {
			subjectSet.add(c.code.split(/[\s-]/)[0]);
		}
		return subjectSet.size;
	}

	function semesterStatusLabel(semesterId: string): string {
		const status = semesterStatus(semesterId);
		return `${status.label.toUpperCase()} · ${semesterSubjectCount(semesterId)} SUBJECTS`;
	}

	const todayEyebrow = $derived(
		new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		})
	);
</script>

<svelte:head><title>Synapse · Dashboard</title></svelte:head>

<div class="page">
	{#if semesters.length === 0}
		<div class="empty">
			<h1 class="page-title font-display">Dashboard</h1>
			<p class="page-tagline">Your catalog is empty. Set up your semesters to get started.</p>
			<div class="empty-actions">
				<button class="btn btn-primary" onclick={() => goto(resolveRoute('/app/setup'))}>
					Start setup →
				</button>
			</div>
		</div>
	{:else}
		<div class="dashboard page-enter">
			<div class="page-cover">
				<div class="eyebrow">Today · {todayEyebrow}</div>
				<h1 class="page-title font-display">
					{courses.length} courses across {semesters.length} terms.
				</h1>
				<p class="page-tagline">
					<span class="tagline-num">{currentTermLabel}</span> is the current term. Keep moving.
				</p>
			</div>

			{#each sortedSemesters as semester (semester.id)}
				{@const semesterCourses = courses.filter((c) => c.semesterId === semester.id)}
				{@const status = semesterStatus(semester.id)}
				<div class="semester-section">
					<SectionHead
						title={`${semester.term} ${semester.year}`}
						meta={semesterStatusLabel(semester.id)}
					/>
					{#if semesterCourses.length === 0}
						<div class="empty-shelf">No courses in this term yet.</div>
					{:else}
						<div class="course-list">
							{#each semesterCourses as course (course.id)}
								<button
									type="button"
									class="course-row"
									style="--row-spine: {courseColor(course) ?? 'var(--accent)'}"
									onclick={() =>
										goto(
											`${resolveRoute(`/app/courses/${course.id}`)}?from=${encodeURIComponent(here)}`
										)}
								>
									<span class="course-spine"></span>
									<div class="course-body">
										<span class="course-term">{course.code}</span>
										<span class="course-name font-display">{course.name}</span>
										<span class="course-stats">
											{semester.term}
											{semester.year} · {termShort(semester.id)}
										</span>
									</div>
									<StatusChip
										variant={status.variant === 'idle' ? 'idle' : status.variant}
										label={status.label}
									/>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			<div class="action-board">
				<button class="btn btn-secondary" onclick={() => goto(resolveRoute('/app/courses/manage'))}>
					manage courses
				</button>
				<button class="btn btn-primary" onclick={() => goto(resolveRoute('/app/courses'))}>
					open course map
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2.5rem 4rem;
	}

	.page-cover {
		margin-bottom: 2.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.69rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
		margin-bottom: 0.75rem;
	}

	.page-title {
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 3.25rem);
		font-weight: 600;
		color: var(--ink);
		margin: 0.25rem 0 0.75rem;
		line-height: 1.05;
		letter-spacing: -0.025em;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0;
		line-height: 1.5;
	}

	.tagline-num {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--ink);
		font-weight: 500;
		padding: 0 2px;
	}

	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.semester-section {
		margin-top: 0.5rem;
	}

	.course-list {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--rule);
	}

	.course-row {
		--row-spine: var(--accent);
		display: grid;
		grid-template-columns: 8px 1fr 120px;
		align-items: center;
		gap: 1.25rem;
		padding: 0.9rem 1rem 0.9rem 0;
		border-bottom: 1px solid var(--rule);
		cursor: pointer;
		background: var(--paper);
		font-family: inherit;
		color: inherit;
		text-align: left;
		transition: background 0.12s var(--ease-out-quart);
	}

	.course-row:hover {
		background: var(--paper-2);
	}

	.course-row:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}

	.course-spine {
		width: 4px;
		height: 38px;
		justify-self: start;
		background: var(--row-spine);
	}

	.course-body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.course-term {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}

	.course-name {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--ink);
	}

	.course-stats {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--ink-soft);
	}

	.empty-shelf {
		padding: 1.25rem;
		border: 1px dashed var(--rule);
		color: var(--ink-faint);
		font-size: 0.82rem;
		text-align: center;
		background: var(--paper);
	}

	.empty {
		text-align: center;
		padding-block: 4rem;
	}

	.empty-actions {
		margin-top: 1.5rem;
	}

	.action-board {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 1rem;
	}

	@media (max-width: 640px) {
		.action-board {
			flex-direction: column;
		}
	}
</style>
