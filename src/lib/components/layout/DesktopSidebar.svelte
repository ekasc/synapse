<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import Menu from '$lib/components/sidebar/Menu.svelte';
	import MenuItem from '$lib/components/sidebar/MenuItem.svelte';
	import MenuButton from '$lib/components/sidebar/MenuButton.svelte';
	import TermList from '$lib/components/catalog/TermList.svelte';
	import type { SidebarRoute } from '$lib/sidebar/routes';

	type Semester = { id: string; term: string; year: number; order: number };
	type Course = { id: string; semesterId: string; code: string; name: string };

	let {
		pathname,
		routes,
		isRouteActive,
		runningCount = 0,
		unreadCount = 0,
		weeklyPlanPending = false,
		coursesCount = 0,
		semesters = [],
		courses = [],
		countsById = {},
		onAddSemester
	}: {
		pathname: string;
		routes: SidebarRoute[];
		isRouteActive: (pathname: string, route: SidebarRoute) => boolean;
		runningCount?: number;
		unreadCount?: number;
		weeklyPlanPending?: boolean;
		coursesCount?: number;
		semesters: Semester[];
		courses: Course[];
		countsById?: Record<string, number>;
		onAddSemester: () => void;
	} = $props();
</script>

<aside
	class="sidebar sticky top-0 flex h-screen w-[var(--sidebar-width)] shrink-0 flex-col overflow-x-hidden overflow-y-auto bg-[var(--sidebar-bg)] py-6 text-[var(--sidebar-fg)] max-md:hidden"
	aria-label="App navigation"
>
	<div
		class="sidebar-header mb-4 flex items-baseline justify-between gap-2 border-b border-[var(--sidebar-rule)] px-6 pb-6"
	>
		<a
			href={resolveRoute('/')}
			class="sidebar-brand inline-flex items-baseline leading-none text-[var(--sidebar-fg)] no-underline"
			aria-label="Synapse home"
		>
			<span
				class="sidebar-brand-text text-[1.4rem] font-[var(--font-body)] font-semibold tracking-[-0.02em]"
				>Synapse</span
			><span
				class="sidebar-brand-dot text-[1.4rem] leading-none font-[var(--font-body)] font-bold text-[var(--accent)]"
				>.</span
			>
		</a>
	</div>

	<div class="sidebar-section mt-4">
		<Menu>
			{#each routes as route (route.href)}
				<MenuItem>
					<MenuButton
						href={resolveRoute(route.href as Exclude<typeof route.href, `/app/courses/[id]`>)}
						isActive={isRouteActive(pathname, route)}
						ariaLabel={route.label}
					>
						<span
							class="sidebar-label min-w-0 overflow-hidden font-medium text-ellipsis whitespace-nowrap text-[var(--sidebar-fg)] text-[var(--text-small)]"
							>{route.label}</span
						>
						{#if route.href === '/app/activity' && runningCount > 0}
							<span
								class="sidebar-activity-dot h-1.5 w-1.5 shrink-0 animate-[sb-pulse_1.2s_ease-in-out_infinite] rounded-none bg-[var(--warn)]"
								title="Job running"
							></span>
						{:else if route.href === '/app/activity' && unreadCount > 0}
							<span
								class="sidebar-badge min-w-4 bg-[var(--accent)] px-[5px] text-center leading-[1.4] font-medium text-[var(--paper)] text-[var(--text-caption)]"
								>{unreadCount}<span class="sr-only"> unread activity updates</span></span
							>
						{/if}
						{#if route.href === '/app/courses'}
							<span
								class="sidebar-count shrink-0 leading-none font-medium text-[var(--sidebar-fg-soft)] text-[var(--text-caption)]"
								>{coursesCount}</span
							>
						{/if}
						{#if route.href === '/app/weekly' && weeklyPlanPending}
							<span
								class="sidebar-nav-progress absolute bottom-0 left-0 h-0.5 w-[45%] animate-[sidebar-nav-loading_1.1s_var(--ease-out-quart)_infinite] bg-[var(--accent)]"
								aria-hidden="true"
							></span>
						{/if}
					</MenuButton>
				</MenuItem>
			{/each}
		</Menu>
	</div>

	<div class="sidebar-section mt-4">
		<TermList {semesters} {courses} {countsById} {onAddSemester} />
	</div>
</aside>

<style>
	@keyframes sb-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	@keyframes sidebar-nav-loading {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(225%);
		}
	}
</style>
