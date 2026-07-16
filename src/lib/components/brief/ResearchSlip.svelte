<script lang="ts">
	import { onDestroy } from 'svelte';
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

	let { onSuccess }: { onSuccess?: (code: string) => void } = $props();

	let courseCode = $state('');
	let courseName = $state('');
	let professorName = $state('');
	let institution = $state('');
	let additionalNotes = $state('');
	let moreOptionsOpen = $state(false);

	let researchError = $state<string | null>(null);
	let activeJobId = $state<string | null>(null);
	let job = $state<Job | null>(null);
	let timedOut = $state(false);
	let pollTimer = $state<ReturnType<typeof setInterval> | undefined>();
	let pollCount = $state(0);
	let succeededCode = $state<string | null>(null);
	let submitAttempted = $state(false);

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
							? (JSON.parse(data.job.output) as { courseCode?: string; code?: string; identity?: { code?: string } })
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
						? (JSON.parse(data.job.output) as { courseCode?: string; code?: string; identity?: { code?: string } })
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

<div class="slip">
	<div class="slip-head">
		<span class="slip-label font-mono">research request</span>
		<span class="slip-date font-mono">{today}</span>
	</div>
	<div class="slip-rule"></div>

	{#if succeededCode}
		<div class="done">
			<span class="done-check" aria-hidden="true">✓</span>
			<span class="done-text">
				<strong>{succeededCode}</strong> ready —
				<a href={`/app/brief/${encodeURIComponent(succeededCode)}`} onclick={() => onSuccess?.(succeededCode!)}>view brief →</a>
			</span>
		</div>
	{:else if job && (job.status === 'running' || job.status === 'queued' || job.status === 'failed' || job.status === 'conflict' || job.status === 'expired' || job.status === 'canceled' || timedOut)}
		<div class="slip-body">
			<div class="slip-label-row">
				<span class="slip-state font-mono">researching · {courseCode.trim().toUpperCase()}</span>
			</div>
			<JobTracker
				job={job}
				courseCode={courseCode}
				timedOut={timedOut}
				onCancel={cancelJob}
				onRetry={retry}
			/>
		</div>
	{:else}
		<div class="slip-body">
			<div class="input-row">
				<label class="sr-only" for="brief-course-code">Course code</label>
				<input
					id="brief-course-code"
					type="text"
					class="code-input"
					class:error={submitAttempted && !courseCode.trim()}
					placeholder="Course code (e.g. CSIS 3375, MATH 1130)"
					bind:value={courseCode}
					onkeydown={onKeydown}
				/>
				<button
					class="btn btn-primary submit"
					type="button"
					onclick={submit}
					disabled={!canSubmit}
				>
					research →
				</button>
			</div>
			<button
				class="more-toggle font-mono"
				type="button"
				onclick={() => (moreOptionsOpen = !moreOptionsOpen)}
				aria-expanded={moreOptionsOpen}
			>
				{moreOptionsOpen ? '▾' : '▸'} {moreOptionsOpen ? 'less' : 'more'} options
			</button>
			{#if moreOptionsOpen}
				<div class="more-panel">
					<label class="field">
						<span class="field-label font-mono">Course name</span>
						<input
							type="text"
							class="field-input"
							placeholder="helps narrow the search"
							bind:value={courseName}
							onkeydown={onKeydown}
						/>
					</label>
					<label class="field">
						<span class="field-label font-mono">Professor name</span>
						<input
							type="text"
							class="field-input"
							placeholder="optional"
							bind:value={professorName}
							onkeydown={onKeydown}
						/>
					</label>
					<label class="field">
						<span class="field-label font-mono">Institution</span>
						<input
							type="text"
							class="field-input"
							placeholder="optional"
							bind:value={institution}
							onkeydown={onKeydown}
						/>
					</label>
					<label class="field field-wide">
						<span class="field-label font-mono">Notes</span>
						<textarea
							class="field-input field-textarea"
							placeholder="term, section, modality, or anything that might narrow the search"
							maxlength="1200"
							bind:value={additionalNotes}
							onkeydown={onKeydown}
						></textarea>
					</label>
				</div>
			{/if}
			{#if researchError && !job}
				<p class="research-error font-mono">{researchError}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.slip {
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
		border-radius: 0;
		padding: 1rem 1.5rem 1.25rem;
	}

	.slip-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.slip-label {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		border: 1px solid var(--rule);
		padding: 0.1rem 0.4rem;
		line-height: 1.2;
	}

	.slip-date {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.slip-rule {
		height: 1px;
		background: var(--rule-soft);
		margin: 0.6rem 0 0.75rem;
	}

	.slip-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.slip-state {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.slip-body {
		display: grid;
		gap: 0.6rem;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.code-input {
		flex: 1 1 auto;
		min-width: 0;
		min-height: 2.75rem;
		padding: 0.6rem 0.85rem;
		font-family: var(--font-body);
		font-size: 1.1rem;
		font-weight: 500;
		color: var(--ink);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: 0;
		outline: none;
		transition:
			border-color 0.15s var(--ease-out-quart),
			box-shadow 0.15s var(--ease-out-quart);
	}

	.code-input:focus {
		border-color: var(--ink);
		box-shadow: 0 0 0 2px var(--highlight);
	}

	.code-input.error {
		border-color: var(--pen-red);
	}

	.code-input::placeholder {
		color: var(--ink-faint);
		font-weight: 400;
	}

	.submit {
		min-width: 9rem;
		min-height: 2.75rem;
		flex: 0 0 auto;
	}

	.more-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: 0;
		padding: 0.1rem 0;
		font-size: 0.78rem;
		color: var(--ink-soft);
		cursor: pointer;
		text-align: left;
		text-transform: lowercase;
		letter-spacing: 0;
	}

	.more-toggle:hover {
		color: var(--ink);
	}

	.more-toggle:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.more-panel {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem 0.75rem;
		padding: 0.5rem 0 0.25rem;
		border-top: 1px dashed var(--rule-soft);
		margin-top: 0.25rem;
		animation: slideDown 180ms var(--ease-out-quart);
	}

	.field {
		display: grid;
		gap: 0.3rem;
	}

	.field-wide {
		grid-column: 1 / -1;
	}

	.field-label {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.field-input {
		width: 100%;
		min-height: 2.4rem;
		padding: 0.45rem 0.65rem;
		font-family: var(--font-body);
		font-size: 0.92rem;
		color: var(--ink);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: 0;
		outline: none;
		transition:
			border-color 0.15s var(--ease-out-quart),
			box-shadow 0.15s var(--ease-out-quart);
	}

	.field-input:focus {
		border-color: var(--ink);
		box-shadow: 0 0 0 2px var(--highlight);
	}

	.field-input::placeholder {
		color: var(--ink-faint);
	}

	.field-textarea {
		min-height: 4rem;
		resize: vertical;
		line-height: 1.45;
	}

	.research-error {
		font-size: 0.85rem;
		color: var(--pen-red);
		margin: 0.1rem 0 0;
	}

	.done {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0;
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink);
	}

	.done-check {
		font-family: var(--font-mono);
		color: var(--ok);
		font-size: 1rem;
	}

	.done-text a {
		color: var(--ink);
		text-decoration-color: var(--rule);
		margin-left: 0.4rem;
	}

	.done-text a:hover {
		text-decoration-color: var(--ink);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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

	@media (max-width: 700px) {
		.slip {
			padding: 0.75rem 1rem 1rem;
		}
		.input-row {
			flex-direction: column;
		}
		.submit {
			width: 100%;
		}
		.more-panel {
			grid-template-columns: 1fr;
		}
	}
</style>
