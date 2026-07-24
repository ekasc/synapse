<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';

	type BriefingJob = {
		id: string;
		courseCode: string;
		status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'expired';
		frozenContext: string;
		errorCode: string | null;
		errorMessage: string | null;
		createdAt: string;
		startedAt: string | null;
		completedAt: string | null;
	};

	type SyllabusExtraction = {
		id: string;
		courseCode: string;
		status: 'processing' | 'completed' | 'failed';
		fileName: string;
		createdAt: string;
		completedAt: string | null;
	};

	type ActivityResponse = { jobs?: BriefingJob[]; error?: string };
	type SyllabusActivityResponse = { extractions?: SyllabusExtraction[]; error?: string };

	let briefingJobs = $state<BriefingJob[]>([]);
	let syllabusExtractions = $state<SyllabusExtraction[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let syllabusError = $state(false);
	let jobsFetchInFlight = false;
	let syllabusFetchInFlight = false;
	let pollInterval: number | null = null;

	const hasActiveWork = $derived(
		briefingJobs.some((job) => job.status === 'queued' || job.status === 'running') ||
			syllabusExtractions.some((extraction) => extraction.status === 'processing')
	);

	async function loadJobs() {
		if (jobsFetchInFlight) return;
		jobsFetchInFlight = true;
		const firstLoad = briefingJobs.length === 0 && syllabusExtractions.length === 0;
		if (firstLoad) loading = true;
		error = null;

		try {
			const res = await fetch('/api/briefing/activity');
			const data = (await res.json()) as ActivityResponse;
			briefingJobs = data.jobs ?? [];
			localStorage.setItem('activity_last_read', Date.now().toString());
		} catch {
			error = 'Failed to load activity';
		} finally {
			jobsFetchInFlight = false;
			if (firstLoad) loading = false;
		}
	}

	async function loadSyllabusActivity() {
		if (syllabusFetchInFlight) return;
		syllabusFetchInFlight = true;
		// Gracefully handle if the endpoint doesn't exist yet (Demi's scope)
		try {
			const res = await fetch('/api/syllabus/activity');
			if (!res.ok) {
				if (res.status === 404) {
					syllabusError = false;
					syllabusExtractions = [];
					return;
				}
				throw new Error('Not OK');
			}
			const data = (await res.json()) as SyllabusActivityResponse;
			syllabusExtractions = data.extractions ?? [];
			syllabusError = false;
		} catch {
			syllabusError = true;
			syllabusExtractions = [];
		} finally {
			syllabusFetchInFlight = false;
		}
	}

	async function cancelJob(id: string) {
		try {
			await fetch('/api/briefing/activity', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'cancel', jobId: id })
			});
			await loadJobs();
			await invalidateAll();
		} catch {
			error = 'Failed to cancel job';
		}
	}

	function startPolling() {
		if (pollInterval !== null) return;
		pollInterval = window.setInterval(() => {
			void loadJobs();
			void loadSyllabusActivity();
		}, 30000);
	}

	function stopPolling() {
		if (pollInterval === null) return;
		window.clearInterval(pollInterval);
		pollInterval = null;
	}

	// Poll only while at least one job is non-terminal, and only while visible.
	$effect(() => {
		if (hasActiveWork && !document.hidden) startPolling();
		else stopPolling();
	});

	import { onMount } from 'svelte';
	onMount(() => {
		void loadJobs();
		void loadSyllabusActivity();
		const onVisibilityChange = () => {
			if (document.hidden) {
				stopPolling();
			} else {
				// Catch up on whatever finished while the tab was hidden.
				void loadJobs();
				void loadSyllabusActivity();
				if (hasActiveWork) startPolling();
			}
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			stopPolling();
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	function timeSince(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}
</script>

<svelte:head><title>Activity · Synapse</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<h1 class="page-title">Activity</h1>
				<p class="page-tagline">
					{(() => {
						const briefRunning = briefingJobs.filter((j) => j.status === 'running').length;
						const briefQueued = briefingJobs.filter((j) => j.status === 'queued').length;
						const briefDone = briefingJobs.filter((j) => j.status === 'succeeded').length;
						const syllabusRunning = syllabusExtractions.filter(
							(e) => e.status === 'processing'
						).length;
						const syllabusDone = syllabusExtractions.filter((e) => e.status === 'completed').length;
						const parts: string[] = [];
						if (briefRunning || syllabusRunning) {
							const total = briefRunning + syllabusRunning;
							parts.push(`${total} running`);
						}
						if (briefQueued) parts.push(`${briefQueued} queued`);
						if (briefDone || syllabusDone) parts.push(`${briefDone + syllabusDone} succeeded`);
						return parts.length > 0 ? parts.join(' · ') : 'All AI tasks across the app';
					})()}
				</p>
			</div>
			<button
				class="btn btn-sm btn-ghost font-mono"
				onclick={() => {
					loadJobs();
					loadSyllabusActivity();
				}}
				disabled={loading}
			>
				{loading ? 'refreshing...' : 'refresh'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="error-banner font-mono" role="alert">{error}</div>
	{/if}

	{#if loading && briefingJobs.length === 0 && syllabusExtractions.length === 0}
		<div class="loading-state">
			<LoadingDots label="Loading activity" />
		</div>
	{:else if briefingJobs.length === 0 && syllabusExtractions.length === 0}
		<div class="empty-state surface-polaroid">
			<h2 class="empty-head font-hand">No activity yet</h2>
			<p class="empty-text">AI tasks like course briefs and digests will appear here.</p>
			{#if syllabusError}
				<p class="empty-error font-mono" role="alert">
					Syllabus activity could not be loaded right now.
				</p>
			{/if}
		</div>
	{:else}
		<div class="activity-sections">
			{#if briefingJobs.length > 0}
				<div class="activity-section">
					<div class="activity-section-head font-mono">Course brief jobs</div>
					<div class="activity-list">
						{#each briefingJobs as job (job.id)}
							<div class="activity-item">
								<div class="activity-left">
									<span class="activity-status-dot" aria-hidden="true">
										{#if job.status === 'queued'}
											<span class="status-dot-queued">&#9678;</span>
										{:else if job.status === 'running'}
											<span class="status-dot-running animate-pulse">&#9679;</span>
										{:else if job.status === 'succeeded'}
											<span>&#10003;</span>
										{:else if job.status === 'failed' || job.status === 'expired'}
											<span class="status-dot-crit">&#10007;</span>
										{:else}
											<span class="status-dot-idle">&#8212;</span>
										{/if}
									</span>
									<div class="activity-body">
										<div class="activity-head">
											<span class="activity-course font-mono">{job.courseCode}</span>
											<span class="activity-status font-mono">{job.status}</span>
										</div>
										<div class="activity-meta">
											<span class="activity-time font-mono">{timeSince(job.createdAt)}</span>
											{#if job.startedAt}
												<span class="activity-time font-mono"
													>started {timeSince(job.startedAt)}</span
												>
											{/if}
											{#if job.completedAt}
												<span class="activity-time font-mono"
													>done {timeSince(job.completedAt)}</span
												>
											{/if}
										</div>
										{#if job.errorMessage}
											<div class="activity-error font-mono">{job.errorMessage}</div>
										{/if}
									</div>
								</div>
								<div class="activity-right">
									{#if job.status === 'queued' || job.status === 'running'}
										<button
											class="btn btn-sm btn-danger font-mono"
											onclick={() => cancelJob(job.id)}>cancel</button
										>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if syllabusExtractions.length > 0}
				<div class="activity-section">
					<div class="activity-section-head font-mono">Syllabus jobs</div>
					<div class="activity-list">
						{#each syllabusExtractions as ext (ext.id)}
							<div class="activity-item">
								<div class="activity-left">
									<span class="activity-status-dot" aria-hidden="true">
										{#if ext.status === 'processing'}
											<span class="status-dot-running animate-pulse">&#9679;</span>
										{:else if ext.status === 'completed'}
											<span>&#10003;</span>
										{:else}
											<span class="status-dot-crit">&#10007;</span>
										{/if}
									</span>
									<div class="activity-body">
										<div class="activity-head">
											<span class="activity-course font-mono">{ext.courseCode}</span>
											<span class="activity-status font-mono">{ext.status}</span>
										</div>
										<div class="activity-meta">
											<span class="activity-time font-mono">{timeSince(ext.createdAt)}</span>
											{#if ext.completedAt}
												<span class="activity-time font-mono"
													>done {timeSince(ext.completedAt)}</span
												>
											{/if}
										</div>
										{#if ext.status === 'completed'}
											<div class="activity-link">
												<a
													href={`/app/syllabus/result/${encodeURIComponent(ext.courseCode)}`}
													class="activity-result-link font-mono"
												>
													view results
												</a>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}
	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0;
		line-height: 1;
	}
	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.5rem 0 0;
	}
	.page-cover-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}
	.error-banner {
		padding: 0.5rem 0.75rem;
		margin-bottom: 1rem;
		border: 1px solid var(--pen-red);
		background: rgba(194, 54, 42, 0.05);
		color: var(--pen-red);
		font-size: 0.8rem;
	}
	.loading-state {
		padding: 2rem;
		text-align: center;
		color: var(--ink-faint);
		font-size: 0.85rem;
	}
	.empty-state {
		padding: 3rem 2rem;
		text-align: center;
	}
	.empty-head {
		font-size: 1.5rem;
		color: var(--ink);
		margin: 0 0 0.5rem;
		line-height: 1;
	}
	.empty-text {
		font-size: 0.9rem;
		color: var(--ink-soft);
		margin: 0;
	}
	.empty-error {
		margin: 0.75rem 0 0;
		color: var(--pen-red);
		font-size: 0.72rem;
	}
	.activity-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.activity-section-head {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		margin-bottom: 0.5rem;
	}
	.activity-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.activity-item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--rule);
	}
	.activity-item:last-child {
		border-bottom: none;
	}
	.activity-left {
		display: flex;
		gap: 0.65rem;
		flex: 1;
		min-width: 0;
		align-items: flex-start;
	}
	.activity-status-dot {
		width: 1.25rem;
		height: 1.25rem;
		display: grid;
		place-items: center;
		flex-shrink: 0;
		margin-top: 2px;
		font-size: 0.8rem;
	}
	.status-dot-queued {
		color: var(--ink-faint);
	}
	.status-dot-running {
		color: var(--warn);
	}
	.animate-pulse {
		animation: act-pulse 1.2s var(--ease-out-quart) infinite;
	}
	@keyframes act-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
	.status-dot-crit {
		color: var(--accent);
	}
	.status-dot-idle {
		color: var(--ink-faint);
	}
	.activity-body {
		flex: 1;
		min-width: 0;
	}
	.activity-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1px;
	}
	.activity-course {
		font-size: 0.82rem;
		color: var(--ink);
		font-weight: 500;
	}
	.activity-status {
		font-size: 0.62rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.activity-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.activity-time {
		font-size: 0.65rem;
		color: var(--ink-faint);
	}
	.activity-error {
		font-size: 0.72rem;
		color: var(--pen-red);
		margin-top: 0.25rem;
	}
	.activity-link {
		margin-top: 0.25rem;
	}
	.activity-result-link {
		font-size: 0.72rem;
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.activity-right {
		flex-shrink: 0;
	}
</style>
