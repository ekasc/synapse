<script lang="ts">
	import { onMount } from 'svelte';

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

	const extractionItems = [
		'Professor contact',
		'Office hours',
		'Exam dates',
		'Quiz dates',
		'Deadlines',
		'Grading scheme',
		'Required materials',
		'Key knowledge'
	];

	let syllabus = $state<SyllabusImport | null>(null);
	let selectedSyllabusFileName = $state('CSIS 4495 Syllabus.pdf');
	let isExtracting = $state(false);
	let apiError = $state('');

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

	onMount(() => {
		void loadSyllabus();
	});

	async function loadSyllabus() {
		try {
			const response = await fetch('/api/syllabus');
			if (!response.ok) throw new Error('Could not load syllabus extraction');
			syllabus = (await response.json()) as SyllabusImport;
			selectedSyllabusFileName = syllabus.fileName;
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not load syllabus extraction';
		}
	}

	function onSyllabusFileChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) selectedSyllabusFileName = file.name;
	}

	async function extractSyllabus() {
		isExtracting = true;
		apiError = '';
		try {
			const response = await fetch('/api/syllabus/extract', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fileName: selectedSyllabusFileName })
			});
			if (!response.ok) throw new Error('Could not extract syllabus');
			syllabus = (await response.json()) as SyllabusImport;
			selectedSyllabusFileName = syllabus.fileName;
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not extract syllabus';
		} finally {
			isExtracting = false;
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
				body: JSON.stringify({ fileName: file.name })
			});
			if (!response.ok) throw new Error('Could not save textbook');
			syllabus = (await response.json()) as SyllabusImport;
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not save textbook';
		}
	}
</script>

<svelte:head>
	<title>Syllabus Intelligence · Synapse</title>
</svelte:head>

