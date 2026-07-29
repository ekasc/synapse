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
		publishing: 'Publishing the validated brief…',
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
		if (timedOut) return 'The brief is taking longer than expected.';
		if (job.errorMessage) return job.errorMessage;
		switch (job.status) {
			case 'failed':
				return 'The brief failed.';
			case 'conflict':
				return 'Official course evidence conflicts. Try a different code or professor.';
			case 'expired':
				return 'The brief expired. Try again.';
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

<div class="grid gap-2 pt-1" role="status" aria-live="polite" aria-label="Briefing job status">
	<div class="flex items-center gap-0 pt-1 pb-2" aria-hidden="true">
		{#each STAGES as _, i (i)}
			<span
				class={[
					'dot size-2 flex-[0_0_8px] rounded-full bg-[var(--rule)] transition-[background] duration-200 ease-[var(--ease-out-quart)]',
					i <= stageIndex && 'bg-[var(--ink)]',
					i === stageIndex && 'active'
				]}
			></span>
			{#if i < STAGES.length - 1}<span
					class={[
						'mx-[0.35rem] h-px min-w-3 flex-auto bg-[var(--rule)]',
						i < stageIndex && 'bg-[var(--ink)]'
					]}
				></span>{/if}
		{/each}
	</div>
	<div class="flex flex-wrap items-baseline justify-between gap-3">
		<span
			class="font-[family-name:var(--font-body)] leading-[1.4] text-[var(--ink-soft)] text-[var(--text-small)]"
			>{displayStage}</span
		>
		{#if isActive && job.stageUpdatedAt}
			<span class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]"
				>updated {formatDate(job.stageUpdatedAt)}</span
			>
		{/if}
	</div>
	{#if job.cacheHit}
		<p class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">
			Loaded from the saved research cache.
		</p>
	{/if}
	{#if isActive}
		<div class="mt-1 flex gap-2">
			<button class="btn btn-sm btn-ghost" type="button" onclick={onCancel}>stop</button>
		</div>
	{:else if isTerminal}
		<p class="mt-1 mb-0 leading-[1.4] text-[var(--pen-red)] text-[var(--text-small)]">
			{errorText}
		</p>
		<div class="mt-1 flex gap-2">
			<button class="btn btn-sm" type="button" onclick={onRetry}>retry</button>
		</div>
	{/if}
	{#if job.telemetry && (job.telemetry.searches != null || job.telemetry.cost != null)}
		<p class="mt-1 mb-0 text-[var(--ink-faint)] text-[var(--text-caption)]">
			{job.telemetry.searches ?? 0} searches{#if job.telemetry.cost != null}
				· cost {job.telemetry.cost}{/if}{#if job.telemetry.modelPolicy}
				· {job.telemetry.modelPolicy}{/if}
		</p>
	{/if}
</div>

<style>
	.dot.active {
		animation: pulse 1.2s var(--ease-out-quart) infinite;
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
