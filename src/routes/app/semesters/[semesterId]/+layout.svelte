<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';

	let { data, children } = $props();
	const inCourseWorkspace = $derived($page.url.pathname.includes('/courses/'));
	const tabs = $derived([
		{
			label: 'Overview',
			href: resolveRoute('/app/semesters/[semesterId]', { semesterId: data.semester.id })
		}
	]);
</script>

{#if !inCourseWorkspace}
	<nav
		class="semester-workspace-nav mx-auto mt-5 flex max-w-[var(--page-width)] items-end justify-between gap-6 border-b border-[var(--ink)] max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-0"
		aria-label={`${data.semester.term} ${data.semester.year} workspace`}
	>
		<div
			class="semester-context flex gap-[0.6rem] pb-[0.65rem] text-[length:var(--text-micro)] leading-[1.4] text-[var(--ink-soft)] max-[700px]:pb-2"
		>
			<span>Semester</span>
			<strong class="text-[var(--ink)]">{data.semester.term} {data.semester.year}</strong>
		</div>
		<div class="semester-tabs flex">
			{#each tabs as tab (tab.href)}
				<a
					class="inline-flex min-h-10 items-center border-l border-[var(--rule)] px-[0.85rem] py-[0.55rem] text-[length:var(--text-small)] leading-[1.4] font-[var(--font-body)] font-medium text-[var(--ink-soft)] no-underline last:border-r hover:bg-[var(--paper-shelf)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)] aria-[current=page]:bg-[var(--highlight)] aria-[current=page]:text-[var(--ink)] max-[700px]:flex-1 max-[700px]:justify-center"
					href={tab.href}
					aria-current={$page.url.pathname === tab.href ? 'page' : undefined}
				>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
{/if}

{@render children()}
