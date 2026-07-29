<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import TermList from '$lib/components/catalog/TermList.svelte';
	import type { SidebarRoute } from '$lib/sidebar/routes';

	type Semester = { id: string; term: string; year: number; order: number };
	type Course = { id: string; semesterId: string; code: string; name: string };

	let {
		currentTermLabel,
		todayLabel,
		pathname,
		routes,
		isRouteActive,
		fabOpen = $bindable(false),
		semesters = [],
		courses = [],
		countsById = {},
		onAddSemester
	}: {
		currentTermLabel: string;
		todayLabel: string;
		pathname: string;
		routes: SidebarRoute[];
		isRouteActive: (pathname: string, route: SidebarRoute) => boolean;
		fabOpen?: boolean;
		semesters: Semester[];
		courses: Course[];
		countsById?: Record<string, number>;
		onAddSemester: () => void;
	} = $props();
</script>

<div class="topbar">
	<div class="topbar-actions">
		<div class="current-term max-sm:max-w-32 max-sm:text-right">{currentTermLabel}</div>
		<div class="today max-sm:hidden">{todayLabel}</div>
		<div id="synapse-fab" class="mobile-nav relative hidden max-md:block">
			<button
				type="button"
				onclick={() => (fabOpen = !fabOpen)}
				class="fab-btn flex h-11 w-11 cursor-pointer items-center justify-center border border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] transition-[background,border-color] duration-150 ease-[var(--ease-out-quart)] hover:bg-[var(--ink)] hover:text-[var(--paper)] motion-reduce:transition-none"
				aria-label={fabOpen ? 'Close navigation' : 'Open navigation'}
				aria-expanded={fabOpen}
				aria-controls="synapse-mobile-nav"
			>
				<span class="fab-btn-icon text-base leading-none">{fabOpen ? '✕' : '☰'}</span>
			</button>
			{#if fabOpen}
				<nav
					id="synapse-mobile-nav"
					class="mobile-nav-popup absolute top-[calc(100%+8px)] right-0 z-[var(--z-fab)] max-h-[calc(100vh-5rem)] min-w-48 overflow-x-hidden overflow-y-auto border border-[var(--rule)] bg-[var(--surface-paper)]"
					aria-label="Mobile app navigation"
				>
					{#each routes as route (route.href)}
						<a
							href={resolveRoute(route.href as Exclude<typeof route.href, `/app/courses/[id]`>)}
							class="fab-item flex w-full cursor-pointer items-center gap-[0.65rem] border-0 border-b border-b-[rgba(26,26,23,0.05)] bg-transparent px-4 py-3 text-left font-[var(--font-body)] text-[var(--ink-soft)] text-[var(--text-caption)] no-underline transition-[background,color] duration-120 ease-[var(--ease-out-quart)] last:border-b-0 hover:bg-[var(--paper-shelf)] hover:text-[var(--ink)] aria-[current=page]:border-l-2 aria-[current=page]:border-l-[var(--accent)] aria-[current=page]:bg-[var(--paper-shelf)] aria-[current=page]:font-medium aria-[current=page]:text-[var(--ink)]"
							aria-current={isRouteActive(pathname, route) ? 'page' : undefined}
						>
							<span class="fab-label text-[var(--text-small)]">{route.label}</span>
						</a>
					{/each}
					<div class="mobile-semesters border-t border-[var(--rule)]">
						<TermList {semesters} {courses} {countsById} {onAddSemester} surface="paper" />
					</div>
				</nav>
			{/if}
		</div>
	</div>
</div>
