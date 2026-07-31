<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';
	import { AlertDialog } from '$lib/components/ui';
	import { RefreshCw, Trash2, X } from '@lucide/svelte';

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
		courseId: string;
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
	let deleteTarget = $state<{ kind: 'briefing' | 'syllabus'; id: string; label: string } | null>(
		null
	);
	let deleting = $state(false);

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

	async function deleteActivity() {
		if (!deleteTarget) return;
		deleting = true;
		error = null;
		try {
			const response =
				deleteTarget.kind === 'briefing'
					? await fetch('/api/briefing/activity', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ action: 'delete', jobId: deleteTarget.id })
						})
					: await fetch(`/api/syllabus/activity?courseId=${encodeURIComponent(deleteTarget.id)}`, {
							method: 'DELETE'
						});
			if (!response.ok) throw new Error('Delete failed');
			deleteTarget = null;
			await Promise.all([loadJobs(), loadSyllabusActivity(), invalidateAll()]);
		} catch {
			error = 'Could not delete this activity item.';
		} finally {
			deleting = false;
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

<div class="page-enter mx-auto max-w-[var(--page-width-detail)] pt-8 pb-16">
	<div class="page-cover">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="page-title !mt-1 !mb-0">Activity</h1>
				<p class="page-tagline !mt-2 text-[var(--text-small)]">
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
				class="btn btn-sm btn-ghost"
				onclick={() => {
					loadJobs();
					loadSyllabusActivity();
				}}
				disabled={loading}
				aria-label="Refresh activity"
				title="Refresh activity"
			>
				<RefreshCw
					class={loading ? 'size-[var(--icon-sm)] animate-spin' : 'size-[var(--icon-sm)]'}
					aria-hidden="true"
				/>
			</button>
		</div>
	</div>

	{#if error}
		<div
			class="mb-4 border border-[var(--pen-red)] bg-[rgba(194,54,42,0.05)] px-3 py-2 text-[var(--pen-red)] text-[var(--text-caption)]"
			role="alert"
		>
			{error}
		</div>
	{/if}

	{#if loading && briefingJobs.length === 0 && syllabusExtractions.length === 0}
		<div class="p-8 text-center text-[var(--ink-faint)] text-[var(--text-caption)]">
			<LoadingDots label="Loading activity" />
		</div>
	{:else if briefingJobs.length === 0 && syllabusExtractions.length === 0}
		<div
			class="border border-[var(--border-faint)] bg-[var(--surface-paper)] px-8 py-12 text-center"
		>
			<h2 class="font-hand m-0 mb-2 text-2xl leading-none text-[var(--ink)]">No activity yet</h2>
			<p class="m-0 text-[var(--ink-soft)] text-[var(--text-small)]">
				AI tasks like course briefs and digests will appear here.
			</p>
			{#if syllabusError}
				<p class="mt-3 mb-0 text-[var(--pen-red)] text-[var(--text-caption)]" role="alert">
					Syllabus activity could not be loaded right now.
				</p>
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-6">
			{#if briefingJobs.length > 0}
				<div>
					<div class="mb-2 text-[var(--ink-faint)] text-[var(--text-caption)]">
						Course brief jobs
					</div>
					<div class="flex flex-col gap-0 border border-[var(--rule)] bg-[var(--paper)]">
						{#each briefingJobs as job (job.id)}
							<div
								class="flex items-start justify-between gap-3 border-b border-[var(--rule)] px-4 py-3 last:border-b-0"
							>
								<div class="flex min-w-0 flex-1 items-start gap-[0.65rem]">
									<span
										class="mt-0.5 grid size-5 shrink-0 place-items-center text-[var(--text-caption)]"
										aria-hidden="true"
									>
										{#if job.status === 'queued'}
											<span class="text-[var(--ink-faint)]">&#9678;</span>
										{:else if job.status === 'running'}
											<span
												class="[animation:act-pulse_1.2s_var(--ease-out-quart)_infinite] text-[var(--warn)]"
												>&#9679;</span
											>
										{:else if job.status === 'succeeded'}
											<span>&#10003;</span>
										{:else if job.status === 'failed' || job.status === 'expired'}
											<span class="text-[var(--accent)]">&#10007;</span>
										{:else}
											<span class="text-[var(--ink-faint)]">&#8212;</span>
										{/if}
									</span>
									<div class="min-w-0 flex-1">
										<div class="mb-px flex items-center gap-2">
											<span class=" font-medium text-[var(--ink)] text-[var(--text-caption)]"
												>{job.courseCode}</span
											>
											<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
												>{job.status}</span
											>
										</div>
										<div class="flex flex-wrap gap-2">
											<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
												>{timeSince(job.createdAt)}</span
											>
											{#if job.startedAt}
												<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
													>started {timeSince(job.startedAt)}</span
												>
											{/if}
											{#if job.completedAt}
												<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
													>done {timeSince(job.completedAt)}</span
												>
											{/if}
										</div>
										{#if job.errorMessage}
											<div class="mt-1 text-[var(--pen-red)] text-[var(--text-caption)]">
												{job.errorMessage}
											</div>
										{/if}
									</div>
								</div>
								<div class="flex shrink-0 gap-2">
									{#if job.status === 'queued' || job.status === 'running'}
										<button
											class="btn btn-sm btn-danger size-9 p-0"
											aria-label={`Cancel ${job.courseCode} brief job`}
											title="Cancel"
											onclick={() => cancelJob(job.id)}
										>
											<X class="size-[var(--icon-sm)]" aria-hidden="true" />
										</button>
									{/if}
									<button
										class="btn btn-ghost btn-sm size-9 p-0 text-[var(--pen-red)]"
										aria-label={`Remove ${job.courseCode} brief job`}
										title="Remove"
										onclick={() =>
											(deleteTarget = {
												kind: 'briefing',
												id: job.id,
												label: `${job.courseCode} brief job`
											})}
									>
										<Trash2 class="size-[var(--icon-sm)]" aria-hidden="true" />
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if syllabusExtractions.length > 0}
				<div>
					<div class="mb-2 text-[var(--ink-faint)] text-[var(--text-caption)]">Syllabus jobs</div>
					<div class="flex flex-col gap-0 border border-[var(--rule)] bg-[var(--paper)]">
						{#each syllabusExtractions as ext (ext.id)}
							<div
								class="flex items-start justify-between gap-3 border-b border-[var(--rule)] px-4 py-3 last:border-b-0"
							>
								<div class="flex min-w-0 flex-1 items-start gap-[0.65rem]">
									<span
										class="mt-0.5 grid size-5 shrink-0 place-items-center text-[var(--text-caption)]"
										aria-hidden="true"
									>
										{#if ext.status === 'processing'}
											<span
												class="[animation:act-pulse_1.2s_var(--ease-out-quart)_infinite] text-[var(--warn)]"
												>&#9679;</span
											>
										{:else if ext.status === 'completed'}
											<span>&#10003;</span>
										{:else}
											<span class="text-[var(--accent)]">&#10007;</span>
										{/if}
									</span>
									<div class="min-w-0 flex-1">
										<div class="mb-px flex items-center gap-2">
											<span class=" font-medium text-[var(--ink)] text-[var(--text-caption)]"
												>{ext.courseCode}</span
											>
											<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
												>{ext.status}</span
											>
										</div>
										<div class="flex flex-wrap gap-2">
											<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
												>{timeSince(ext.createdAt)}</span
											>
											{#if ext.completedAt}
												<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
													>done {timeSince(ext.completedAt)}</span
												>
											{/if}
										</div>
										{#if ext.status === 'completed'}
											<div class="mt-1">
												<a
													href={resolveRoute(
														`/app/syllabus/result/${encodeURIComponent(ext.courseCode)}`
													)}
													class=" text-[var(--ink)] text-[var(--text-caption)] underline underline-offset-2"
												>
													view results
												</a>
											</div>
										{/if}
									</div>
								</div>
								<button
									class="btn btn-ghost btn-sm size-9 shrink-0 p-0 text-[var(--pen-red)]"
									aria-label={`Remove ${ext.courseCode} syllabus import`}
									title="Remove"
									onclick={() =>
										(deleteTarget = {
											kind: 'syllabus',
											id: ext.courseId,
											label: `${ext.courseCode} syllabus import`
										})}
								>
									<Trash2 class="size-[var(--icon-sm)]" aria-hidden="true" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<AlertDialog
	open={deleteTarget !== null}
	title="Delete activity item?"
	description={deleteTarget
		? `Delete ${deleteTarget.label}? This cannot be undone.`
		: 'This cannot be undone.'}
	confirmLabel="Remove"
	busy={deleting}
	onConfirm={deleteActivity}
	onCancel={() => (deleteTarget = null)}
/>

<style>
	@keyframes act-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
</style>
