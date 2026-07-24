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
		<div class="current-term">{currentTermLabel}</div>
		<div class="today">{todayLabel}</div>
		<div id="synapse-fab" class="mobile-nav">
			<button
				type="button"
				onclick={() => (fabOpen = !fabOpen)}
				class="fab-btn"
				aria-label={fabOpen ? 'Close navigation' : 'Open navigation'}
				aria-expanded={fabOpen}
				aria-controls="synapse-mobile-nav"
			>
				<span class="fab-btn-icon">{fabOpen ? '✕' : '☰'}</span>
			</button>
			{#if fabOpen}
				<nav id="synapse-mobile-nav" class="mobile-nav-popup" aria-label="Mobile app navigation">
					{#each routes as route (route.href)}
						<a
							href={resolveRoute(route.href as Exclude<typeof route.href, `/app/courses/[id]`>)}
							class="fab-item"
							class:fab-active={isRouteActive(pathname, route)}
							aria-current={isRouteActive(pathname, route) ? 'page' : undefined}
						>
							<span class="fab-label">{route.label}</span>
						</a>
					{/each}
					<div class="mobile-semesters">
						<TermList {semesters} {courses} {countsById} {onAddSemester} surface="paper" />
					</div>
				</nav>
			{/if}
		</div>
	</div>
</div>

<style>
	.mobile-nav {
		display: none;
		position: relative;
	}

	@media (max-width: 767px) {
		.mobile-nav {
			display: block;
		}
	}

	.mobile-nav-popup {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 12rem;
		max-height: calc(100vh - 5rem);
		background: var(--surface-paper);
		border: 1px solid var(--rule);
		overflow-x: hidden;
		overflow-y: auto;
		z-index: var(--z-fab);
	}

	.fab-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.75rem 1rem;
		color: var(--ink-soft);
		text-align: left;
		font-size: 0.85rem;
		border: none;
		border-bottom: 1px solid rgba(26, 26, 23, 0.05);
		background: none;
		cursor: pointer;
		text-decoration: none;
		font-family: var(--font-body);
		transition:
			background 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}

	.fab-item:last-child {
		border-bottom: none;
	}

	.fab-item:hover {
		background: var(--paper-shelf);
		color: var(--ink);
	}

	.fab-active {
		background: var(--paper-shelf);
		color: var(--ink);
		border-left: 2px solid var(--accent);
		font-weight: 500;
	}

	.fab-label {
		font-size: 0.9rem;
	}

	.mobile-semesters {
		border-top: 1px solid var(--rule);
	}

	.fab-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
		font-family: var(--font-mono);
		transition:
			background 0.15s var(--ease-out-quart),
			border-color 0.15s var(--ease-out-quart);
	}

	.fab-btn:hover {
		background: var(--ink);
		color: var(--paper);
	}

	.fab-btn-icon {
		font-size: 1rem;
		line-height: 1;
	}

	@media (max-width: 640px) {
		.today {
			display: none;
		}
		.current-term {
			max-width: 8rem;
			text-align: right;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fab-btn {
			transition: none;
		}
	}
</style>
