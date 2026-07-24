<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import StatusChip from '$lib/components/catalog/StatusChip.svelte';
	import { prepareSyllabusEvents } from '$lib/calendar/syllabus-sync';

	type ExtractedData = {
		professor: {
			name: string;
			email: string;
			office: string;
			officeHours: string;
		};
		logistics: {
			classTime: string;
			room: string;
			attendance: string;
		};
		dates: {
			label: string;
			date: string;
			type: 'quiz' | 'exam' | 'deadline';
			needsReview?: boolean;
		}[];
		grading: {
			label: string;
			weight: number;
		}[];
		requiredMaterials: {
			textbookTitle?: string;
			textbookPdfUploaded: boolean;
			textbookPdfUrl?: string;
		};
		keyKnowledge: {
			source: string;
			topics: string[];
			highlightedTopic: string;
			outline: {
				range: string;
				topic: string;
			}[];
		};
	};

	type SyllabusImport = {
		id: string;
		courseId: string;
		fileName: string;
		rawText: string;
		extractedData: ExtractedData;
		status: 'mocked' | 'ready' | 'error';
		createdAt: string;
		updatedAt: string;
	};

	type SetupCourse = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
	};

	type SetupSemester = {
		id: string;
		term: string;
		year: number;
		order: number;
	};

	let { data }: { data: { course: SetupCourse; semester: SetupSemester } } = $props();

	let syllabus = $state<SyllabusImport | null>(null);
	let loading = $state(true);
	let apiError = $state('');

	// Calendar sync state
	let syncing = $state(false);
	let syncResult = $state<{
		added: number;
		duplicates: number;
		old: number;
		invalid: number;
		failed: number;
	} | null>(null);
	let syncError = $state('');
	let syncMonth = $state<number | null>(null);
	let syncYear = $state<number | null>(null);

	let activeCourse = $derived(data.course);
	let activeSemester = $derived(data.semester);
	const uploadHref = $derived(
		resolveRoute('/app/semesters/[semesterId]/courses/[courseId]/syllabus', {
			semesterId: data.semester.id,
			courseId: data.course.id
		})
	);
	let extracted = $derived(syllabus?.extractedData ?? null);
	let textbookUploaded = $derived(extracted?.requiredMaterials.textbookPdfUploaded ?? false);

	let professorRows = $derived(
		extracted
			? [
					['Professor', extracted.professor.name],
					['Email', extracted.professor.email],
					['Office', extracted.professor.office],
					['Office hours', extracted.professor.officeHours]
				]
			: []
	);
	let logisticsRows = $derived(
		extracted
			? [
					['Class', extracted.logistics.classTime],
					['Room', extracted.logistics.room],
					['Attendance', extracted.logistics.attendance]
				]
			: []
	);
	let dateRows = $derived(extracted?.dates ?? []);
	let gradingRows = $derived(extracted?.grading ?? []);
	let knowledgeTopics = $derived(extracted?.keyKnowledge.topics ?? []);
	let outlineRows = $derived(extracted?.keyKnowledge.outline ?? []);

	let statusVariant: 'crit' | 'ok' = $derived(syllabus?.status === 'error' ? 'crit' : 'ok');
	let statusLabel = $derived(
		syllabus?.status === 'ready'
			? 'Ready'
			: syllabus?.status === 'mocked'
				? 'Sample data'
				: syllabus?.status === 'error'
					? 'Error'
					: 'Empty'
	);

	/** Map syllabus type + label to a calendar event type. */
	function toCalendarType(syllabusType: string, label: string): string {
		if (syllabusType === 'quiz') return 'quiz';
		if (syllabusType === 'exam') {
			const lower = label.toLowerCase();
			if (lower.includes('midterm')) return 'midterm';
			if (lower.includes('final')) return 'final';
			return 'midterm';
		}
		return 'assignment';
	}

	async function syncToCalendar() {
		if (!extracted || dateRows.length === 0) return;

		syncing = true;
		syncResult = null;
		syncError = '';
		const courseCode = activeCourse?.code || data.course.id;
		const prepared = prepareSyllabusEvents({
			courseId: activeCourse.id,
			semesterYear: activeSemester?.year ?? new Date().getFullYear(),
			rows: dateRows,
			toCalendarType
		});
		let added = 0;
		let duplicates = prepared.skippedDuplicate;
		let firstMonth: number | null = null;
		let firstYear: number | null = null;
		let failed = 0;

		for (const event of prepared.events) {
			const gradeItem = gradingRows.find((grade) =>
				event.title.toLowerCase().includes(grade.label.toLowerCase())
			);
			try {
				const res = await fetch('/api/calendar/events', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						courseId: activeCourse.id,
						courseCode,
						title: event.title,
						type: event.type,
						date: event.date,
						month: event.month,
						year: event.year,
						gradeWeight: gradeItem?.weight ?? undefined
					})
				});
				if (res.ok) {
					const body = (await res.json()) as { created?: boolean };
					if (body.created === false) duplicates++;
					else {
						added++;
						if (firstMonth === null) {
							firstMonth = event.month;
							firstYear = event.year;
						}
					}
				} else {
					failed++;
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					syncError ||= body?.error ?? 'Could not sync one or more syllabus dates.';
				}
			} catch {
				failed++;
			}
		}

		syncResult = {
			added,
			duplicates,
			old: prepared.skippedOld,
			invalid: prepared.invalid,
			failed
		};
		syncMonth = firstMonth;
		syncYear = firstYear;
		syncing = false;

		if (added > 0) await invalidateAll();
	}

	async function loadSyllabus() {
		loading = true;
		apiError = '';
		try {
			const res = await fetch(`/api/syllabus?courseId=${encodeURIComponent(data.course.id)}`);
			if (!res.ok) throw new Error('Could not load syllabus extraction');
			syllabus = ((await res.json()) as SyllabusImport | null) ?? null;
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not load syllabus';
		} finally {
			loading = false;
		}
	}

	async function uploadTextbook(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;

		apiError = '';
		try {
			const response = await fetch('/api/syllabus/textbook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fileName: file.name, courseId: data.course.id })
			});
			if (!response.ok) throw new Error('Could not save textbook');
			syllabus = (await response.json()) as SyllabusImport;
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not save textbook';
		}
	}

	import { onMount } from 'svelte';
	onMount(() => {
		void loadSyllabus();
	});
