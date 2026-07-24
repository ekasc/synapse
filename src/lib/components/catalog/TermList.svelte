<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import { Accordion } from 'bits-ui';

	type Semester = { id: string; term: string; year: number; order: number };
	type Course = { id: string; semesterId: string; code: string; name: string };

	interface Props {
		semesters: Semester[];
		courses: Course[];
		countsById?: Record<string, number>;
		onAddSemester: () => void;
		surface?: 'sidebar' | 'paper';
	}

	let { semesters, courses, countsById = {}, onAddSemester, surface = 'sidebar' }: Props = $props();
	let expanded = $state<string[]>([]);
	let lastActiveSemesterId: string | undefined;
	const sorted = $derived([...semesters].sort((a, b) => b.order - a.order));
	const activeSemesterId = $derived($page.url.pathname.match(/^\/app\/semesters\/([^/]+)/)?.[1]);
	const activeCourseId = $derived($page.url.pathname.match(/\/courses\/([^/]+)/)?.[1]);

	$effect(() => {
		const active = activeSemesterId;
		if (active === lastActiveSemesterId) return;

		lastActiveSemesterId = active;
		if (active && !expanded.includes(active)) expanded = [...expanded, active];
	});

	function semesterHref(id: string) {
		return resolveRoute('/app/semesters/[semesterId]', { semesterId: id });
	}
	function termColor(term: string) {
		switch (term.toLowerCase()) {
			case 'winter':
				return 'var(--subject-comp)';
			case 'spring':
				return 'var(--ok)';
			case 'summer':
				return 'var(--warn)';
			case 'fall':
			case 'autumn':
				return 'color-mix(in srgb, var(--accent) 85%, var(--paper))';
			default:
				return 'var(--sidebar-fg-soft)';
		}
	}
	function courseHref(semesterId: string, courseId: string) {
		return resolveRoute('/app/semesters/[semesterId]/courses/[courseId]', {
			semesterId,
			courseId
		});
	}
</script>

