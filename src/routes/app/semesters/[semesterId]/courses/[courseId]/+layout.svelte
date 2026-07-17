<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';

	let { data, children } = $props();

	const overviewHref = $derived(
		resolveRoute('/app/semesters/[semesterId]/courses/[courseId]', {
			semesterId: data.semester.id,
			courseId: data.course.id
		})
	);
	const tabs = $derived([
		{
			label: 'Overview',
			href: overviewHref
		},
		{
			label: 'Syllabus',
			href: resolveRoute('/app/semesters/[semesterId]/courses/[courseId]/syllabus', {
				semesterId: data.semester.id,
				courseId: data.course.id
			})
		},
		{
			label: 'Materials',
			href: resolveRoute('/app/semesters/[semesterId]/courses/[courseId]/materials', {
				semesterId: data.semester.id,
				courseId: data.course.id
			})
		},
		{
			label: 'Practice',
			href: resolveRoute('/app/semesters/[semesterId]/courses/[courseId]/practice', {
				semesterId: data.semester.id,
				courseId: data.course.id
			})
		}
	]);

	function active(href: string) {
		if (href === overviewHref) return $page.url.pathname === href;
		return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`);
	}
</script>

<nav class="course-workspace-nav" aria-label={`${data.course.code} workspace`}>
	<div class="course-context">
		<span class="course-code">{data.course.code}</span>
		<span>{data.semester.term} {data.semester.year}</span>
	</div>
	<div class="course-tabs">
		{#each tabs as tab (tab.href)}
			<a href={tab.href} aria-current={active(tab.href) ? 'page' : undefined}>
				{tab.label}
			</a>
		{/each}
	</div>
</nav>

{@render children()}

<style>
	.course-workspace-nav {
		display: flex;
		max-width: var(--page-width);
		margin: 1.25rem auto 0;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}
	.course-context {
		display: flex;
		gap: 0.6rem;
		padding-bottom: 0.65rem;
		color: var(--ink-soft);
		font: 0.68rem var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.course-code {
		color: var(--ink);
		font-weight: 600;
	}
	.course-tabs {
		display: flex;
		gap: 0;
		overflow-x: auto;
	}
	.course-tabs a {
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		padding: 0.55rem 0.85rem;
		border-left: 1px solid var(--rule);
		color: var(--ink-soft);
		font: 500 0.82rem var(--font-body);
		text-decoration: none;
		white-space: nowrap;
	}
	.course-tabs a:last-child {
		border-right: 1px solid var(--rule);
	}
	.course-tabs a:hover {
		background: var(--paper-shelf);
		color: var(--ink);
	}
	.course-tabs a[aria-current='page'] {
		background: var(--highlight);
		color: var(--ink);
	}
	.course-tabs a:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	@media (max-width: 700px) {
		.course-workspace-nav {
			align-items: stretch;
			flex-direction: column;
			gap: 0;
		}
		.course-context {
			padding-bottom: 0.5rem;
		}
		.course-tabs {
			width: 100%;
		}
		.course-tabs a {
			flex: 1;
			justify-content: center;
		}
	}
</style>
