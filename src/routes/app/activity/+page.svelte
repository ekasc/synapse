<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';

	type Job = {
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

	type ActivityResponse = { jobs?: Job[]; error?: string };

	let jobs = $state<Job[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadJobs() {
		const firstLoad = jobs.length === 0;
		if (firstLoad) loading = true;
		error = null;
		try {
			const res = await fetch('/api/briefing/activity');
			const data = (await res.json()) as ActivityResponse;
			jobs = data.jobs ?? [];
			localStorage.setItem('activity_last_read', Date.now().toString());
		} catch {
			error = 'Failed to load activity';
		} finally {
			if (firstLoad) loading = false;
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

	import { onMount } from 'svelte';
	onMount(() => {
		loadJobs();
		const id = setInterval(loadJobs, 5000);
		return () => {
			clearInterval(id);
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

<svelte:head><title>Synapse · Activity</title></svelte:head>

<CatalogHeader term="Activity" />

<div class="page page-enter">
	<div class="page-cover">
		<div class="page-cover-row">
			<div>
				<h1 class="page-title font-hand">Activity</h1>
				<p class="page-tagline">
					{jobs.length > 0
						? `${jobs.filter((j) => j.status === 'running').length} running · ${jobs.filter((j) => j.status === 'queued').length} queued · ${jobs.filter((j) => j.status === 'succeeded').length} succeeded`
						: 'All AI tasks across the app'}
				</p>
			</div>
			<button class="btn btn-sm btn-ghost font-mono" onclick={loadJobs} disabled={loading}>
				{loading ? 'refreshing...' : 'refresh'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="error-banner font-mono" role="alert">{error}</div>
	{/if}

	{#if loading && jobs.length === 0}
		<div class="loading-state font-mono" role="status" aria-live="polite">Loading activity...</div>
	{:else if jobs.length === 0}
		<div class="empty-state surface-polaroid">
			<h2 class="empty-head font-hand">No activity yet</h2>
			<p class="empty-text">AI tasks like course briefings and digests will appear here.</p>
		</div>
	{:else}
		<div class="activity-list">
			{#each jobs as job (job.id)}
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
									<span class="activity-time font-mono">started {timeSince(job.startedAt)}</span>
								{/if}
								{#if job.completedAt}
									<span class="activity-time font-mono">done {timeSince(job.completedAt)}</span>
								{/if}
							</div>
							{#if job.errorMessage}
								<div class="activity-error font-mono">{job.errorMessage}</div>
							{/if}
						</div>
					</div>
					<div class="activity-right">
						{#if job.status === 'queued' || job.status === 'running'}
							<button class="btn btn-sm btn-danger font-mono" onclick={() => cancelJob(job.id)}
								>cancel</button
							>
						{/if}
					</div>
				</div>
			{/each}
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
	.error-banner {
		padding: 0.5rem 0.75rem;
		margin-bottom: 1rem;
		border: 1px solid var(--accent);
		background: rgba(176, 58, 46, 0.05);
		color: var(--accent);
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
		animation: act-pulse 1.2s ease-in-out infinite;
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
		color: var(--accent);
		margin-top: 0.25rem;
	}
	.activity-right {
		flex-shrink: 0;
	}
</style>
