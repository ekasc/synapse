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

<nav
	class="course-workspace-nav mx-auto mt-5 flex max-w-[var(--page-width)] items-end justify-between gap-6 border-b border-[var(--ink)] max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:gap-0"
	aria-label={`${data.course.code} workspace`}
>
	<div
		class="course-context flex gap-[0.6rem] pb-[0.65rem] text-[length:var(--text-micro)] leading-[1.4] text-[var(--ink-soft)] max-[700px]:pb-2"
	>
		<span class="course-code font-semibold text-[var(--ink)]">{data.course.code}</span>
		<span>{data.semester.term} {data.semester.year}</span>
	</div>
	<div class="course-tabs flex gap-0 overflow-x-auto max-[700px]:w-full">
		{#each tabs as tab (tab.href)}
			<a
				class="inline-flex min-h-10 items-center border-l border-[var(--rule)] px-[0.85rem] py-[0.55rem] text-[length:var(--text-small)] leading-[1.4] font-[var(--font-body)] font-medium whitespace-nowrap text-[var(--ink-soft)] no-underline last:border-r hover:bg-[var(--paper-shelf)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)] aria-[current=page]:bg-[var(--highlight)] aria-[current=page]:text-[var(--ink)] max-[700px]:flex-1 max-[700px]:justify-center"
				href={tab.href}
				aria-current={active(tab.href) ? 'page' : undefined}
			>
				{tab.label}
			</a>
		{/each}
	</div>
</nav>

{@render children()}
