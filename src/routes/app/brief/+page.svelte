<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import BookShelf from '$lib/components/catalog/BookShelf.svelte';

	type Briefing = {
		code: string;
		name: string;
		institution: string;
		professor: string;
		rmpRating: string;
		rmpCount?: number;
		workload: string;
		weeklyHours?: string | null;
		prereqReadiness: string;
		gradeStructure: { item: string; weight: string }[];
		recommendation: string;
		sources: { description: string; url?: string; found: boolean }[];
		researchedAt: string;
		modelUsed: string;
		schemaVersion: number;
	};

	type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'expired';

	type BriefingJob = {
		id: string;
		status: JobStatus;
		output: string | null;
		errorMessage: string | null;
	};

	type JobResponse = {
		job?: BriefingJob | null;
		output?: Briefing | null;
		error?: string;
	};

	const POLL_INTERVAL_MS = 2000;
	const POLL_TIMEOUT_MS = 2 * 60 * 1000;
	const MAX_POLL_COUNT = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

	let { data }: { data: { briefs: Briefing[]; defaultModel: string } } = $props();

	const briefs = $derived(data.briefs ?? []);
	const defaultModel = $derived(data.defaultModel ?? 'deepseek/deepseek-v4-flash');

	let courseCode = $state('');
	let courseName = $state('');
	let professorName = $state('');
	let institution = $state('');
	let additionalNotes = $state('');
	let selectedCode = $state<string | null>(null);
	let researching = $state(false);
	let researchError = $state<string | null>(null);
	let jobStatus = $state<JobStatus | null>(null);
	let jobErrorMsg = $state<string | null>(null);
	let pollTimer = $state<ReturnType<typeof setInterval> | undefined>();
	let pollCount = $state(0);
	let pollTimedOut = $state(false);
	let deleting = $state(false);
	let confirmDeleteCode = $state<string | null>(null);

	let hasAnySearch = $derived(
		courseCode.trim().length > 0 ||
			courseName.trim().length > 0 ||
			professorName.trim().length > 0 ||
			institution.trim().length > 0
	);

	let filtered = $derived(
		hasAnySearch
			? briefs.filter((b) => {
					const qCode = courseCode.trim().toLowerCase();
					const qName = courseName.trim().toLowerCase();
					const qProf = professorName.trim().toLowerCase();
					const qInst = institution.trim().toLowerCase();
					return (
						(!qCode ||
							b.code.toLowerCase().includes(qCode) ||
							b.name.toLowerCase().includes(qCode)) &&
						(!qName || b.name.toLowerCase().includes(qName)) &&
						(!qProf || b.professor.toLowerCase().includes(qProf)) &&
						(!qInst || b.institution.toLowerCase().includes(qInst))
					);
				})
			: briefs
	);

	let selected = $derived(
		selectedCode ? (briefs.find((b) => b.code === selectedCode) ?? null) : null
	);

	let modelMismatch = $derived(selected ? selected.modelUsed !== defaultModel : false);

	let statusMessage = $derived.by(() => {
		if (pollTimedOut) return 'Briefing is taking longer than expected.';
		switch (jobStatus) {
			case 'queued':
				return 'Queued — waiting for worker…';
			case 'running':
				return pollCount > 3
					? 'Still researching… gathering sources'
					: 'Researching course… checking syllabus, ratings, prerequisites';
			case 'succeeded':
				return 'Briefing complete';
			case 'failed':
				return jobErrorMsg || 'Briefing failed';
			case 'expired':
				return jobErrorMsg || 'Briefing expired. Try again.';
			default:
				return '';
		}
	});

	function stopPolling() {
		if (!pollTimer) return;
		clearInterval(pollTimer);
		pollTimer = undefined;
	}

	function startPolling(jobId: string) {
		stopPolling();
		pollCount = 0;
		pollTimedOut = false;
		pollTimer = setInterval(async () => {
			pollCount++;
			if (pollCount > MAX_POLL_COUNT) {
				stopPolling();
				pollTimedOut = true;
				researching = false;
				jobErrorMsg = 'Polling timed out after 2 minutes.';
				return;
			}
			try {
				const res = await fetch(`/api/briefing/jobs/${jobId}`);
				const data = (await res.json()) as JobResponse;
				const job = data.job;
				if (job) {
					jobStatus = job.status;
					if (job.status === 'succeeded' && data.output) {
						stopPolling();
						selectedCode = data.output.code;
						await invalidateAll();
						researching = false;
					} else if (job.status === 'failed' || job.status === 'expired') {
						jobErrorMsg = job.errorMessage || statusMessage;
						stopPolling();
						researching = false;
					}
				}
			} catch {
				// keep polling
			}
		}, POLL_INTERVAL_MS);
	}

	async function researchCourse() {
		if (researching) return;
		const code = courseCode.trim();
		if (!code) {
			researchError = 'Enter at least a course code to research.';
			return;
		}

		researching = true;
		researchError = null;
		jobStatus = null;
		jobErrorMsg = null;
		pollTimedOut = false;

		try {
			const res = await fetch('/api/briefing/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					courseCode: code,
					courseName: courseName.trim() || undefined,
					professorName: professorName.trim() || undefined,
					institution: institution.trim() || undefined,
					additionalNotes: additionalNotes.trim() || undefined
				})
			});

			const result = (await res.json()) as JobResponse;

			if (!res.ok) {
				researchError = result.error ?? `Server error (${res.status})`;
				researching = false;
				return;
			}

			const job = result.job;
			if (!job) {
				researchError = 'No job returned';
				researching = false;
				return;
			}

			if (job.status === 'succeeded' && job.output) {
				try {
					const parsed = JSON.parse(job.output) as { code?: string };
					if (parsed.code) selectedCode = parsed.code;
				} catch {
					selectedCode = null;
				}
				await invalidateAll();
				researching = false;
				return;
			}

			if (job.status === 'failed' || job.status === 'expired') {
				researchError = job.errorMessage || 'Briefing failed';
				researching = false;
				return;
			}

			jobStatus = job.status;
			startPolling(job.id);
		} catch {
			researchError = 'Failed to research course. Is the server running?';
			researching = false;
		}
	}

	function retry() {
		researchError = null;
		jobErrorMsg = null;
		pollTimedOut = false;
		researchCourse();
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') researchCourse();
		if (e.key === 'Escape') {
			selectedCode = null;
			researchError = null;
		}
	}

	async function deleteBriefing(code: string) {
		if (deleting) return;
		confirmDeleteCode = null;
		deleting = true;
		try {
			const res = await fetch(`/api/brief?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
			if (res.ok) {
				selectedCode = null;
				await invalidateAll();
			}
		} finally {
			deleting = false;
		}
	}

	function ratingVariant(rating: string): 'crit' | 'ok' | 'warn' | 'idle' {
		if (rating === 'N/A') return 'idle';
		const num = parseFloat(rating);
		if (num < 3) return 'crit';
		if (num >= 4) return 'ok';
		return 'warn';
	}

	onDestroy(stopPolling);
</script>

<svelte:head><title>Synapse · Course Brief</title></svelte:head>

<div class="page page-enter">
	{#if !selected}
		<div class="page-cover">
			<h1 class="page-title font-display">Course Brief</h1>
			<p class="page-tagline">
				{#if briefs.length > 0}
					<span class="tagline-num">{briefs.length}</span> course{briefs.length === 1 ? '' : 's'} briefed
				{:else}
					Research prospective courses before you register
				{/if}
			</p>
		</div>

		<div class="search-block">
			<div class="search-fields">
				<label class="sr-only" for="brief-course">Course code</label>
				<input
					id="brief-course"
					type="text"
					class="sf-input"
					placeholder="Course code (e.g. CSIS 3375, MATH 1130)"
					bind:value={courseCode}
					onkeydown={onKeydown}
				/>
				<label class="sr-only" for="brief-course-name">Course name</label>
				<input
					id="brief-course-name"
					type="text"
					class="sf-input"
					placeholder="Course name (optional, helps research)"
					bind:value={courseName}
					onkeydown={onKeydown}
				/>
				<label class="sr-only" for="brief-professor">Professor name</label>
				<input
					id="brief-professor"
					type="text"
					class="sf-input"
					placeholder="Professor name (optional)"
					bind:value={professorName}
					onkeydown={onKeydown}
				/>
				<div class="sf-row">
					<label class="sr-only" for="brief-institution">Institution</label>
					<input
						id="brief-institution"
						type="text"
						class="sf-input flex-1"
						placeholder="Institution (optional)"
						bind:value={institution}
						onkeydown={onKeydown}
					/>
					<button
						class="btn btn-primary"
						onclick={researchCourse}
						disabled={researching || !courseCode.trim()}
					>
						{researching ? 'researching…' : 'research'}
					</button>
				</div>
				<label class="sr-only" for="brief-notes">Additional notes</label>
				<textarea
					id="brief-notes"
					class="sf-input sf-textarea"
					placeholder="Additional notes (optional): term, section, modality, textbook, or anything that might narrow the search"
					maxlength="1200"
					bind:value={additionalNotes}
				></textarea>
			</div>
			{#if researchError && !jobStatus}
				<p class="search-note">{researchError}</p>
			{/if}
			{#if briefs.length > 0}
				<p class="search-note muted">
					<span class="tagline-num">{briefs.length}</span> course{briefs.length === 1 ? '' : 'es'}
					briefed
				</p>
			{/if}
		</div>

		{#if researching || jobStatus}
			<div class="job-tracker" role="status" aria-live="polite" aria-label="Briefing job status">
				<div class="job-tracker-head">
					<span class="job-tracker-label font-mono">job</span>
					<span class="job-tracker-code font-mono">{courseCode.trim().toUpperCase()}</span>
				</div>
				<div class="job-steps">
					<div
						class="job-step"
						class:job-step-done={jobStatus === 'succeeded'}
						class:job-step-active={jobStatus === 'queued' || jobStatus === 'running'}
					>
						<span class="job-step-indicator">
							{#if jobStatus === 'succeeded'}
								<span class="job-step-check">✓</span>
							{:else if jobStatus === 'queued' || jobStatus === 'running'}
								<span class="job-step-dot animate-pulse"></span>
							{:else}
								<span class="job-step-num">1</span>
							{/if}
						</span>
						<span class="job-step-text">Queued</span>
					</div>
					<div
						class="job-step-connector"
						class:job-step-connector-done={jobStatus === 'succeeded' || jobStatus === 'running'}
					></div>
					<div
						class="job-step"
						class:job-step-done={jobStatus === 'succeeded'}
						class:job-step-active={jobStatus === 'running'}
					>
						<span class="job-step-indicator">
							{#if jobStatus === 'succeeded'}
								<span class="job-step-check">✓</span>
							{:else if jobStatus === 'running'}
								<span class="job-step-dot animate-pulse"></span>
							{:else if jobStatus === 'failed' || jobStatus === 'expired'}
								<span class="job-step-err">✗</span>
							{:else}
								<span class="job-step-num">2</span>
							{/if}
						</span>
						<span class="job-step-text">Researching</span>
					</div>
					<div
						class="job-step-connector"
						class:job-step-connector-done={jobStatus === 'succeeded'}
					></div>
					<div
						class="job-step"
						class:job-step-done={jobStatus === 'succeeded'}
						class:job-step-active={false}
					>
						<span class="job-step-indicator">
							{#if jobStatus === 'succeeded'}
								<span class="job-step-check">✓</span>
							{:else if jobStatus === 'failed' || jobStatus === 'expired'}
								<span class="job-step-err">✗</span>
							{:else}
								<span class="job-step-num">3</span>
							{/if}
						</span>
						<span class="job-step-text">Complete</span>
					</div>
				</div>
				<div class="job-tracker-msg">
					{#if pollTimedOut}
						<span class="job-tracker-err font-mono">{statusMessage}</span>
						<button class="btn btn-sm font-mono" onclick={retry}>retry</button>
					{:else if jobStatus === 'failed' || jobStatus === 'expired'}
						<span class="job-tracker-err font-mono">{statusMessage}</span>
						<button class="btn btn-sm font-mono" onclick={retry}>retry</button>
					{:else if jobStatus === 'succeeded'}
						<span class="job-tracker-done font-mono">Done — refreshing…</span>
					{:else}
						<span class="job-tracker-status">{statusMessage}</span>
					{/if}
				</div>
			</div>
		{/if}

		{#if !researching && !jobStatus}
			{#if filtered.length > 0}
				<SectionHead
					eyebrow={`${filtered.length} ${filtered.length === 1 ? 'brief' : 'briefs'}`}
					title="In the catalog"
				/>
				<BookShelf>
					{#each filtered as brief (brief.code)}
						<button
							class="book brief-book"
							type="button"
							onclick={() => (selectedCode = brief.code)}
						>
							<span class="book-spine {ratingVariant(brief.rmpRating)}"></span>
							<div class="book-body">
								<div class="book-meta">{brief.code} · RMP {brief.rmpRating}</div>
								<div class="book-title">{brief.name}</div>
								<div class="book-detail">{brief.institution} · {brief.professor}</div>
							</div>
							<div class="book-status">
								<div class="book-status-num">{brief.gradeStructure.length}</div>
								<div class="book-status-label">items</div>
							</div>
						</button>
					{/each}
				</BookShelf>
			{/if}

			{#if filtered.length === 0 && !researching}
				<div class="empty-state surface-polaroid">
					<h2 class="empty-head font-display">
						{hasAnySearch ? 'Nothing matches' : 'Brief a course'}
					</h2>
					<p class="empty-text">
						{hasAnySearch
							? 'No briefings match your search.'
							: 'Enter a course code above to research one.'}
					</p>
					{#if !hasAnySearch}
						<p class="empty-hint font-mono">e.g. CSIS 3375, MATH 1130, COMP 2110</p>
					{/if}
				</div>
			{/if}
		{/if}
	{:else if selected}
		<button class="btn btn-ghost btn-sm font-mono" onclick={() => (selectedCode = null)}
			>← back to all briefings</button
		>

		<article class="brief-detail surface-polaroid">
			<div class="detail-head">
				<h2 class="detail-code font-mono">{selected.code}</h2>
				<span class="detail-name">{selected.name}</span>
				<span class="detail-inst">{selected.institution}</span>
				<span class="detail-date font-mono">researched {formatDate(selected.researchedAt)}</span>
			</div>
			{#if modelMismatch}
				<p class="model-warn font-mono" role="status">
					Cached briefing produced by a different model ({selected.modelUsed}). Current default: {defaultModel}.
				</p>
			{/if}

			<div class="detail-grid">
				<div class="detail-field">
					<span class="field-label font-mono">Professor</span>
					<span class="field-value">{selected.professor}</span>
				</div>
				<div class="detail-field">
					<span class="field-label font-mono">RMP Rating</span>
					<span
						class="field-value"
						class:low-rating={selected.rmpRating !== 'N/A' && parseFloat(selected.rmpRating) < 3}
					>
						{selected.rmpRating}{#if selected.rmpCount}
							({selected.rmpCount} ratings){/if}
					</span>
				</div>
				<div class="detail-field full-row">
					<span class="field-label font-mono">Workload</span>
					<span class="field-value">{selected.workload}</span>
					{#if selected.weeklyHours}
						<span class="field-hint font-mono">~{selected.weeklyHours} hrs/week outside class</span>
					{/if}
				</div>
				<div class="detail-field full-row">
					<span class="field-label font-mono">Prereq Readiness</span>
					<span class="field-value">{selected.prereqReadiness}</span>
				</div>
				{#if selected.gradeStructure.length > 0}
					<div class="detail-field full-row">
						<span class="field-label font-mono">Grade Structure</span>
						<div class="grade-structure">
							{#each selected.gradeStructure as g (g.item)}
								<div class="grade-row">
									<span class="grade-item">{g.item}</span>
									<span class="grade-weight font-mono">{g.weight}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			{#if selected.recommendation}
				<div class="detail-recommendation">
					<span class="highlighter font-mono">note</span>
					<p class="rec-text">{selected.recommendation}</p>
				</div>
			{/if}

			{#if selected.sources.length > 0}
				<div class="detail-sources">
					<span class="field-label font-mono">Sources</span>
					<div class="source-list">
						{#each selected.sources as source, i (i)}
							{#if source.url}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- Source URLs are external research links. -->
								<a
									class="source-item"
									class:source-found={source.found}
									class:source-missed={!source.found}
									href={source.url}
									target="_blank"
									rel="noreferrer"
								>
									{source.found ? '✓' : '✗'}
									{source.description}
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{:else}
								<span
									class="source-item"
									class:source-found={source.found}
									class:source-missed={!source.found}
								>
									{source.found ? '✓' : '✗'}
									{source.description}
								</span>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
			<div class="detail-delete">
				{#if confirmDeleteCode === selected.code}
					<span class="delete-label font-mono">Delete this briefing?</span>
					<button class="btn btn-sm btn-ghost" onclick={() => (confirmDeleteCode = null)}
						>cancel</button
					>
					<button
						class="btn btn-sm btn-danger"
						onclick={() => deleteBriefing(selected.code)}
						disabled={deleting}
					>
						{deleting ? 'deleting…' : 'delete'}
					</button>
				{:else}
					<button
						class="btn btn-ghost btn-sm font-mono"
						onclick={() => (confirmDeleteCode = selected.code)}>delete briefing</button
					>
				{/if}
			</div>
		</article>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2rem, 4vw, 3.25rem);
		font-weight: 600;
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1.05;
		letter-spacing: -0.025em;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
	}

	.search-block {
		margin-bottom: 1.5rem;
		padding: 1.25rem 1.5rem 1.25rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.search-fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sf-input {
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--ink);
		outline: none;
		box-sizing: border-box;
	}

	.sf-input:focus {
		border-color: var(--ink);
	}

	.sf-input::placeholder {
		color: var(--ink-faint);
	}

	.sf-input.flex-1 {
		flex: 1;
		min-width: 0;
	}

	.sf-textarea {
		min-height: 5.5rem;
		line-height: 1.45;
		resize: vertical;
	}

	.sf-row {
		display: flex;
		gap: 0.5rem;
	}

	.search-note {
		font-size: 0.78rem;
		color: var(--ink-soft);
		margin: 0.6rem 0 0;
		line-height: 1.3;
	}

	.search-note.muted {
		color: var(--ink-faint);
	}

	/* ═══════════════════════════════════════════════════════════════
	   Job tracker — visual state machine
	   ═══════════════════════════════════════════════════════════════ */

	.job-tracker {
		margin-bottom: 1.5rem;
		padding: 1rem 1.5rem;
		border: 1px solid var(--rule);
		background: var(--surface-paper);
	}

	.job-tracker-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.job-tracker-label {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		border: 1px solid var(--rule);
		padding: 0.1rem 0.4rem;
		line-height: 1.2;
	}

	.job-tracker-code {
		font-size: 0.8rem;
		color: var(--ink);
		font-weight: 500;
	}

	.job-steps {
		display: flex;
		align-items: center;
		gap: 0;
		margin-bottom: 0.75rem;
	}

	.job-step {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.job-step-indicator {
		display: grid;
		width: 1.4rem;
		height: 1.4rem;
		place-items: center;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		font-size: 0.65rem;
		color: var(--ink-faint);
		flex-shrink: 0;
	}

	.job-step-done .job-step-indicator {
		border-color: var(--ok);
		background: var(--ok);
		color: var(--paper);
	}

	.job-step-active .job-step-indicator {
		border-color: var(--highlight);
		background: var(--highlight);
		color: var(--ink);
	}

	.job-step-check {
		font-size: 0.7rem;
	}

	.job-step-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink);
		opacity: 1;
	}

	.job-step-err {
		font-size: 0.7rem;
		font-weight: 700;
	}

	.job-step-num {
		font-family: var(--font-mono);
		font-size: 0.6rem;
	}

	.job-step-text {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}

	.job-step-done .job-step-text {
		color: var(--ok);
	}

	.job-step-active .job-step-text {
		color: var(--ink);
		font-weight: 500;
	}

	.job-step-connector {
		width: 1.5rem;
		height: 1px;
		background: var(--rule);
		margin: 0 0.5rem;
		flex-shrink: 0;
	}

	.job-step-connector-done {
		background: var(--ok);
	}

	.job-tracker-msg {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.job-tracker-status {
		font-size: 0.82rem;
		color: var(--ink-soft);
	}

	.job-tracker-err {
		font-size: 0.78rem;
		color: var(--accent);
	}

	.job-tracker-done {
		font-size: 0.78rem;
		color: var(--ok);
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

	.animate-pulse {
		animation: pulse 1.2s var(--ease-out-quart) infinite;
	}

	/* ═══════════════════════════════════════════════════════════════
	   Legacy styles (unchanged)
	   ═══════════════════════════════════════════════════════════════ */

	.brief-book {
		text-align: left;
		font-family: var(--font-body);
	}

	.empty-state {
		padding: 3rem 2rem;
		text-align: center;
	}

	.empty-text {
		color: var(--ink-soft);
		font-size: 0.95rem;
		margin: 0 0 0.5rem;
	}

	.empty-hint {
		font-size: 0.78rem;
		color: var(--ink-faint);
		margin: 0;
	}

	.empty-head {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.brief-detail {
		position: relative;
	}

	.detail-head {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--ink);
	}

	.model-warn {
		margin: 0 0 1rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.72rem;
		color: var(--warn);
		border: 1px solid var(--warn);
		background: rgba(192, 138, 46, 0.08);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.detail-code {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--ink);
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.detail-name {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--ink);
		display: block;
		letter-spacing: -0.01em;
	}

	.detail-inst {
		font-size: 0.85rem;
		color: var(--ink-soft);
		display: block;
		margin-top: 0.25rem;
	}

	.detail-date {
		font-size: 0.68rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-top: 0.5rem;
		display: block;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.detail-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail-field.full-row {
		grid-column: 1 / -1;
	}

	.field-label {
		font-size: 0.68rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.field-value {
		font-size: 0.9rem;
		color: var(--ink);
		line-height: 1.4;
		overflow-wrap: break-word;
	}

	.field-hint {
		font-size: 0.72rem;
		color: var(--ink-faint);
	}

	.low-rating {
		color: var(--accent);
	}

	.grade-structure {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.25rem;
	}

	.grade-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0;
		border-bottom: 1px dashed var(--rule);
	}

	.grade-row:last-child {
		border-bottom: none;
	}

	.grade-item {
		font-size: 0.85rem;
		color: var(--ink);
	}

	.grade-weight {
		font-size: 0.75rem;
		color: var(--ink-soft);
	}

	.detail-recommendation {
		border-top: 1px dashed var(--rule);
		padding-top: 1.25rem;
		margin-bottom: 1rem;
	}

	.rec-text {
		font-size: 0.9rem;
		color: var(--ink);
		line-height: 1.5;
		margin: 0.75rem 0 0;
	}

	.detail-sources {
		border-top: 1px dashed var(--rule);
		padding-top: 1rem;
		margin-bottom: 1rem;
	}

	.source-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.source-item {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.72rem;
		padding: 0.2rem 0.5rem;
		background: var(--paper-shelf);
		color: var(--ink-soft);
		text-decoration: none;
		border: 1px solid transparent;
	}

	a.source-item:hover,
	a.source-item:focus-visible {
		border-color: var(--ink);
		color: var(--ink);
	}

	.source-missed {
		opacity: 0.6;
	}

	.detail-delete {
		border-top: 1px dashed var(--rule);
		padding-top: 1rem;
		margin-top: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.delete-label {
		font-size: 0.78rem;
		color: var(--accent);
		margin-right: auto;
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

	@media (max-width: 700px) {
		.page {
			padding-inline: 1rem;
		}

		.search-block,
		.job-tracker {
			padding-inline: 1rem;
		}

		.sf-row,
		.job-tracker-msg,
		.detail-delete {
			flex-direction: column;
			align-items: stretch;
		}

		.job-steps {
			align-items: flex-start;
			overflow-x: auto;
			padding-bottom: 0.25rem;
		}

		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
