<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';

	let { data, children } = $props();
	const inCourseWorkspace = $derived($page.url.pathname.includes('/courses/'));
	const tabs = $derived([
		{
			label: 'Overview',
			href: resolveRoute('/app/semesters/[semesterId]', { semesterId: data.semester.id })
		},
		{
			label: 'Calendar',
			href: resolveRoute('/app/semesters/[semesterId]/calendar', {
				semesterId: data.semester.id
			})
		}
	]);
</script>

{#if !inCourseWorkspace}
	<nav
		class="semester-workspace-nav"
		aria-label={`${data.semester.term} ${data.semester.year} workspace`}
	>
		<div class="semester-context">
			<span>Semester</span>
			<strong>{data.semester.term} {data.semester.year}</strong>
		</div>
		<div class="semester-tabs">
			{#each tabs as tab (tab.href)}
				<a href={tab.href} aria-current={$page.url.pathname === tab.href ? 'page' : undefined}>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
{/if}

{@render children()}

<style>
	.semester-workspace-nav {
		display: flex;
		max-width: var(--page-width);
		margin: 1.25rem auto 0;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}
	.semester-context {
		display: flex;
		gap: 0.6rem;
		padding-bottom: 0.65rem;
		color: var(--ink-soft);
		font: 0.68rem var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.semester-context strong {
		color: var(--ink);
	}
	.semester-tabs {
		display: flex;
	}
	.semester-tabs a {
		min-height: 2.5rem;
		display: inline-flex;
		align-items: center;
		padding: 0.55rem 0.85rem;
		border-left: 1px solid var(--rule);
		color: var(--ink-soft);
		font: 500 0.82rem var(--font-body);
		text-decoration: none;
	}
	.semester-tabs a:last-child {
		border-right: 1px solid var(--rule);
	}
	.semester-tabs a:hover {
		background: var(--paper-shelf);
		color: var(--ink);
	}
	.semester-tabs a[aria-current='page'] {
		background: var(--highlight);
		color: var(--ink);
	}
	.semester-tabs a:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	@media (max-width: 700px) {
		.semester-workspace-nav {
			align-items: stretch;
			flex-direction: column;
			gap: 0;
		}
		.semester-context {
			padding-bottom: 0.5rem;
		}
		.semester-tabs a {
			flex: 1;
			justify-content: center;
		}
	}
</style>
