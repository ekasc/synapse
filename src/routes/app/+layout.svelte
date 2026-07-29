<script lang="ts">
	import { navigating, page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { goto, invalidateAll } from '$app/navigation';
	import { routes, isRouteActive } from '$lib/sidebar/routes';
	import { onMount } from 'svelte';
	import { resolveTermContext } from '$lib/dashboard/priority';
	import DesktopSidebar from '$lib/components/layout/DesktopSidebar.svelte';
	import Topbar from '$lib/components/layout/Topbar.svelte';
	import DigestBanner from '$lib/components/layout/DigestBanner.svelte';
	import AddSemesterDialog from '$lib/components/layout/AddSemesterDialog.svelte';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';

	let { data, children } = $props();

	// ── Auth guard ──
	$effect(() => {
		if (!data.user) {
			goto('/auth/error?reason=unauthenticated', { replaceState: true });
		}
	});

	const semesters = $derived(data.semesters ?? []);
	const courses = $derived(data.courses ?? []);
	const countsById = $derived(data.countsById ?? {});
	const weeklyPlanPending = $derived($navigating?.to?.url.pathname === '/app/weekly');

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
			if (!response.ok) {
				const body: unknown = await response.json().catch(() => null);
				const message =
					body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
						? body.error
						: 'Could not add semester.';
				throw new Error(message);
			}
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

	function digestJobIsActive(job: AcademicDigestJob | null): boolean {
		return !!job && (job.status === 'queued' || job.status === 'processing');
	}

	// Returns whether the most recent digest job is still active (non-terminal), so the
	// caller can decide whether to keep polling.
	async function checkAcademicDigestJob(signal?: AbortSignal): Promise<boolean> {
		if (digestRequestPending) return digestJobIsActive(academicDigestJob);
		digestRequestPending = true;
		try {
			const response = await fetch('/api/digest/jobs', { signal });
			if (!response.ok) return digestJobIsActive(academicDigestJob);
			const result = (await response.json()) as { job?: AcademicDigestJob | null };
			const job = result.job ?? null;
			showAcademicDigestJob(job);
			if (job?.status === 'completed' && refreshedDigestJobId !== job.id) {
				refreshedDigestJobId = job.id;
				await invalidateAll();
			}
			return digestJobIsActive(job);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return false;
			console.error('Failed to check transcript digestion:', error);
			return digestJobIsActive(academicDigestJob);
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
		const signal = activityController.signal;

		// ── Digest job polling: only while a job is active ──
		let digestInterval: ReturnType<typeof setInterval> | null = null;
		let digestActive = false;

		const clearDigestInterval = () => {
			if (digestInterval !== null) {
				clearInterval(digestInterval);
				digestInterval = null;
			}
		};
		const armDigestInterval = () => {
			if (!digestActive) return;
			if (document.visibilityState !== 'visible') return;
			if (digestInterval !== null) return;
			digestInterval = setInterval(() => void pollDigestJob(), 2500);
		};
		const pollDigestJob = async () => {
			digestActive = await checkAcademicDigestJob(signal);
			if (digestActive) armDigestInterval();
			else clearDigestInterval();
		};

		// ── Briefing activity polling: ~20s, paused while the tab is hidden ──
		let activityInterval: ReturnType<typeof setInterval> | null = null;
		const clearActivityInterval = () => {
			if (activityInterval !== null) {
				clearInterval(activityInterval);
				activityInterval = null;
			}
		};
		const armActivityInterval = () => {
			if (document.visibilityState !== 'visible') return;
			if (activityInterval !== null) return;
			activityInterval = setInterval(() => void checkActivity(signal), 20000);
		};

		// Pause both pollers while hidden; resume (with an immediate refresh) on return.
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') {
				armActivityInterval();
				armDigestInterval();
				void checkActivity(signal);
				void pollDigestJob();
			} else {
				clearActivityInterval();
				clearDigestInterval();
			}
		};

		const handleDigestStarted = (event: Event) => {
			const job = (event as CustomEvent<AcademicDigestJob>).detail;
			sessionStorage.removeItem('dismissed_academic_digest_job');
			academicDigestJob = job;
			digestActive = true;
			armDigestInterval();
		};

		window.addEventListener('academic-digest-job-started', handleDigestStarted);
		document.addEventListener('visibilitychange', handleVisibility);

		// Initial checks (pollDigestJob arms the digest interval if a job is already active).
		void checkActivity(signal);
		void pollDigestJob();
		armActivityInterval();

		const tick = setInterval(() => (now = new Date()), 60_000);
		return () => {
			activityController.abort();
			clearActivityInterval();
			clearDigestInterval();
			clearInterval(tick);
			window.removeEventListener('academic-digest-job-started', handleDigestStarted);
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});

	afterNavigate(() => {
		fabOpen = false;
	});

	const todayLabel = $derived(
		now.toLocaleString('en-US', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		})
	);

	const termContext = $derived(resolveTermContext(now, semesters));
	const currentTermLabel = $derived(
		termContext
			? `${termContext.relation === 'next' ? 'Next · ' : termContext.relation === 'latest' ? 'Latest · ' : ''}${termContext.semester.term} ${termContext.semester.year}`
			: 'No term'
	);
