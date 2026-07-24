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

<aside class="sidebar" aria-label="App navigation">
	<div class="sidebar-header">
		<a href={resolveRoute('/')} class="sidebar-brand" aria-label="Synapse home">
			<span class="sidebar-brand-text">Synapse</span><span class="sidebar-brand-dot">.</span>
		</a>
	</div>

	<div class="sidebar-section">
		<div class="sidebar-section-label">Workspace</div>
		<Menu>
			{#each routes as route (route.href)}
				<MenuItem>
					<MenuButton
						href={resolveRoute(route.href as Exclude<typeof route.href, `/app/courses/[id]`>)}
						isActive={isRouteActive(pathname, route)}
						ariaLabel={route.label}
					>
						<span class="sidebar-label">{route.label}</span>
						{#if route.href === '/app/activity' && runningCount > 0}
							<span class="sidebar-activity-dot" title="Job running"></span>
						{:else if route.href === '/app/activity' && unreadCount > 0}
							<span class="sidebar-badge font-mono"
								>{unreadCount}<span class="sr-only"> unread activity updates</span></span
							>
						{/if}
						{#if route.href === '/app/courses'}
							<span class="sidebar-count">{coursesCount}</span>
						{/if}
						{#if route.href === '/app/weekly' && weeklyPlanPending}
							<span class="sidebar-nav-progress" aria-hidden="true"></span>
						{/if}
					</MenuButton>
				</MenuItem>
			{/each}
		</Menu>
	</div>

	<div class="sidebar-section">
		<TermList {semesters} {courses} {countsById} {onAddSemester} />
	</div>
</aside>

<style>
	.sidebar {
		width: var(--sidebar-width);
		flex-shrink: 0;
		background: var(--sidebar-bg);
		color: var(--sidebar-fg);
		display: flex;
		flex-direction: column;
		padding: 1.5rem 0;
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-x: hidden;
		overflow-y: auto;
	}

	@media (max-width: 767px) {
		.sidebar {
			display: none;
		}
	}

	.sidebar-header {
		padding: 0 1.5rem 1.5rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--sidebar-rule);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.sidebar-brand {
		color: var(--sidebar-fg);
		text-decoration: none;
		line-height: 1;
		display: inline-flex;
		align-items: baseline;
	}

	.sidebar-brand-text {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.sidebar-brand-dot {
		color: var(--accent);
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 700;
		line-height: 1;
	}

	.sidebar-section {
		margin-top: 1rem;
	}

	.sidebar-section-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--sidebar-fg-soft);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 0 1.5rem 0.5rem;
	}

	.sidebar-label {
		font-size: 0.88rem;
		font-weight: 500;
		letter-spacing: 0;
		color: var(--sidebar-fg);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-activity-dot {
		width: 6px;
		height: 6px;
		flex-shrink: 0;
		background: var(--warn);
		border-radius: 0;
		animation: sb-pulse 1.2s ease-in-out infinite;
	}

	.sidebar-badge {
		font-size: 0.65rem;
		color: var(--paper);
		background: var(--accent);
		padding: 0 5px;
		line-height: 1.4;
		font-weight: 500;
		min-width: 1rem;
		text-align: center;
	}

	@keyframes sb-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.sidebar-count {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--sidebar-fg-soft);
		font-weight: 500;
		line-height: 1;
		flex-shrink: 0;
	}

	.sidebar-nav-progress {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 45%;
		height: 2px;
		background: var(--accent);
		animation: sidebar-nav-loading 1.1s var(--ease-out-quart) infinite;
	}

	@keyframes sidebar-nav-loading {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(225%);
		}
	}

	/* Override sidebar link colors for dark theme */
	:global(.sidebar-link) {
		padding: 0.45rem 1.5rem;
		color: var(--sidebar-fg);
		border-left-color: transparent;
	}

	:global(.sidebar-link:hover) {
		background: rgba(255, 255, 255, 0.04);
		color: var(--sidebar-fg);
		border-left-color: rgba(245, 236, 217, 0.35);
	}

	:global(.sidebar-link[data-active='true']) {
		background: rgba(255, 255, 255, 0.06);
		color: var(--sidebar-fg);
		border-left-color: var(--accent);
		font-weight: 600;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
