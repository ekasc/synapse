<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import MenuButton from '$lib/components/sidebar/MenuButton.svelte';
	import Menu from '$lib/components/sidebar/Menu.svelte';
	import MenuItem from '$lib/components/sidebar/MenuItem.svelte';
	import TermList from '$lib/components/catalog/TermList.svelte';
	import { routes, isRouteActive } from '$lib/sidebar/routes';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	let { data, children } = $props();
	const semesters = $derived(data.semesters ?? []);
	const courses = $derived(data.courses ?? []);
	const countsById = $derived(data.countsById ?? {});

	let fabOpen = $state(false);
	let now = $state(new Date());

	$effect(() => {
		if (!fabOpen) return;
		function onClick(e: MouseEvent) {
			const el = document.getElementById('synapse-fab');
			if (el && !el.contains(e.target as Node)) fabOpen = false;
		}
		const raf = requestAnimationFrame(() => document.addEventListener('click', onClick));
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('click', onClick);
		};
	});

	$effect(() => {
		if (!fabOpen) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') fabOpen = false;
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	// ── Activity badge state ──
	let runningCount = $state(0);
	let unreadCount = $state(0);

	type ActivityJob = {
		status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'expired';
		completedAt: string | null;
	};

	async function checkActivity() {
		try {
			const res = await fetch('/api/briefing/activity');
			const { jobs } = (await res.json()) as { jobs?: ActivityJob[] };
			if (!jobs) return;
			runningCount = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
			const stored = localStorage.getItem('activity_last_read');
			const lastRead = stored ? parseInt(stored, 10) : 0;
			unreadCount = jobs.filter(
				(j) =>
					(j.status === 'succeeded' || j.status === 'failed' || j.status === 'expired') &&
					j.completedAt &&
					new Date(j.completedAt).getTime() > lastRead
			).length;
		} catch (err) {
			console.error('Failed to check activity:', err);
		}
	}

	// Update the "today" stamp every minute
	onMount(() => {
		checkActivity();
		const id = setInterval(checkActivity, 10000);
		const tick = setInterval(() => (now = new Date()), 60_000);
		return () => {
			clearInterval(id);
			clearInterval(tick);
		};
	});

	afterNavigate(() => {
		fabOpen = false;
	});

	function currentPageLabel(pathname: string): string {
		const route = routes.find((r) => isRouteActive(pathname, r));
		if (route) return route.label;
		if (pathname.startsWith('/app/courses/')) return 'Course';
		if (pathname.startsWith('/app/calendar')) return 'Calendar';
		return 'Workspace';
	}

	const pageLabel = $derived(currentPageLabel($page.url.pathname));

	const todayLabel = $derived(
		now
			.toLocaleString('en-US', {
				weekday: 'short',
				day: '2-digit',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			})
			.toUpperCase()
	);

	const currentTermLabel = $derived(
		semesters[0] ? `${semesters[0].term} ${semesters[0].year}` : 'No term'
	);
</script>

<div class="app-grid">
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
							isActive={isRouteActive($page.url.pathname, route)}
							ariaLabel={route.label}
						>
							<span class="sidebar-label">{route.label}</span>
							{#if route.href === '/app/activity' && runningCount > 0}
								<span class="sidebar-activity-dot" title="Job running"></span>
							{:else if route.href === '/app/activity' && unreadCount > 0}
								<span class="sidebar-badge font-mono">{unreadCount}</span>
							{/if}
							{#if route.href === '/app/courses'}
								<span class="sidebar-count">{courses.length}</span>
							{/if}
						</MenuButton>
					</MenuItem>
				{/each}
			</Menu>
		</div>

		{#if semesters.length > 0}
			<div class="sidebar-section">
				<TermList {semesters} {countsById} />
			</div>
		{/if}
	</aside>

	<div class="app-content">
		<div class="topbar">
			<div class="crumbs">Synapse · <strong>{pageLabel}</strong></div>
			<div class="topbar-actions">
				<input class="topbar-search" type="text" placeholder="Search courses, briefs…" />
				<button type="button" class="term-switcher">{currentTermLabel} ▾</button>
				<div class="today">{todayLabel}</div>
			</div>
		</div>

		<main class="app-main" class:canvas-main={$page.url.pathname === '/app/courses'}>
			{@render children()}
		</main>
	</div>

	<!-- Mobile floating nav (hidden on md+) -->
	<div id="synapse-fab" class="fab-container">
		{#if fabOpen}
			<nav class="fab-popup" aria-label="Mobile app navigation">
				{#each routes as route (route.href)}
					<a
						href={resolveRoute(route.href as Exclude<typeof route.href, `/app/courses/[id]`>)}
						class="fab-item"
						class:fab-active={isRouteActive($page.url.pathname, route)}
						aria-current={isRouteActive($page.url.pathname, route) ? 'page' : undefined}
					>
						<span class="fab-label">{route.label}</span>
					</a>
				{/each}
			</nav>
		{/if}

		<button
			type="button"
			onclick={() => (fabOpen = !fabOpen)}
			class="fab-btn"
			aria-label={fabOpen ? 'Close navigation' : 'Open navigation'}
			aria-expanded={fabOpen}
		>
			<span class="fab-btn-icon">{fabOpen ? '✕' : '☰'}</span>
		</button>
	</div>
</div>

<style>
	.app-grid {
		display: grid;
		grid-template-columns: var(--sidebar-width) 1fr;
		min-height: 100vh;
	}

	@media (max-width: 767px) {
		.app-grid {
			grid-template-columns: 1fr;
		}
	}

	.app-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

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

	/* Override sidebar link colors for dark theme */
	:global(.sidebar-link) {
		padding: 0.45rem 1.5rem;
		color: var(--sidebar-fg);
		border-left-color: transparent;
	}

	:global(.sidebar-link:hover) {
		background: rgba(255, 255, 255, 0.04);
		color: var(--sidebar-fg);
		border-left-color: var(--accent);
	}

	:global(.sidebar-link[data-active='true']) {
		background: rgba(255, 255, 255, 0.06);
		color: var(--sidebar-fg);
		border-left-color: var(--accent);
		font-weight: 600;
	}

	.app-main {
		flex: 1;
		padding: 0;
		min-width: 0;
		position: relative;
		background: var(--paper);
	}

	.app-main > :global(*) {
		padding-left: 2rem;
		padding-right: 2rem;
	}

	.app-main.canvas-main {
		display: flex;
		flex-direction: column;
	}

	@media (max-width: 640px) {
		.app-main > :global(*) {
			padding-left: 1.25rem;
			padding-right: 1.25rem;
		}
	}

	/* ── Mobile Floating Nav ── */
	.fab-container {
		position: fixed;
		bottom: 1.25rem;
		right: 1.25rem;
		z-index: var(--z-fab);
	}

	@media (min-width: 768px) {
		.fab-container {
			display: none;
		}
	}

	.fab-popup {
		position: absolute;
		bottom: calc(100% + 12px);
		right: 0;
		min-width: 12rem;
		background: var(--surface-paper);
		border: 1px solid var(--rule);
		overflow: hidden;
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

	@media (prefers-reduced-motion: reduce) {
		.fab-btn {
			transition: none;
		}
	}
</style>
