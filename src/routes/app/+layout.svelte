<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import Icon, { type IconName } from '$lib/components/sidebar/Icon.svelte';
	import MenuButton from '$lib/components/sidebar/MenuButton.svelte';
	import Menu from '$lib/components/sidebar/Menu.svelte';
	import MenuItem from '$lib/components/sidebar/MenuItem.svelte';
	import TermList from '$lib/components/catalog/TermList.svelte';
	import { routes, isRouteActive, isChildActive } from '$lib/sidebar/routes';

	let { data, children } = $props();
	const semesters = $derived(data.semesters ?? []);
	const countsById = $derived(data.countsById ?? {});

	let fabOpen = $state(false);

	let coursesOpen = $state(
		$page.url.pathname === '/app/courses' || $page.url.pathname === '/app/courses/manage'
	);

	const isCoursesActive = $derived(
		$page.url.pathname === '/app/courses' || $page.url.pathname === '/app/courses/manage'
	);

	$effect(() => {
		if (isCoursesActive) {
			coursesOpen = true;
		}
	});

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

	import { afterNavigate } from '$app/navigation';

	afterNavigate(() => {
		fabOpen = false;
	});
</script>

<div class="app-shell">
	<aside class="sidebar" aria-label="App navigation">
		<div class="sidebar-header">
			<a href={resolveRoute('/')} class="sidebar-brand" aria-label="Synapse home">
				<span class="sidebar-brand-text font-hand">Synapse</span><span class="sidebar-brand-dot"
					>.</span
				>
			</a>
		</div>

		<div class="sidebar-section">
			<div class="sidebar-section-label font-mono">Catalog</div>
			<Menu>
				{#each routes as route (route.href)}
					<MenuItem>
						{#if route.children}
							<div class="sidebar-accordion">
								<button
									class="sidebar-link sidebar-accordion-trigger"
									class:accordion-open={coursesOpen}
									onclick={() => (coursesOpen = !coursesOpen)}
									aria-expanded={coursesOpen}
									data-active={isCoursesActive ? 'true' : undefined}
								>
									<Icon name={route.icon as IconName} />
									<span class="sidebar-label">{route.label}</span>
									<span class="accordion-arrow" class:arrow-open={coursesOpen}>▾</span>
								</button>
								{#if coursesOpen}
									<div class="sidebar-accordion-children">
										{#each route.children as child (child.href)}
											{@const href = resolveRoute(
												child.href as Exclude<typeof child.href, `/app/courses/[id]`>
											)}
											<a
												{href}
												class="sidebar-link sidebar-child-link"
												class:active={isChildActive($page.url.pathname, child)}
												aria-current={isChildActive($page.url.pathname, child) ? 'page' : undefined}
											>
												<span class="sidebar-child-label">{child.label}</span>
											</a>
										{/each}
									</div>
								{/if}
							</div>
						{:else}
							<MenuButton
								href={resolveRoute(route.href as Exclude<typeof route.href, `/app/courses/[id]`>)}
								isActive={isRouteActive($page.url.pathname, route)}
								ariaLabel={route.label}
							>
								<Icon name={route.icon as IconName} />
								<span class="sidebar-label">{route.label}</span>
								{#if route.badge}
									<span class="sidebar-badge">{route.badge}</span>
								{/if}
							</MenuButton>
						{/if}
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

	<main class="app-main paper" class:canvas-main={$page.url.pathname === '/app/courses'}>
		{@render children()}
	</main>

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
						<Icon name={route.icon as IconName} size={14} />
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
	.app-shell {
		display: flex;
		min-height: 100vh;
	}

	.sidebar {
		width: var(--sidebar-width);
		flex-shrink: 0;
		background: var(--paper-shelf);
		border-right: 1px solid var(--rule);
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
		padding: 0 1.25rem 1.25rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid var(--rule);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.sidebar-brand {
		color: var(--ink);
		text-decoration: none;
		line-height: 1;
		display: inline-flex;
		align-items: baseline;
		letter-spacing: -0.02em;
	}

	.sidebar-brand-text {
		font-size: 1.7rem;
	}

	.sidebar-brand-dot {
		color: var(--accent);
		font-family: var(--font-hand);
		font-size: 1.7rem;
		font-weight: 700;
		line-height: 1;
	}

	.sidebar-section {
		margin-top: 1rem;
	}

	.sidebar-section-label {
		font-size: 0.6rem;
		color: var(--ink-faint);
		letter-spacing: 0.2em;
		padding: 0 1.25rem 0.5rem;
	}

	.sidebar-label {
		font-size: 0.88rem;
		font-weight: 500;
		letter-spacing: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.sidebar-link) :global(.sidebar-icon) {
		opacity: 0.5;
		transition: opacity 0.12s var(--ease-out-quart);
	}

	:global(.sidebar-link:hover) :global(.sidebar-icon),
	:global(.sidebar-link[data-active='true']) :global(.sidebar-icon) {
		opacity: 1;
	}

	:global(.sidebar-link[data-active='true']) {
		background: var(--paper) !important;
		border-left-color: var(--accent) !important;
		color: var(--ink) !important;
		font-weight: 600;
	}

	.sidebar-badge {
		margin-left: auto;
		min-width: 1.35rem;
		height: 1.35rem;
		padding: 0 0.4rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent);
		color: var(--paper);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0;
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
		z-index: 100;
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
		background: #fbf8f0;
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

	/* ── Accordion ── */
	.sidebar-accordion-trigger {
		display: grid;
		grid-template-columns: 1.1rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid transparent;
		font-family: var(--font-body);
		font-size: 0.88rem;
		font-weight: 500;
		color: var(--ink-soft);
		text-align: left;
		cursor: pointer;
		background: transparent;
		width: 100%;
		transition:
			color 0.12s var(--ease-out-quart),
			background 0.12s var(--ease-out-quart);
	}

	.sidebar-accordion-trigger:hover {
		color: var(--ink);
		background: var(--paper);
	}

	.sidebar-accordion-trigger:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.sidebar-accordion-trigger.accordion-open {
		color: var(--ink);
		font-weight: 500;
	}

	.sidebar-accordion-trigger :global(.sidebar-icon) {
		opacity: 0.6;
		transition: opacity 0.12s var(--ease-out-quart);
	}

	.sidebar-accordion-trigger:hover :global(.sidebar-icon),
	.sidebar-accordion-trigger.accordion-open :global(.sidebar-icon) {
		opacity: 1;
	}

	.accordion-arrow {
		font-size: 0.65rem;
		color: var(--ink-faint);
		transition: transform 0.15s var(--ease-out-quart);
		line-height: 1;
		margin-left: auto;
		display: inline-block;
	}

	.accordion-arrow.arrow-open {
		transform: rotate(180deg);
	}

	.sidebar-accordion-children {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-top: 0.1rem;
		padding-left: 1.8rem;
	}

	.sidebar-child-link {
		display: block;
		padding: 0.4rem 0.7rem 0.4rem 1.7rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 400;
		color: var(--ink-soft);
		text-decoration: none;
		border-left: 2px solid transparent;
		transition:
			color 0.12s var(--ease-out-quart),
			background 0.12s var(--ease-out-quart),
			border-left-color 0.12s var(--ease-out-quart);
	}

	.sidebar-child-link:hover {
		color: var(--ink);
		background: var(--paper);
	}

	.sidebar-child-link.active {
		color: var(--ink);
		font-weight: 500;
		background: var(--paper);
		border-left-color: var(--accent);
	}

	.sidebar-child-link:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.sidebar-child-label {
		text-transform: lowercase;
		letter-spacing: 0.02em;
	}

	@media (prefers-reduced-motion: reduce) {
		.sidebar-accordion-trigger {
			transition: none;
		}
		.accordion-arrow {
			transition: none;
		}
		.fab-btn {
			transition: none;
		}
	}
</style>
