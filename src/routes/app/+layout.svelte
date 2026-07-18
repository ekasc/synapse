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
	import { goto, invalidateAll } from '$app/navigation';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { resolveTermContext } from '$lib/dashboard/priority';

	let { data, children } = $props();
	const semesters = $derived(data.semesters ?? []);
	const courses = $derived(data.courses ?? []);
	const countsById = $derived(data.countsById ?? {});

	let fabOpen = $state(false);
	let now = $state(new Date());
	let addSemesterOpen = $state(false);
	let savingSemester = $state(false);
	let semesterError = $state('');
	let newTerm = $state<'Winter' | 'Spring' | 'Summer' | 'Fall'>('Spring');
	let newYear = $state(new Date().getFullYear());
	let queryOpened = false;

	const termOrder: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
	const termChoices = ['Winter', 'Spring', 'Summer', 'Fall'] as const;
	function openAddSemester() {
		const date = new Date();
		const month = date.getMonth() + 1;
		newTerm = month <= 4 ? 'Winter' : month <= 6 ? 'Spring' : month <= 8 ? 'Summer' : 'Fall';
		newYear = date.getFullYear();
		while (
			semesters.some(
				(semester) =>
					semester.term.toLowerCase() === newTerm.toLowerCase() && semester.year === newYear
			)
		) {
			const index = termChoices.indexOf(newTerm);
			if (index < termChoices.length - 1) newTerm = termChoices[index + 1];
			else {
				newTerm = termChoices[0];
				newYear += 1;
			}
		}
		semesterError = '';
		addSemesterOpen = true;
	}
	$effect(() => {
		if ($page.url.pathname !== '/app/semesters' || $page.url.searchParams.get('new') !== '1')
			queryOpened = false;
		if (
			$page.url.pathname === '/app/semesters' &&
			$page.url.searchParams.get('new') === '1' &&
			!queryOpened
		) {
			queryOpened = true;
			openAddSemester();
		}
	});
	async function saveSemester() {
		if (!Number.isInteger(newYear) || newYear < 2000 || newYear > 2100) {
			semesterError = 'Year must be an integer from 2000 to 2100.';
			return;
		}
		if (
			semesters.some(
				(semester) =>
					semester.term.toLowerCase() === newTerm.toLowerCase() && semester.year === newYear
			)
		) {
			semesterError = 'That semester already exists.';
			return;
		}
		savingSemester = true;
		semesterError = '';
		const id = crypto.randomUUID();
		try {
			const response = await fetch('/api/semesters', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id,
					term: newTerm,
					year: newYear,
					order: newYear * 10 + termOrder[newTerm]
				})
			});
			if (!response.ok)
				throw new Error(
					(await response.json().catch(() => null))?.error ?? 'Could not add semester.'
				);
			addSemesterOpen = false;
			await invalidateAll();
			await goto(`/app/semesters/${encodeURIComponent(id)}`);
		} catch (error) {
			semesterError = error instanceof Error ? error.message : 'Could not add semester.';
		} finally {
			savingSemester = false;
		}
	}

	function handleDocumentClick(event: MouseEvent) {
		if (!fabOpen) return;
		const fab = document.getElementById('synapse-fab');
		if (fab && !fab.contains(event.target as Node)) fabOpen = false;
	}

	function handleDocumentKeydown(event: KeyboardEvent) {
		if (fabOpen && event.key === 'Escape') fabOpen = false;
	}

	// ── Activity badge state ──
	let runningCount = $state(0);
	let unreadCount = $state(0);
	let activityRequestPending = false;

	type ActivityJob = {
		status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'expired';
		completedAt: string | null;
	};

	type AcademicDigestJob = {
		id: string;
		fileName: string;
		status: 'queued' | 'processing' | 'completed' | 'failed';
		error: string | null;
	};

	let academicDigestJob = $state<AcademicDigestJob | null>(null);
	let digestRequestPending = false;
	let refreshedDigestJobId = '';

	function showAcademicDigestJob(job: AcademicDigestJob | null) {
		if (!job) return;
		const dismissedId = sessionStorage.getItem('dismissed_academic_digest_job');
		if ((job.status === 'completed' || job.status === 'failed') && dismissedId === job.id) return;
		academicDigestJob = job;
	}

	function dismissAcademicDigestJob() {
		if (academicDigestJob) {
			sessionStorage.setItem('dismissed_academic_digest_job', academicDigestJob.id);
		}
		academicDigestJob = null;
	}

	async function checkAcademicDigestJob(signal?: AbortSignal) {
		if (digestRequestPending) return;
		digestRequestPending = true;
		try {
			const response = await fetch('/api/digest/jobs', { signal });
			if (!response.ok) return;
			const result = (await response.json()) as { job?: AcademicDigestJob | null };
			showAcademicDigestJob(result.job ?? null);
			if (result.job?.status === 'completed' && refreshedDigestJobId !== result.job.id) {
				refreshedDigestJobId = result.job.id;
				await invalidateAll();
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			console.error('Failed to check transcript digestion:', error);
		} finally {
			digestRequestPending = false;
		}
	}

	async function checkActivity(signal?: AbortSignal) {
		if (activityRequestPending) return;
		activityRequestPending = true;
		try {
			const res = await fetch('/api/briefing/activity', { signal });
			if (!res.ok) return;
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
			if (err instanceof DOMException && err.name === 'AbortError') return;
			console.error('Failed to check activity:', err);
		} finally {
			activityRequestPending = false;
		}
	}

	// Update the "today" stamp every minute
	onMount(() => {
		const activityController = new AbortController();
		const handleDigestStarted = (event: Event) => {
			const job = (event as CustomEvent<AcademicDigestJob>).detail;
			sessionStorage.removeItem('dismissed_academic_digest_job');
			academicDigestJob = job;
		};
		window.addEventListener('academic-digest-job-started', handleDigestStarted);
		void checkActivity(activityController.signal);
		void checkAcademicDigestJob(activityController.signal);
		const id = setInterval(() => void checkActivity(activityController.signal), 10000);
		const digestId = setInterval(
			() => void checkAcademicDigestJob(activityController.signal),
			2500
		);
		const tick = setInterval(() => (now = new Date()), 60_000);
		return () => {
			activityController.abort();
			clearInterval(id);
			clearInterval(digestId);
			clearInterval(tick);
			window.removeEventListener('academic-digest-job-started', handleDigestStarted);
		};
	});

	afterNavigate(() => {
		fabOpen = false;
	});

	function currentPageLabel(pathname: string): string {
		const route = routes.find((r) => isRouteActive(pathname, r));
		if (route) return route.label;
		if (pathname.startsWith('/app/semesters/') && pathname.includes('/courses/')) return 'Course';
		if (pathname.startsWith('/app/semesters/')) return 'Semester';
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

	const termContext = $derived(resolveTermContext(now, semesters));
	const currentTermLabel = $derived(
		termContext
			? `${termContext.relation === 'next' ? 'Next · ' : termContext.relation === 'latest' ? 'Latest · ' : ''}${termContext.semester.term} ${termContext.semester.year}`
			: 'No term'
	);
</script>

<svelte:document onclick={handleDocumentClick} onkeydown={handleDocumentKeydown} />

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

		<div class="sidebar-section">
			<TermList {semesters} {courses} {countsById} onAddSemester={openAddSemester} />
		</div>
	</aside>

	<div class="app-content">
		<div class="topbar">
			<div class="crumbs">Synapse · <strong>{pageLabel}</strong></div>
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
					>
						<span class="fab-btn-icon">{fabOpen ? '✕' : '☰'}</span>
					</button>
					{#if fabOpen}
						<nav class="mobile-nav-popup" aria-label="Mobile app navigation">
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
							<div class="mobile-semesters">
								<TermList
									{semesters}
									{courses}
									{countsById}
									onAddSemester={openAddSemester}
									surface="paper"
								/>
							</div>
						</nav>
					{/if}
				</div>
			</div>
		</div>

		{#if academicDigestJob}
			<div
				class="digest-job-banner"
				class:failed={academicDigestJob.status === 'failed'}
				class:completed={academicDigestJob.status === 'completed'}
				role={academicDigestJob.status === 'failed' ? 'alert' : 'status'}
			>
				<div>
					<span class="digest-job-pulse" aria-hidden="true"></span>
					<strong>
						{academicDigestJob.status === 'completed'
							? 'Transcript ready'
							: academicDigestJob.status === 'failed'
								? 'Transcript digestion failed'
								: 'Digesting transcript'}
					</strong>
					<span>{academicDigestJob.fileName}</span>
					{#if academicDigestJob.error}<span>{academicDigestJob.error}</span>{/if}
				</div>
				<a href={resolveRoute('/app/digest')}>Grade analytics</a>
				{#if academicDigestJob.status === 'completed' || academicDigestJob.status === 'failed'}
					<button
						type="button"
						aria-label="Dismiss transcript status"
						onclick={dismissAcademicDigestJob}>x</button
					>
				{/if}
			</div>
		{/if}

		<main class="app-main" class:canvas-main={$page.url.pathname === '/app/courses'}>
			{@render children()}
		</main>
	</div>
</div>

{#if addSemesterOpen}
	<Dialog
		bind:open={addSemesterOpen}
		title="Add semester"
		description="Choose a term and year to get started."
	>
		<form
			class="semester-form"
			onsubmit={(event) => {
				event.preventDefault();
				void saveSemester();
			}}
		>
			<fieldset>
				<legend>Term</legend>
				<div class="term-buttons">
					{#each termChoices as term}<button
							type="button"
							class:chosen={newTerm === term}
							onclick={() => (newTerm = term as typeof newTerm)}>{term}</button
						>{/each}
				</div>
			</fieldset>
			<label>Year<input type="number" min="2000" max="2100" bind:value={newYear} /></label>
			{#if semesterError}<p class="form-error" role="alert">{semesterError}</p>{/if}
			<button class="btn btn-primary" type="submit" disabled={savingSemester}
				>{savingSemester ? 'Saving…' : 'Add semester'}</button
			>
		</form>
	</Dialog>
{/if}

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

	.digest-job-banner {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		border-bottom: 1px solid var(--ink);
		background: var(--highlight-soft);
		padding: 0.6rem 1rem;
		color: var(--ink);
	}

	.digest-job-banner > div {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		flex: 1;
	}

	.digest-job-banner span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.78rem;
	}

	.digest-job-banner a,
	.digest-job-banner button {
		color: inherit;
		font: inherit;
		font-size: 0.76rem;
		font-weight: 600;
	}

	.digest-job-banner button {
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.digest-job-banner.completed {
		background: color-mix(in srgb, var(--ok) 18%, var(--paper));
	}

	.digest-job-banner.failed {
		background: color-mix(in srgb, var(--accent) 16%, var(--paper));
	}

	.digest-job-pulse {
		width: 0.55rem;
		height: 0.55rem;
		flex: 0 0 auto;
		background: var(--warn);
		animation: digest-pulse 1.2s ease-in-out infinite;
	}

	.completed .digest-job-pulse {
		background: var(--ok);
		animation: none;
	}

	.failed .digest-job-pulse {
		background: var(--accent);
		animation: none;
	}

	@keyframes digest-pulse {
		50% {
			opacity: 0.3;
		}
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

	/* ── Mobile Nav in Topbar ── */
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
	.semester-form {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}
	.semester-form fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.semester-form legend,
	.semester-form label {
		display: grid;
		gap: 0.4rem;
		font-size: 0.85rem;
	}
	.term-buttons {
		display: flex;
		gap: 0.5rem;
	}
	.term-buttons button {
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
	}
	.term-buttons button.chosen {
		background: var(--ink);
		color: var(--paper);
	}
	.semester-form input {
		padding: 0.6rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font: inherit;
	}
	.form-error {
		margin: 0;
		color: var(--danger, #a33);
		font-size: 0.85rem;
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