</script>

<svelte:head>
	<title>Syllabus intelligence · Synapse</title>
</svelte:head>

<div class="page">
	<div class="page-cover">
		<div class="page-cover-row">
			<div class="page-cover-copy">
				<h1 class="page-title">Syllabus intelligence</h1>
				<p class="page-tagline">
					{activeCourse
						? `${activeCourse.code} - ${activeCourse.name}`
						: `Course ${data.course.id}`}
					{syllabus ? `· ${syllabus.fileName}` : ''}
				</p>
			</div>
			<a href={uploadHref} class="btn btn-sm btn-ghost font-mono">back to upload</a>
		</div>
		<div class="page-status">
			<StatusChip variant={statusVariant} label={statusLabel} />
		</div>
	</div>

	{#if loading}
		<div class="loading-state font-mono" role="status" aria-live="polite">
			Loading extraction...
		</div>
	{:else if apiError}
		<div class="error-banner font-mono" role="alert">{apiError}</div>
	{:else if !syllabus}
		<section class="surface-polaroid empty-state">
			<h2 class="empty-head font-hand">No extraction found</h2>
			<p class="empty-text">No syllabus has been extracted for this course yet.</p>
			<a href={uploadHref} class="btn btn-primary">Upload a syllabus</a>
		</section>
	{:else if extracted}
		{#if dateRows.length > 0}
			<section class="sync-bar surface-polaroid">
				<div class="sync-bar-copy">
					<div class="sync-bar-title font-mono">Calendar sync</div>
					<p class="sync-bar-text">
						Add upcoming, unique dates from this syllabus. Past dates and events already on your
						calendar are skipped.
						{#if activeSemester}
							Dates without a year use <strong>{activeSemester.term} {activeSemester.year}</strong>.
						{/if}
					</p>
				</div>
				<div class="sync-bar-action">
					{#if syncResult}
						<span
							class="sync-result font-mono"
							class:sync-ok={syncResult.failed === 0}
							class:sync-partial={syncResult.failed > 0 && syncResult.added > 0}
						>
							{syncResult.added} added
							{#if syncResult.duplicates > 0}
								· {syncResult.duplicates} already present{/if}
							{#if syncResult.old > 0}
								· {syncResult.old} past skipped{/if}
							{#if syncResult.invalid > 0}
								· {syncResult.invalid} invalid{/if}
							{#if syncResult.failed > 0}
								· {syncResult.failed} failed{/if}
						</span>
						<button
							class="btn btn-sm btn-ghost font-mono"
							disabled={syncing}
							onclick={syncToCalendar}
						>
							sync again
						</button>
						{#if syncMonth !== null}
							<a
								href="/app/calendar?month={syncMonth}&year={syncYear}"
								class="btn btn-sm btn-ghost font-mono"
							>
								view in calendar
							</a>
						{/if}
					{:else}
						<button class="btn btn-primary btn-sm" disabled={syncing} onclick={syncToCalendar}>
							{syncing ? 'checking syllabus dates...' : `add upcoming dates to calendar`}
						</button>
					{/if}
				</div>
			</section>
		{/if}

		{#if syncError}
			<div class="error-banner font-mono" role="alert" style="margin-bottom: 1rem;">
				{syncError}
			</div>
		{/if}

		<div class="results-grid">
			<section class="data-group surface-polaroid">
				<div class="data-group-head">
					<h3 class="group-title">Professor contact</h3>
				</div>
				<dl>
					{#each professorRows as row, i (i)}
						<div class="data-row">
							<dt>{row[0]}</dt>
							<dd>{row[1]}</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section class="data-group surface-polaroid">
				<div class="data-group-head">
					<h3 class="group-title">Course logistics</h3>
				</div>
				<dl>
					{#each logisticsRows as row, i (i)}
						<div class="data-row">
							<dt>{row[0]}</dt>
							<dd>{row[1]}</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section class="data-group surface-polaroid">
				<div class="data-group-head">
					<h3 class="group-title">Important dates</h3>
				</div>
				<dl>
					{#each dateRows as row, i (i)}
						<div class="data-row" class:needs-review={row.needsReview}>
							<dt>{row.label}</dt>
							<dd>
								<span>{row.date}</span>
								{#if row.needsReview}
									<StatusChip variant="warn" label="Review" />
								{/if}
							</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section class="data-group surface-polaroid">
				<div class="data-group-head">
					<h3 class="group-title">Grading scheme</h3>
				</div>
				<dl>
					{#each gradingRows as row, i (i)}
						<div class="data-row">
							<dt>{row.label}</dt>
							<dd class="font-mono">{row.weight}%</dd>
						</div>
					{/each}
				</dl>
			</section>
		</div>

		<section class="knowledge surface-polaroid">
			<SectionHead title="Key knowledge" meta={extracted.keyKnowledge.source} />

			<div class="topic-list" aria-label="Study topics extracted from syllabus">
				{#each knowledgeTopics as topic, i (i)}
					<span
						class="topic-chip font-mono"
						class:topic-highlight={topic === extracted?.keyKnowledge.highlightedTopic}
					>
						{topic}
					</span>
				{/each}
			</div>

			<div class="outline">
				<div class="outline-head font-mono">Study from outline</div>
				<ol>
					{#each outlineRows as row, i (i)}
						<li>
							<span class="outline-week font-mono">{row.range}</span>
							<span class="outline-topic">{row.topic}</span>
						</li>
					{/each}
				</ol>
			</div>
		</section>

		<section class="materials surface-polaroid">
			<div class="materials-copy">
				<h3 class="group-title">Required materials</h3>
				{#if textbookUploaded}
					<p class="materials-title">
						{extracted?.requiredMaterials.textbookTitle}
					</p>
				{:else}
					<p class="materials-empty font-mono">No textbook uploaded yet</p>
				{/if}
			</div>
			{#if textbookUploaded && extracted?.requiredMaterials.textbookPdfUrl}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- textbookPdfUrl is an external asset, not an app route -->
				<a
					href={extracted.requiredMaterials.textbookPdfUrl}
					class="btn btn-primary"
					aria-label="Open textbook PDF"
				>
					Open textbook PDF
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else}
				<label class="btn btn-secondary upload-material">
					<input
						type="file"
						accept="application/pdf"
						aria-label="Upload textbook PDF"
						onchange={uploadTextbook}
					/>
					Upload textbook PDF
				</label>
			{/if}
		</section>

		{#if dateRows.length > 0}
			<section class="timeline surface-polaroid" aria-label="Extracted syllabus timeline">
				<SectionHead
					eyebrow={`${dateRows.length} ${dateRows.length === 1 ? 'date' : 'dates'}`}
					title="Extracted timeline"
					meta="SORTED"
				/>

				<ol class="timeline-list">
					{#each dateRows as row, i (i)}
						<li
							class="timeline-item"
							class:review={row.needsReview}
							class:highlighted={row.label === 'Midterm exam'}
						>
							<span class="date font-mono">{row.date}</span>
							<span class="timeline-label">{row.label}</span>
							{#if row.needsReview}
								<StatusChip variant="warn" label="Review" />
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{:else}
		<section class="surface-polaroid empty-state">
			<h2 class="empty-head font-hand">Extraction error</h2>
			<p class="empty-text">The syllabus extraction has no usable data.</p>
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2.5rem 4rem;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
		overflow-wrap: anywhere;
	}

	.page-cover-copy {
		min-width: 0;
	}

	.page-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.page-cover-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.page-cover-row .btn {
		flex-shrink: 0;
	}

	.loading-state {
		padding: 2rem;
		text-align: center;
		color: var(--ink-faint);
		font-size: 0.85rem;
	}

	.error-banner {
		padding: 0.5rem 0.75rem;
		margin-bottom: 1rem;
		border: 1px solid var(--pen-red);
		background: rgba(194, 54, 42, 0.05);
		color: var(--pen-red);
		font-size: 0.8rem;
	}

	.empty-state {
		padding: 3rem 2rem;
		text-align: center;
		margin-top: 1.25rem;
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
		margin: 0 0 1rem;
	}

	/* ── Sync bar ── */
	.sync-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 1rem 1.5rem;
		margin-top: 1.25rem;
	}

	.sync-bar-copy {
		min-width: 0;
	}

	.sync-bar-title {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		margin-bottom: 0.2rem;
	}

	.sync-bar-text {
		margin: 0;
		font-size: 0.88rem;
		color: var(--ink-soft);
		overflow-wrap: anywhere;
	}

	.sync-bar-action {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: flex-start;
		min-width: min(100%, 14rem);
	}

	.sync-bar-action .btn {
		white-space: normal;
		text-align: center;
	}

	.sync-result {
		font-size: 0.72rem;
		color: var(--ok);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		overflow-wrap: anywhere;
	}

	.sync-ok {
		color: var(--ok);
	}
	.sync-partial {
		color: var(--warn);
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
		margin-top: 1.25rem;
	}

	.data-group,
	.knowledge,
	.materials,
	.timeline {
		padding: 1.25rem 1.5rem 1.5rem;
	}

	.data-group-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--ink);
	}

	.group-title {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-hand);
		font-size: 1.1rem;
		font-weight: 700;
		line-height: 1.1;
		text-transform: none;
		letter-spacing: 0;
	}

	.data-group dl {
		display: grid;
		gap: 0.3rem;
		margin: 0;
	}

	.data-row {
		display: grid;
		grid-template-columns: minmax(0, 7rem) minmax(0, 1fr);
		gap: 1rem;
		align-items: baseline;
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--rule);
	}

	.data-row:last-child {
		border-bottom: none;
	}

	.data-row dt {
		color: var(--ink-faint);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.data-row dd {
		margin: 0;
		color: var(--ink);
		font-size: 0.95rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		justify-content: flex-start;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.data-row dd > span:first-child {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.data-row.needs-review dd > span:first-child {
		color: var(--pen-red);
	}

	.knowledge {
		margin-top: 1.25rem;
	}

	.topic-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.75rem 0 0;
	}

	.topic-chip {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.8rem;
		padding: 0.35rem 0.65rem;
		text-transform: none;
		letter-spacing: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
	}

	.topic-highlight {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.outline {
		margin-top: 1rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 1rem 1.25rem 1.15rem;
	}

	.outline-head {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: 0.65rem;
	}

	.outline ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	.outline li {
		display: grid;
		grid-template-columns: minmax(0, 5.5rem) minmax(0, 1fr);
		gap: 0.85rem;
		align-items: baseline;
		color: var(--ink);
		font-size: 0.92rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--rule);
	}

	.outline li:last-child {
		border-bottom: none;
	}

	.outline-week {
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.outline-topic {
		font-size: 0.92rem;
		color: var(--ink);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.materials {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.materials-copy {
		min-width: 0;
	}

	.materials .btn {
		max-width: 100%;
		white-space: normal;
	}

	.materials-title {
		margin: 0.35rem 0 0;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}

	.materials-empty {
		margin: 0.5rem 0 0;
		color: var(--ink-faint);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.upload-material {
		position: relative;
		overflow: hidden;
		max-width: 100%;
		white-space: normal;
	}

	.upload-material input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.timeline {
		margin-top: 1.25rem;
	}

	.timeline-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
	}

	.timeline-item {
		display: grid;
		gap: 0.4rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		min-width: 0;
	}

	.timeline-item.review {
		border-color: var(--pen-red);
	}

	.timeline-item.highlighted {
		background: var(--ink);
		color: var(--paper);
	}

	.timeline-item.highlighted .date,
	.timeline-item.highlighted .timeline-label {
		color: var(--paper);
	}

	.date {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		overflow-wrap: anywhere;
	}

	.timeline-label {
		font-size: 0.92rem;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	@media (max-width: 1024px) {
		.results-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.materials {
			flex-direction: column;
			align-items: flex-start;
		}
		.timeline-list {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 520px) {
		.data-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		.sync-bar-action,
		.sync-bar-action .btn {
			width: 100%;
		}
	}
</style>
