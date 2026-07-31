<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { resolveRoute } from '$app/paths';
	import JobTracker from './JobTracker.svelte';

	type JobStatus =
		| 'queued'
		| 'running'
		| 'conflict'
		| 'succeeded'
		| 'failed'
		| 'canceled'
		| 'expired';

	type Job = {
		id: string;
		status: JobStatus;
		output: string | null;
		errorMessage: string | null;
		stage?: string | null;
		stageUpdatedAt?: string | null;
		telemetry?: { searches?: number; cost?: number | string; modelPolicy?: string };
		cacheHit?: boolean;
	};

	type JobResponse = {
		job?: Job | null;
		output?: unknown;
		error?: string;
	};

	const POLL_INTERVAL_MS = 5000;
	const POLL_TIMEOUT_MS = 4 * 60 * 1000;
	const MAX_POLL_COUNT = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

	let {
		onSuccess,
		initialCode = '',
		initialName = '',
		initialProfessor = '',
		initialInstitution = '',
		autoStart = false
	}: {
		onSuccess?: (code: string) => void;
		initialCode?: string;
		initialName?: string;
		initialProfessor?: string;
		initialInstitution?: string;
		autoStart?: boolean;
	} = $props();

	let courseCode = $state(untrack(() => initialCode));
	let courseName = $state(untrack(() => initialName));
	let professorName = $state(untrack(() => initialProfessor));
	let institution = $state(untrack(() => initialInstitution));
	let additionalNotes = $state('');
	let moreOptionsOpen = $state(false);
	let hasAutoStarted = $state(false);

	let researchError = $state<string | null>(null);
	let activeJobId = $state<string | null>(null);
	let job = $state<Job | null>(null);
	let timedOut = $state(false);
	let pollTimer = $state<ReturnType<typeof setInterval> | undefined>();
	let pollCount = $state(0);
	let succeededCode = $state<string | null>(null);
	let submitAttempted = $state(false);

	$effect(() => {
		if (autoStart && !hasAutoStarted && courseCode.trim().length > 0) {
			hasAutoStarted = true;
			untrack(() => submit());
		}
	});

	let today = $derived.by(() => {
		const d = new Date();
		return d
			.toLocaleString('en-US', {
				month: 'short',
				day: '2-digit',
				year: 'numeric'
			})
			.toUpperCase();
	});

	let canSubmit = $derived(courseCode.trim().length > 0 && activeJobId === null);

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
	}

	function startPolling(jobId: string) {
		stopPolling();
		pollCount = 0;
		timedOut = false;
		pollTimer = setInterval(async () => {
			pollCount++;
			if (pollCount > MAX_POLL_COUNT) {
				stopPolling();
				timedOut = true;
				return;
			}
			try {
				const res = await fetch(`/api/briefing/jobs/${jobId}`);
				const data = (await res.json()) as JobResponse;
				if (data.job) job = data.job;
				if (data.job?.status === 'succeeded') {
					stopPolling();
					let completedCode: string | undefined;
					try {
						const out = data.job.output
							? (JSON.parse(data.job.output) as {
									courseCode?: string;
									code?: string;
									identity?: { code?: string };
								})
							: null;
						completedCode = out?.courseCode ?? out?.code ?? out?.identity?.code;
					} catch {
						completedCode = undefined;
					}
					if (completedCode) {
						succeededCode = completedCode;
						setTimeout(() => {
							succeededCode = null;
							activeJobId = null;
							job = null;
							courseCode = '';
							courseName = '';
							professorName = '';
							institution = '';
							additionalNotes = '';
							moreOptionsOpen = false;
							onSuccess?.(completedCode!);
						}, 4000);
					} else {
						activeJobId = null;
					}
				} else if (
					data.job?.status === 'failed' ||
					data.job?.status === 'conflict' ||
					data.job?.status === 'expired' ||
					data.job?.status === 'canceled'
				) {
					stopPolling();
					if (data.job.status === 'canceled') {
						activeJobId = null;
						job = null;
					}
				}
			} catch {
				// keep polling; timeout will surface
			}
		}, POLL_INTERVAL_MS);
	}

	async function submit() {
		submitAttempted = true;
		if (!courseCode.trim()) {
			researchError = 'Enter a course code to research.';
			return;
		}
		researchError = null;
		job = null;
		succeededCode = null;
		timedOut = false;
		try {
			const res = await fetch('/api/briefing/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					courseCode: courseCode.trim(),
					courseName: courseName.trim() || undefined,
					professorName: professorName.trim() || undefined,
					institution: institution.trim() || undefined,
					additionalNotes: additionalNotes.trim() || undefined
				})
			});
			const data = (await res.json()) as JobResponse;
			if (!res.ok) {
				researchError = data.error ?? `Server error (${res.status})`;
				return;
			}
			if (!data.job) {
				researchError = 'No job returned';
				return;
			}
			job = data.job;
			activeJobId = data.job.id;
			if (data.job.status === 'succeeded') {
				let completedCode: string | undefined;
				try {
					const out = data.job.output
						? (JSON.parse(data.job.output) as {
								courseCode?: string;
								code?: string;
								identity?: { code?: string };
							})
						: null;
					completedCode = out?.courseCode ?? out?.code ?? out?.identity?.code;
				} catch {
					completedCode = undefined;
				}
				if (completedCode) {
					succeededCode = completedCode;
					setTimeout(() => onSuccess?.(completedCode!), 2000);
				}
				return;
			}
			if (
				data.job.status === 'failed' ||
				data.job.status === 'conflict' ||
				data.job.status === 'expired'
			) {
				return;
			}
			startPolling(data.job.id);
		} catch {
			researchError = 'Failed to research course. Is the server running?';
		}
	}

	async function cancelJob() {
		if (!activeJobId) return;
		try {
			await fetch(`/api/briefing/jobs/${activeJobId}`, { method: 'DELETE' });
		} catch {
			/* ignore */
		}
		stopPolling();
		job = {
			...(job as Job),
			status: 'canceled',
			errorMessage: 'Research canceled. You can retry when ready.'
		};
		activeJobId = null;
	}

	function retry() {
		researchError = null;
		job = null;
		activeJobId = null;
		timedOut = false;
		stopPolling();
		submit();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}

	onDestroy(stopPolling);