</script>

<svelte:document onclick={handleDocumentClick} onkeydown={handleDocumentKeydown} />

<div class="app-grid grid min-h-screen grid-cols-[var(--sidebar-width)_1fr] max-md:grid-cols-1">
	<DesktopSidebar
		pathname={$page.url.pathname}
		{routes}
		{isRouteActive}
		{runningCount}
		{unreadCount}
		{weeklyPlanPending}
		coursesCount={courses.length}
		{semesters}
		{courses}
		{countsById}
		onAddSemester={openAddSemester}
	/>

	<div class="app-content flex min-w-0 flex-col">
		<Topbar
			{currentTermLabel}
			{todayLabel}
			pathname={$page.url.pathname}
			{routes}
			{isRouteActive}
			bind:fabOpen
			{semesters}
			{courses}
			{countsById}
			onAddSemester={openAddSemester}
		/>

		<DigestBanner job={academicDigestJob} ondismiss={dismissAcademicDigestJob} />

		<main
			class="app-main relative min-w-0 flex-1 bg-[var(--paper)] p-0 data-[canvas=true]:flex data-[canvas=true]:flex-col [&>*]:mx-auto [&>*]:px-[var(--page-gutter)] [&>*]:max-w-[var(--page-width)] [&>*]:py-10 max-sm:[&>*]:px-5"
			data-canvas={$page.url.pathname === '/app/courses'}
		>
			{#if weeklyPlanPending}
				<section
					class="weekly-plan-loading grid min-h-[calc(100vh-var(--topbar-height,0px))] place-items-center py-16"
					role="status"
					aria-live="polite"
				>
					<div
						class="weekly-plan-loading-card grid w-[min(100%,34rem)] justify-items-center gap-[0.8rem] border border-dashed border-[var(--rule)] bg-[var(--paper)] px-8 py-12 text-center [&_.loading-dots]:mt-2"
					>
						<span
							class="weekly-plan-loading-kicker text-[var(--ink-faint)] text-[var(--text-caption)]"
							>The next seven days</span
						>
						<h1 class="m-0 text-[2rem] leading-[1.1] font-[var(--font-body)] text-[var(--ink)]">
							Building your weekly plan
						</h1>
						<p class="m-0 max-w-md leading-[1.55] text-[var(--ink-soft)] text-[var(--text-small)]">
							Collecting deadlines, study activity, practice sessions, and course materials.
						</p>
						<LoadingDots label="Loading weekly plan" />
					</div>
				</section>
			{:else}
				{@render children()}
			{/if}
		</main>
	</div>
</div>

<AddSemesterDialog
	bind:open={addSemesterOpen}
	bind:term={newTerm}
	bind:year={newYear}
	bind:error={semesterError}
	bind:saving={savingSemester}
	{termChoices}
	onsave={saveSemester}
/>