<div class="term-list" data-surface={surface}>
	<div class="sidebar-section-label">
		<span>Semesters</span>
		<button type="button" class="add-button" onclick={onAddSemester} aria-label="Add semester"
			>+</button
		>
	</div>
	<Accordion.Root type="multiple" bind:value={expanded}>
		{#each sorted as semester (semester.id)}
			{@const semesterCourses = courses.filter((course) => course.semesterId === semester.id)}
			<Accordion.Item value={semester.id} class="semester-group">
				<Accordion.Header class="semester-header">
					<Accordion.Trigger
						class="semester-trigger"
						data-route-active={activeSemesterId === semester.id ? 'true' : undefined}
						style={`--term-color: ${termColor(semester.term)}`}
					>
						<span class="semester-arrow" aria-hidden="true">▸</span>
						<span class="term-label">{semester.term} {semester.year}</span>
						<span class="sidebar-count">{countsById[semester.id] ?? semesterCourses.length}</span>
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content class="course-content">
					<div class="course-list">
						<a
							class="course-link semester-overview-link"
							href={semesterHref(semester.id)}
							data-active={$page.url.pathname === semesterHref(semester.id) ? 'true' : undefined}
						>
							<span class="overview-label">Overview</span>
							<span class="overview-arrow" aria-hidden="true">→</span>
						</a>
						{#each semesterCourses as course (course.id)}
							<a
								class="course-link"
								href={courseHref(semester.id, course.id)}
								data-active={activeCourseId === course.id ? 'true' : undefined}
							>
								<span class="nested-course-code">{course.code}</span>
								<span class="nested-course-name">{course.name}</span>
							</a>
						{/each}
					</div>
				</Accordion.Content>
			</Accordion.Item>
		{/each}
	</Accordion.Root>
	{#if sorted.length === 0}
		<button type="button" class="empty-add" onclick={onAddSemester}
			>+ Add your first semester</button
		>
	{/if}
</div>

<style>
	.term-list {
		--course-surface: color-mix(in srgb, var(--accent) 18%, var(--sidebar-bg));
		--course-hover-surface: color-mix(in srgb, var(--accent) 26%, var(--sidebar-bg));
		--course-fg: var(--sidebar-fg);
		--course-meta: color-mix(in srgb, var(--sidebar-fg) 78%, transparent);
		--course-active: var(--highlight);
		margin-top: 0.5rem;
	}
	.term-list[data-surface='paper'] {
		--course-surface: color-mix(in srgb, var(--accent) 10%, var(--paper));
		--course-hover-surface: color-mix(in srgb, var(--accent) 17%, var(--paper));
		--course-fg: var(--ink);
		--course-meta: var(--ink-soft);
		--course-active: var(--accent);
		margin-top: 0;
	}
	.sidebar-section-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--sidebar-fg-soft);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 0 1.5rem 0.5rem;
	}
	.add-button,
	.empty-add {
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}
	.add-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		font-size: 1rem;
		line-height: 1;
		transition:
			background 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}
	.add-button:hover,
	.add-button:focus-visible {
		background: var(--highlight);
		color: var(--ink);
	}
	:global(.semester-trigger) {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 2.75rem;
		gap: 0.55rem;
		border: 0;
		border-left: 2px solid transparent;
		background: transparent;
		color: var(--sidebar-fg);
		cursor: pointer;
		font: 500 0.9rem var(--font-body);
		padding: 0.5rem 1.5rem;
		text-align: left;
		transition:
			background 0.12s var(--ease-out-quart),
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}
	:global(.semester-trigger:hover:not([data-state='open'])) {
		border-left-color: var(--term-color);
		background: rgba(255, 255, 255, 0.06);
		color: var(--sidebar-fg);
	}
	:global(.semester-trigger[data-state='open']) {
		border-left-color: var(--term-color);
		background: var(--paper);
		color: var(--ink);
	}
	:global(.semester-trigger[data-route-active='true']) {
		border-left-color: var(--term-color);
	}
	:global(.semester-trigger[data-state='open']) .sidebar-count {
		color: var(--ink-soft);
	}
	:global(.semester-arrow) {
		flex: 0 0 0.75rem;
		color: var(--term-color);
		font-size: 0.85rem;
		font-weight: 700;
		transition:
			color 0.12s var(--ease-out-quart),
			transform 0.12s var(--ease-out-quart);
	}
	:global(.semester-trigger[data-state='open'] .semester-arrow) {
		transform: rotate(90deg);
	}
	.term-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sidebar-count {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--sidebar-fg-soft);
	}
	:global(.course-content),
	:global(.course-content > div) {
		margin: 0;
		border: 0;
		border-radius: 0;
		background: var(--course-surface);
		box-shadow: none;
		padding: 0;
	}
	.course-list {
		border-left: 2px solid var(--accent);
		background: var(--course-surface);
	}
	.course-link {
		display: flex;
		box-sizing: border-box;
		min-height: 2.8rem;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 0.1rem;
		border-left: 3px solid transparent;
		background: var(--course-surface);
		color: var(--course-fg);
		padding: 0.42rem 1.5rem 0.45rem 2.6rem;
		text-decoration: none;
		transition:
			box-shadow 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}
	.course-link:hover {
		background: var(--course-hover-surface);
		box-shadow: inset 3px 0 0 var(--accent);
		color: var(--course-fg);
	}
	.course-link[data-active='true'] {
		border-left-color: var(--course-active);
		background: var(--course-hover-surface);
		color: var(--course-fg);
		font-weight: 600;
	}
	.nested-course-code {
		font: 500 0.72rem/1.25 var(--font-mono);
		color: inherit;
	}
	.nested-course-name {
		max-width: 100%;
		overflow: hidden;
		color: inherit;
		font: 0.85rem/1.3 var(--font-body);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		box-orient: vertical;
		line-clamp: 2;
	}
	.course-link[data-active='true'] .nested-course-name {
		color: var(--course-active);
	}
	.course-link[data-active='true'] .nested-course-code {
		color: var(--course-meta);
	}
	.semester-overview-link {
		min-height: 2.4rem;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid color-mix(in srgb, var(--course-fg) 18%, transparent);
		font-weight: 500;
	}
	.overview-label {
		color: var(--course-meta);
		font: 500 0.7rem/1.2 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.overview-arrow {
		color: var(--course-meta);
		font-size: 0.85rem;
	}
	.semester-overview-link[data-active='true'] {
		border-left-color: var(--accent);
	}
	.semester-overview-link[data-active='true'] .overview-label,
	.semester-overview-link[data-active='true'] .overview-arrow {
		color: var(--course-fg);
	}
	.term-list[data-surface='paper'] .sidebar-section-label {
		color: var(--ink-soft);
	}
	.term-list[data-surface='paper'] :global(.semester-trigger) {
		color: var(--ink);
	}
	.term-list[data-surface='paper'] :global(.semester-trigger:hover:not([data-state='open'])),
	.term-list[data-surface='paper'] :global(.semester-trigger[data-state='open']) {
		background: var(--paper-shelf);
		color: var(--ink);
	}
	.term-list[data-surface='paper'] .sidebar-count {
		color: var(--ink-soft);
	}
	.term-list[data-surface='paper'] .empty-add {
		color: var(--ink);
	}
	.empty-add {
		color: var(--sidebar-fg);
		padding: 0.45rem 1.5rem;
		font: 500 0.88rem var(--font-body);
	}
	:global(.semester-trigger:focus-visible),
	button:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--highlight);
		outline-offset: -2px;
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.semester-arrow) {
			transition: none;
		}
	}
</style>