</script>

<div
	class="border border-[var(--rule)] bg-[var(--paper-shelf)] px-6 pt-4 pb-5 max-[700px]:px-4 max-[700px]:pt-3 max-[700px]:pb-4"
>
	<div class="flex items-center justify-between gap-2">
		<span
			class="border border-[var(--rule)] px-[0.4rem] py-[0.1rem] leading-[1.2] text-[var(--ink-faint)] text-[var(--text-caption)]"
			>research request</span
		>
		<span class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]">{today}</span
		>
	</div>
	<div class="mt-[0.6rem] mb-3 h-px bg-[var(--rule-soft)]"></div>

	{#if succeededCode}
		<div
			class="flex items-center gap-[0.6rem] py-[0.4rem] font-[family-name:var(--font-body)] text-[var(--ink)] text-[var(--text-small)]"
		>
			<span class=" text-base text-[var(--ok)]" aria-hidden="true">✓</span>
			<span
				class="[&_a]:ml-[0.4rem] [&_a]:text-[var(--ink)] [&_a]:decoration-[var(--rule)] [&_a:hover]:decoration-[var(--ink)]"
			>
				<strong>{succeededCode}</strong> ready —
				<a
					href={resolveRoute(`/app/brief/${encodeURIComponent(succeededCode)}`)}
					onclick={() => onSuccess?.(succeededCode!)}>view brief →</a
				>
			</span>
		</div>
	{:else if job && (job.status === 'running' || job.status === 'queued' || job.status === 'failed' || job.status === 'conflict' || job.status === 'expired' || job.status === 'canceled' || timedOut)}
		<div class="grid gap-[0.6rem]">
			<div class="mb-2 flex items-center justify-between">
				<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]"
					>researching · {courseCode.trim().toUpperCase()}</span
				>
			</div>
			<JobTracker {job} {timedOut} onCancel={cancelJob} onRetry={retry} />
		</div>
	{:else}
		<div class="grid gap-[0.6rem]">
			<div class="flex items-stretch gap-2 max-[700px]:flex-col">
				<label class="sr-only" for="brief-course-code">Course code</label>
				<input
					id="brief-course-code"
					type="text"
					class={[
						'min-h-11 min-w-0 flex-auto rounded-none border border-[var(--rule)] bg-[var(--paper)] px-[0.85rem] py-[0.6rem] font-[family-name:var(--font-body)] text-[1.1rem] font-medium text-[var(--ink)] transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)] placeholder:font-normal placeholder:text-[var(--ink-faint)] focus:border-[var(--ink)]',
						submitAttempted && !courseCode.trim() && 'border-[var(--pen-red)]'
					]}
					placeholder="Course code (e.g. CSIS 3375, MATH 1130)"
					bind:value={courseCode}
					onkeydown={onKeydown}
				/>
				<button
					class="btn btn-primary min-h-11 min-w-36 flex-none max-[700px]:w-full"
					type="button"
					onclick={submit}
					disabled={!canSubmit}
				>
					research →
				</button>
			</div>
			<button
				class="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent py-[0.1rem] text-left tracking-normal text-[var(--ink-soft)] text-[var(--text-caption)] lowercase hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
				type="button"
				onclick={() => (moreOptionsOpen = !moreOptionsOpen)}
				aria-expanded={moreOptionsOpen}
				aria-controls="brief-more-options"
			>
				{moreOptionsOpen ? '▾' : '▸'}
				{moreOptionsOpen ? 'less' : 'more'} options
			</button>
			{#if moreOptionsOpen}
				<div
					class="more-panel mt-1 grid grid-cols-2 gap-x-3 gap-y-[0.6rem] border-t border-dashed border-[var(--rule-soft)] pt-2 pb-1 max-[700px]:grid-cols-1"
					id="brief-more-options"
				>
					<label class="grid gap-[0.3rem]">
						<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Course name</span>
						<input
							type="text"
							class="field-input"
							placeholder="helps narrow the search"
							bind:value={courseName}
							onkeydown={onKeydown}
						/>
					</label>
					<label class="grid gap-[0.3rem]">
						<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Professor name</span>
						<input
							type="text"
							class="field-input"
							placeholder="optional"
							bind:value={professorName}
							onkeydown={onKeydown}
						/>
					</label>
					<label class="grid gap-[0.3rem]">
						<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Institution</span>
						<input
							type="text"
							class="field-input"
							placeholder="optional"
							bind:value={institution}
							onkeydown={onKeydown}
						/>
					</label>
					<label class="col-span-full grid gap-[0.3rem]">
						<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Notes</span>
						<textarea
							class="field-input min-h-16 resize-y leading-[1.45]"
							placeholder="term, section, modality, or anything that might narrow the search"
							maxlength="1200"
							bind:value={additionalNotes}
							onkeydown={onKeydown}
						></textarea>
					</label>
				</div>
			{/if}
			{#if researchError && !job}
				<p class="mt-[0.1rem] mb-0 text-[var(--pen-red)] text-[var(--text-caption)]">
					{researchError}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Repeated text-field primitive shared by the optional inputs. */
	.field-input {
		width: 100%;
		min-height: 2.4rem;
		padding: 0.45rem 0.65rem;
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--ink);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: 0;
		transition: border-color 0.15s var(--ease-out-quart);
	}

	.field-input:focus {
		border-color: var(--ink);
	}

	.field-input::placeholder {
		color: var(--ink-faint);
	}

	.more-panel {
		animation: slideDown 180ms var(--ease-out-quart);
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.more-panel {
			animation: none;
		}
	}
</style>