<div class="page">
	<header class="page-head">
		<div>
			<h1 class="page-title font-hand">Syllabus Intelligence</h1>
			<p class="page-subtitle">
				Upload a course outline. Extract the details students actually need.
			</p>
		</div>

		<div class="status-stack" aria-label="Extraction status">
			<span class="status-pill font-mono">Ready to import</span>
			<span class="confidence font-mono">AI extraction confidence 92%</span>
		</div>
	</header>

	<section class="workspace" aria-label="Syllabus extraction workspace">
		<aside class="upload-panel">
			<div class="panel-head">
				<h2 class="panel-title font-mono">Upload syllabus PDF</h2>
				<span class="panel-mark font-hand">parser</span>
			</div>

			<label class="drop-zone">
				<input
					type="file"
					accept="application/pdf"
					aria-label="Upload syllabus PDF"
					onchange={onSyllabusFileChange}
				/>
				<span class="drop-title">Drop syllabus PDF here</span>
				<span class="drop-subtitle font-mono">or choose a file</span>
			</label>

			<div class="file-row">
				<div>
					<span class="file-name">{selectedSyllabusFileName}</span>
					<span class="file-meta font-mono">12 pages · ready</span>
				</div>
				<span class="file-badge font-mono">PDF</span>
			</div>

			<div class="extract-list">
				<h3 class="list-title font-mono">Extract key points</h3>
				<ul>
					{#each extractionItems as item}
						<li>
							<span aria-hidden="true">✓</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>

			<div class="upload-actions">
				<button type="button" class="primary-btn" disabled={isExtracting} onclick={extractSyllabus}>
					{isExtracting ? 'extracting...' : 'extract syllabus'}
				</button>
				<button type="button" class="text-btn font-mono">replace file</button>
			</div>

			{#if apiError}
				<p class="api-error">{apiError}</p>
			{/if}
		</aside>

		<article class="results-panel">
			<div class="results-head">
				<h2 class="results-title font-mono">Extracted from CSIS 4495</h2>
				<span class="review-note font-hand">check quiz dates</span>
			</div>

			<div class="results-grid">
				<section class="data-group">
					<h3 class="group-title font-mono">Professor contact</h3>
					<dl>
						{#each professorRows as row}
							<div class="data-row">
								<dt>{row[0]}</dt>
								<dd>{row[1]}</dd>
							</div>
						{/each}
					</dl>
				</section>

				<section class="data-group">
					<h3 class="group-title font-mono">Course logistics</h3>
					<dl>
						{#each logisticsRows as row}
							<div class="data-row">
								<dt>{row[0]}</dt>
								<dd>{row[1]}</dd>
							</div>
						{/each}
					</dl>
				</section>

				<section class="data-group">
					<h3 class="group-title font-mono">Important dates</h3>
					<dl>
						{#each dateRows as row}
							<div class="data-row" class:needs-review={row.needsReview}>
								<dt>{row.label}</dt>
								<dd>{row.date}</dd>
							</div>
						{/each}
					</dl>
				</section>

				<section class="data-group">
					<h3 class="group-title font-mono">Grading scheme</h3>
					<dl>
						{#each gradingRows as row}
							<div class="data-row">
								<dt>{row.label}</dt>
								<dd>{row.weight}%</dd>
							</div>
						{/each}
					</dl>
				</section>
			</div>

			<section class="knowledge">
				<div class="knowledge-head">
					<div>
						<h3 class="group-title font-mono">Key knowledge extracted</h3>
						<p class="knowledge-source font-mono">summary + syllabus outline</p>
					</div>
					<span class="panel-mark font-hand">study map</span>
				</div>

				<div class="topic-list" aria-label="Study topics extracted from syllabus">
					{#each knowledgeTopics as topic}
						<span class:topic-highlight={topic === extracted?.keyKnowledge.highlightedTopic}
							>{topic}</span
						>
					{/each}
				</div>

				<div class="outline">
					<h4 class="outline-title font-mono">Study from outline</h4>
					<ol>
						{#each outlineRows as row, i}
							<li>
								<span class="outline-number font-mono">{i + 1}</span>
								<span class="outline-week font-mono">{row.range}</span>
								<span>{row.topic}</span>
							</li>
						{/each}
					</ol>
				</div>
			</section>

			<section class="materials">
				<div class="materials-copy">
					<h3 class="group-title font-mono">Required materials</h3>
					{#if textbookUploaded}
						<p>{extracted?.requiredMaterials.textbookTitle}</p>
					{/if}
				</div>
				{#if textbookUploaded}
					<a
						href={extracted?.requiredMaterials.textbookPdfUrl ?? '/textbook.pdf'}
						class="material-btn"
						aria-label="Open textbook PDF"
					>
						Open textbook PDF
					</a>
				{:else}
					<label class="material-btn upload-material">
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
		</article>
	</section>

	<section class="timeline" aria-label="Extracted syllabus timeline">
		<div class="timeline-head">
			<h2 class="timeline-title font-mono">Extracted timeline</h2>
			<span class="timeline-note font-hand">check quiz dates</span>
		</div>

		<ol class="timeline-list">
			{#each dateRows as row}
				<li
					class="timeline-item"
					class:review={row.needsReview}
					class:highlighted={row.label === 'Midterm exam'}
				>
					<span class="date font-mono">{row.date}</span>
					<span>{row.label}</span>
				</li>
			{/each}
		</ol>
	</section>
</div>

<style>
	.page {
		max-width: 1180px;
	}

	.page-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.page-title {
		font-size: 2rem;
		color: var(--ink);
		margin: 0 0 0.25rem;
		line-height: 1;
	}

	.page-subtitle {
		color: var(--ink-soft);
		font-size: 0.9rem;
		margin: 0;
	}

	.status-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
		padding-top: 0.15rem;
	}

	.status-pill {
		border: 1px solid var(--ink);
		border-radius: 999px;
		padding: 0.25rem 0.6rem;
		background: var(--highlight);
		color: var(--ink);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		mix-blend-mode: multiply;
	}

	.confidence {
		color: var(--ink-faint);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(260px, 0.85fr) minmax(440px, 1.4fr);
		gap: 1.25rem;
		align-items: start;
	}

	.upload-panel,
	.results-panel,
	.timeline {
		background: rgba(251, 248, 240, 0.72);
		border: 1px solid rgba(26, 26, 23, 0.12);
		border-radius: 6px;
	}

	.upload-panel {
		padding: 1rem;
	}

	.panel-head,
	.results-head,
	.timeline-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: baseline;
		margin-bottom: 0.85rem;
	}

	.panel-title,
	.results-title,
	.timeline-title,
	.group-title,
	.list-title {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.panel-mark {
		color: var(--ink-faint);
		font-size: 0.95rem;
		font-weight: 400;
	}

	.drop-zone {
		display: grid;
		place-items: center;
		min-height: 158px;
		border: 1.5px dashed var(--ink-faint);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.22);
		cursor: pointer;
		text-align: center;
		padding: 1rem;
		transition:
			border-color 0.12s,
			background 0.12s;
	}

	.drop-zone:hover {
		border-color: var(--ink);
		background: rgba(216, 255, 92, 0.12);
	}

	.drop-zone input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.drop-title {
		display: block;
		color: var(--ink);
		font-size: 0.95rem;
		font-weight: 500;
	}

	.drop-subtitle {
		display: block;
		color: var(--ink-faint);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 0.25rem;
	}

	.file-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 0.85rem;
		padding: 0.7rem;
		border: 1px solid rgba(26, 26, 23, 0.1);
		border-radius: 5px;
		background: #fbf8f0;
	}

	.file-name {
		display: block;
		color: var(--ink);
		font-size: 0.9rem;
		font-weight: 500;
	}

	.file-meta,
	.file-badge {
		color: var(--ink-faint);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.file-badge {
		border: 1px solid rgba(26, 26, 23, 0.14);
		border-radius: 4px;
		padding: 0.18rem 0.35rem;
	}

	.extract-list {
		margin-top: 1rem;
	}

	.extract-list ul {
		list-style: none;
		padding: 0;
		margin: 0.65rem 0 0;
		display: grid;
		gap: 0.45rem;
	}

	.extract-list li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--ink-soft);
		font-size: 0.86rem;
	}

	.extract-list li span {
		display: inline-grid;
		place-items: center;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: var(--highlight);
		color: var(--ink);
		font-size: 0.68rem;
		mix-blend-mode: multiply;
	}

	.upload-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.primary-btn,
	.material-btn {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		border: 1px solid var(--ink);
		border-radius: 5px;
		background: var(--ink);
		color: var(--paper);
		padding: 0.58rem 0.95rem;
		font-family: var(--font-body);
		font-size: 0.86rem;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition:
			transform 0.12s,
			background 0.12s;
	}

	.primary-btn:hover,
	.material-btn:hover {
		background: #2a2a27;
		transform: translateY(-1px);
	}

	.primary-btn:disabled {
		opacity: 0.45;
		cursor: default;
		transform: none;
	}

	.text-btn {
		border: none;
		background: transparent;
		color: var(--ink-faint);
		cursor: pointer;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.text-btn:hover {
		color: var(--ink);
	}

	.api-error {
		margin: 0.8rem 0 0;
		color: var(--pen-red);
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.results-panel {
		padding: 1rem;
		box-shadow: 2px 2px 0 var(--ink);
	}

	.review-note,
	.timeline-note {
		color: var(--pen-red);
		font-size: 0.95rem;
		font-weight: 400;
		transform: rotate(-2deg);
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem 1.25rem;
	}

	.data-group {
		min-width: 0;
	}

	.data-group dl {
		display: grid;
		gap: 0.34rem;
		margin: 0.55rem 0 0;
	}

	.data-row {
		display: grid;
		grid-template-columns: minmax(6.5rem, 0.65fr) minmax(0, 1fr);
		gap: 0.75rem;
		align-items: baseline;
		padding: 0.22rem 0;
		border-bottom: 1px dashed rgba(26, 26, 23, 0.1);
	}

	.data-row dt {
		color: var(--ink-faint);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.data-row dd {
		margin: 0;
		color: var(--ink);
		font-size: 0.9rem;
	}

	.data-row.needs-review dd {
		color: var(--pen-red);
	}

	.knowledge {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px dashed rgba(26, 26, 23, 0.16);
	}

	.knowledge-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 0.75rem;
	}

	.knowledge-source {
		margin: 0.25rem 0 0;
		color: var(--ink-faint);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.topic-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.topic-list span {
		border: 1px solid rgba(26, 26, 23, 0.12);
		border-radius: 999px;
		background: #fbf8f0;
		color: var(--ink-soft);
		font-size: 0.78rem;
		padding: 0.28rem 0.55rem;
	}

	.topic-list .topic-highlight {
		background: var(--highlight);
		color: var(--ink);
		border-color: var(--ink);
		mix-blend-mode: multiply;
	}

	.outline {
		margin-top: 0.85rem;
		border: 1px solid rgba(26, 26, 23, 0.12);
		border-radius: 5px;
		background: rgba(255, 255, 255, 0.18);
		padding: 0.85rem;
	}

	.outline-title {
		margin: 0 0 0.7rem;
		color: var(--ink-soft);
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.outline ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
	}

	.outline li {
		display: grid;
		grid-template-columns: auto 5.5rem 1fr;
		gap: 0.55rem;
		align-items: center;
		color: var(--ink);
		font-size: 0.82rem;
		padding-bottom: 0.55rem;
		border-bottom: 1px dashed rgba(26, 26, 23, 0.12);
	}

	.outline li:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.outline-number {
		display: inline-grid;
		width: 1.25rem;
		height: 1.25rem;
		place-items: center;
		border: 1px solid rgba(26, 26, 23, 0.18);
		border-radius: 999px;
		color: var(--ink-soft);
		font-size: 0.62rem;
	}

	.outline-week {
		color: var(--ink-faint);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		white-space: nowrap;
	}

	.materials {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px dashed rgba(26, 26, 23, 0.16);
	}

	.materials-copy {
		min-width: 0;
	}

	.materials p {
		margin: 0.3rem 0 0;
		color: var(--ink);
		font-size: 0.9rem;
	}

	.material-btn {
		flex-shrink: 0;
		background: transparent;
		color: var(--ink);
	}

	.material-btn:hover {
		background: var(--highlight);
		color: var(--ink);
		mix-blend-mode: multiply;
	}

	.upload-material {
		position: relative;
		overflow: hidden;
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
		padding: 1rem;
	}

	.timeline-list {
		position: relative;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		list-style: none;
		padding: 1rem 0 0;
		margin: 0;
	}

	.timeline-list::before {
		content: '';
		position: absolute;
		top: 0.36rem;
		left: 0;
		right: 0;
		border-top: 1px dashed var(--ink-faint);
	}

	.timeline-item {
		position: relative;
		display: grid;
		gap: 0.25rem;
		padding-top: 0.65rem;
		color: var(--ink);
		font-size: 0.85rem;
	}

	.timeline-item::before {
		content: '';
		position: absolute;
		top: -0.82rem;
		left: 0;
		width: 0.55rem;
		height: 0.55rem;
		border: 1px solid var(--ink);
		border-radius: 999px;
		background: #fbf8f0;
	}

	.timeline-item.review::before {
		border-color: var(--pen-red);
	}

	.timeline-item.highlighted {
		background: var(--highlight);
		mix-blend-mode: multiply;
		padding: 0.65rem 0.45rem 0.25rem;
		border-radius: 3px;
	}

	.date {
		color: var(--ink-soft);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	@media (max-width: 980px) {
		.workspace {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.page-head,
		.materials {
			flex-direction: column;
			align-items: flex-start;
		}

		.status-stack {
			align-items: flex-start;
		}

		.results-grid,
		.timeline-list {
			grid-template-columns: 1fr;
		}

		.outline li {
			grid-template-columns: auto 1fr;
		}

		.outline li span:last-child {
			grid-column: 2;
		}

		.timeline-list::before,
		.timeline-item::before {
			display: none;
		}

		.timeline-item {
			border-top: 1px dashed rgba(26, 26, 23, 0.14);
		}
	}
</style>
