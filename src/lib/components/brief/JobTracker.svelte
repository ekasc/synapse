<script lang="ts">
	type JobStatus =
		| 'queued'
		| 'running'
		| 'conflict'
		| 'succeeded'
		| 'failed'
		| 'canceled'
		| 'expired';

	type Job = {
		status: JobStatus;
		stage?: string | null;
		stageUpdatedAt?: string | null;
		errorMessage?: string | null;
		telemetry?: { searches?: number; cost?: number | string; modelPolicy?: string };
		cacheHit?: boolean;
	};

	let {
		job,
		courseCode,
		timedOut = false,
		onCancel,
		onRetry
	}: {
		job: Job;
		courseCode: string;
		timedOut?: boolean;
		onCancel: () => void;
		onRetry: () => void;
	} = $props();

	const STAGE_LABELS: Record<string, string> = {
		resolving_identity: 'Resolving official course identity…',
		searching_catalog: 'Checking official catalog evidence…',
		searching_schedule: 'Checking current schedule evidence…',
		searching_outline: 'Checking course outlines and prerequisites…',
		searching_instructor: 'Checking instructor assignment evidence…',
		searching_reputation: 'Checking student-reported professor evidence…',
		ranking_evidence: 'Ranking and deduplicating evidence…',
		synthesizing: 'Synthesizing the validated evidence…',
		validating: 'Validating every claim and citation…',
		publishing: 'Publishing the validated briefing…',
		resolving_course: 'Resolving course and institution…',
		searching_official: 'Searching official course records…',
		verifying_instructor: 'Verifying instructor evidence…',
		researching_assessments: 'Researching assessments and workload…',
		reconciling_evidence: 'Reconciling sources and contradictions…',
		writing_brief: 'Writing the evidence-backed brief…'
	};

	const STAGES = [
		'resolving_identity',
		'searching_catalog',
		'searching_schedule',
		'searching_outline',
		'searching_instructor',
		'searching_reputation',
		'synthesizing',
		'publishing'
	] as const;

	function stageLabel(stage: string | null | undefined): string {
		if (!stage) return '';
		return STAGE_LABELS[stage] ?? stage.replaceAll('_', ' ');
	}

	const stageIndex = $derived.by(() => {
		if (!job.stage) return -1;
		const i = STAGES.indexOf(job.stage as (typeof STAGES)[number]);
		if (i >= 0) return i;
		const keys = Object.keys(STAGE_LABELS);
		const ki = keys.indexOf(job.stage);
		return ki >= 0 ? Math.min(ki, STAGES.length - 1) : 0;
	});

	const displayStage = $derived(
		job.stage
			? stageLabel(job.stage)
			: job.status === 'queued'
				? 'Queued — waiting for worker…'
				: 'Researching course…'
	);

	const isActive = $derived(job.status === 'running' || job.status === 'queued');
	const isTerminal = $derived(
		job.status === 'failed' ||
			job.status === 'conflict' ||
			job.status === 'expired' ||
			job.status === 'canceled' ||
			timedOut
	);

	const errorText = $derived.by(() => {
		if (timedOut) return 'Briefing is taking longer than expected.';
		if (job.errorMessage) return job.errorMessage;
		switch (job.status) {
			case 'failed':
				return 'Briefing failed.';
			case 'conflict':
				return 'Official course evidence conflicts. Try a different code or professor.';
			case 'expired':
				return 'Briefing expired. Try again.';
			case 'canceled':
				return 'Research canceled. You can retry when ready.';
			default:
				return '';
		}
	});

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="tracker" role="status" aria-live="polite" aria-label="Briefing job status">
	<div class="dots" aria-hidden="true">
		{#each STAGES as _, i (i)}
			<span class="dot" class:filled={i <= stageIndex} class:active={i === stageIndex}></span>
			{#if i < STAGES.length - 1}<span class="connector" class:connector-done={i < stageIndex}></span>{/if}
		{/each}
	</div>
	<div class="line">
		<span class="stage-text">{displayStage}</span>
		{#if isActive && job.stageUpdatedAt}
			<span class="updated font-mono">updated {formatDate(job.stageUpdatedAt)}</span>
		{/if}
	</div>
	{#if job.cacheHit}
		<p class="cache-note">Loaded from the saved research cache.</p>
	{/if}
	{#if isActive}
		<div class="actions">
			<button class="btn btn-sm btn-ghost font-mono" type="button" onclick={onCancel}>stop</button>
		</div>
	{:else if isTerminal}
		<p class="error font-mono">{errorText}</p>
		<div class="actions">
			<button class="btn btn-sm font-mono" type="button" onclick={onRetry}>retry</button>
		</div>
	{/if}
	{#if job.telemetry && (job.telemetry.searches != null || job.telemetry.cost != null)}
		<p class="telemetry font-mono">
			{job.telemetry.searches ?? 0} searches{#if job.telemetry.cost != null}
				· cost {job.telemetry.cost}{/if}{#if job.telemetry.modelPolicy}
				· {job.telemetry.modelPolicy}{/if}
		</p>
	{/if}
</div>

<style>
	.tracker {
		display: grid;
		gap: 0.5rem;
		padding: 0.25rem 0 0;
	}

	.dots {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 0.25rem 0 0.5rem;
	}

	.dot {
		flex: 0 0 8px;
		width: 8px;
		height: 8px;
		background: var(--rule);
		border-radius: 50%;
		transition: background 0.2s var(--ease-out-quart);
	}

	.dot.filled {
		background: var(--ink);
	}

	.dot.active {
		animation: pulse 1.2s var(--ease-out-quart) infinite;
	}

	.connector {
		flex: 1 1 auto;
		height: 1px;
		background: var(--rule);
		margin: 0 0.35rem;
		min-width: 0.75rem;
	}

	.connector.connector-done {
		background: var(--ink);
	}

	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.stage-text {
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink-soft);
		line-height: 1.4;
	}

	.updated {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.cache-note {
		margin: 0;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.error {
		font-size: 0.95rem;
		color: var(--pen-red);
		margin: 0.25rem 0 0;
		line-height: 1.4;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.telemetry {
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin: 0.25rem 0 0;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dot.active {
			animation: none;
		}
	}
</style>
