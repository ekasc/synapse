<script lang="ts">
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import StatusChip from '$lib/components/catalog/StatusChip.svelte';

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

	let { data }: { data: { courses: SetupCourse[]; semesters: SetupSemester[] } } = $props();

	const courseOptions = $derived(
		data.courses.map((course) => {
			const semester = data.semesters.find((item) => item.id === course.semesterId);
			return {
				...course,
				term: semester ? `${semester.term} ${semester.year}` : 'Imported term'
			};
		})
	);

	let syllabus = $state<SyllabusImport | null>(null);
	let selectedCourseId = $state('');
	let selectedSyllabusFileName = $state('');
	let selectedSyllabusFile = $state<File | null>(null);
	let isExtracting = $state(false);
	let isResetting = $state(false);
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
	let activeCourse = $derived(
		courseOptions.find((course) => course.id === selectedCourseId) ?? courseOptions[0] ?? null
	);
	let selectedCourseLabel = $derived(
		activeCourse ? `${activeCourse.code} - ${activeCourse.name}` : 'No course selected'
	);

	$effect(() => {
		if (!selectedCourseId && courseOptions.length > 0) {
			const courseId = courseOptions[0].id;
			selectedCourseId = courseId;
			void loadSyllabus(courseId);
		}
	});

	async function loadSyllabus(courseId = selectedCourseId) {
		if (!courseId) {
			syllabus = null;
			selectedSyllabusFileName = '';
			return;
		}

		try {
			const response = await fetch(`/api/syllabus?courseId=${encodeURIComponent(courseId)}`);
			if (!response.ok) throw new Error('Could not load syllabus extraction');
			syllabus = ((await response.json()) as SyllabusImport | null) ?? null;
			selectedSyllabusFileName = syllabus?.fileName ?? '';
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not load syllabus extraction';
		}
	}

	function changeCourse(event: Event) {
		const courseId = (event.currentTarget as HTMLSelectElement).value;
		selectedCourseId = courseId;
		selectedSyllabusFile = null;
		apiError = '';
		void loadSyllabus(courseId);
	}

	function onSyllabusFileChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		selectedSyllabusFile = file;
		selectedSyllabusFileName = file.name;
	}

	async function extractSyllabus() {
		if (!selectedSyllabusFile) {
			apiError = 'Choose a syllabus PDF first';
			return;
		}
		if (!selectedCourseId) {
			apiError = 'Choose a course before extracting a syllabus';
			return;
		}

		isExtracting = true;
		apiError = '';
		try {
			const body = (() => {
				const form = new FormData();
				form.append('file', selectedSyllabusFile);
				form.append('courseId', selectedCourseId);
				return form;
			})();
			const response = await fetch('/api/syllabus/extract', {
				method: 'POST',
				body
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
				body: JSON.stringify({ fileName: file.name, courseId: selectedCourseId })
			});
			if (!response.ok) throw new Error('Could not save textbook');
			syllabus = (await response.json()) as SyllabusImport;
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not save textbook';
		}
	}

	async function resetSyllabusImport() {
		isResetting = true;
		apiError = '';
		try {
			const response = await fetch(
				`/api/syllabus?courseId=${encodeURIComponent(selectedCourseId)}`,
				{
					method: 'DELETE'
				}
			);
			if (!response.ok) throw new Error('Could not reset syllabus import');
			syllabus = null;
			selectedSyllabusFile = null;
			selectedSyllabusFileName = '';
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not reset syllabus import';
		} finally {
			isResetting = false;
		}
	}

	const statusVariant = $derived(syllabus?.status === 'error' ? 'crit' : 'ok');
	const statusLabel = $derived(
		syllabus?.status === 'ready'
			? 'Ready'
			: syllabus?.status === 'mocked'
				? 'Sample data'
				: syllabus?.status === 'error'
					? 'Error'
					: 'Empty'
	);
</script>

<svelte:head>
	<title>Syllabus Intelligence · Synapse</title>
</svelte:head>

<CatalogHeader term="Syllabus" />

<div class="page">
	<div class="page-cover">
		<h1 class="page-title font-hand">Syllabus Intelligence</h1>
		<p class="page-tagline">
			{#if syllabus}
				{syllabus.fileName} · {statusLabel}
			{:else}
				Upload a course outline. Extract the details students actually need.
			{/if}
		</p>
		<div class="page-status">
			<StatusChip variant={statusVariant} label={statusLabel} />
		</div>
	</div>

	<section
		class="course-selector surface-polaroid"
		aria-label={`Syllabus course selector for ${selectedCourseLabel}`}
	>
		<div class="course-selector-main">
			<span class="course-selector-label font-mono">Course syllabus selector</span>
			<h2 class="course-selector-title">
				{#if activeCourse}
					<span class="course-code font-mono">{activeCourse.code}</span>
					{activeCourse.name}
				{:else}
					No course selected
				{/if}
			</h2>
			{#if activeCourse}
				<div class="course-selector-meta">
					<span>{activeCourse.term}</span>
					<span>{activeCourse.instructor ?? 'Instructor TBD'}</span>
					<span>{syllabus ? syllabus.fileName : 'No syllabus saved'}</span>
				</div>
			{/if}
		</div>

		<label class="course-select-box">
			<span class="field-label font-mono">Switch course</span>
			<div class="select-shell">
				<select
					value={selectedCourseId}
					disabled={courseOptions.length === 0 || isExtracting || isResetting}
					onchange={changeCourse}
				>
					{#each courseOptions as course (course.id)}
						<option value={course.id}>{course.code} - {course.name}</option>
					{/each}
				</select>
				<span class="dropdown-arrow" aria-hidden="true">v</span>
			</div>
		</label>
	</section>

	{#if courseOptions.length === 0}
		<section class="surface-polaroid empty-course-state" aria-label="No courses available">
			<span class="course-selector-label font-mono">No courses imported</span>
			<h2>No course syllabus can be linked yet</h2>
			<p>Import courses during setup before saving a syllabus to a course.</p>
		</section>
	{/if}

	<section class="workspace" aria-label="Syllabus extraction workspace">
		<aside class="upload-panel surface-polaroid">
			<SectionHead
				title="Upload syllabus PDF"
				meta={selectedSyllabusFileName ? 'SELECTED' : 'EMPTY'}
			/>

			<label class="drop-zone">
				<input
					type="file"
					accept="application/pdf"
					aria-label="Upload syllabus PDF"
					disabled={!selectedCourseId || isExtracting || isResetting}
					onchange={onSyllabusFileChange}
				/>
				<span class="drop-title font-display">Drop syllabus PDF</span>
				<span class="drop-subtitle font-mono">or choose a file · PDF only</span>
			</label>

			{#if selectedSyllabusFileName}
				<div class="file-row">
					<div class="file-info">
						<span class="file-name">{selectedSyllabusFileName}</span>
					</div>
					<span class="file-badge font-mono">PDF</span>
				</div>
			{/if}

			<div class="extract-list">
				<div class="extract-list-head font-mono">Extracted points</div>
				<ul>
					{#each extractionItems as item, i (i)}
						<li>
							<span class="check font-mono" aria-hidden="true">✓</span>
							<span>{item}</span>
						</li>
					{/each}
				</ul>
			</div>

			<div class="upload-actions">
				<button
					type="button"
					class="btn btn-primary"
					disabled={isExtracting || isResetting || !selectedCourseId}
					onclick={extractSyllabus}
				>
					{isExtracting ? 'extracting…' : 'extract syllabus'}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-sm font-mono"
					disabled={isExtracting || isResetting || !syllabus}
					onclick={resetSyllabusImport}
				>
					{isResetting ? 'resetting' : 'reset import'}
				</button>
				<button type="button" class="btn btn-ghost btn-sm font-mono">replace file</button>
			</div>

			{#if apiError}
				<p class="api-error font-mono">{apiError}</p>
			{/if}
		</aside>

		<article class="results-panel surface-polaroid">
			<SectionHead
				title="Extracted data"
				meta={syllabus ? `FROM · ${syllabus.fileName}` : 'WAITING'}
			/>

			{#if extracted}
				<div class="results-grid">
					<section class="data-group">
						<div class="data-group-head">
							<span class="group-index font-mono">01</span>
							<h3 class="group-title font-mono">Professor contact</h3>
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

					<section class="data-group">
						<div class="data-group-head">
							<span class="group-index font-mono">02</span>
							<h3 class="group-title font-mono">Course logistics</h3>
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

					<section class="data-group">
						<div class="data-group-head">
							<span class="group-index font-mono">03</span>
							<h3 class="group-title font-mono">Important dates</h3>
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

					<section class="data-group">
						<div class="data-group-head">
							<span class="group-index font-mono">04</span>
							<h3 class="group-title font-mono">Grading scheme</h3>
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

				<section class="knowledge">
					<SectionHead
						eyebrow="Section 05"
						title="Key knowledge"
						meta={extracted.keyKnowledge.source}
					/>

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
									<span class="outline-number font-mono">{String(i + 1).padStart(2, '0')}</span>
									<span class="outline-week font-mono">{row.range}</span>
									<span class="outline-topic">{row.topic}</span>
								</li>
							{/each}
						</ol>
					</div>
				</section>

				<section class="materials">
					<div class="materials-copy">
						<div class="materials-eyebrow font-mono">Section 06</div>
						<h3 class="group-title font-mono">Required materials</h3>
						{#if textbookUploaded}
							<p class="materials-title font-display">
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
								disabled={!selectedCourseId}
								onchange={uploadTextbook}
							/>
							Upload textbook PDF
						</label>
					{/if}
				</section>
			{:else}
				<div class="results-empty">
					<p class="empty-text">Upload a syllabus PDF to see extracted data here.</p>
				</div>
			{/if}
		</article>
	</section>

	{#if dateRows.length > 0}
		<section class="timeline" aria-label="Extracted syllabus timeline">
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
</div>

<style>
	.page {
		max-width: 1100px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
	}

	.page-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.course-selector {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.45fr);
		gap: 1.25rem;
		align-items: end;
		padding: 1.25rem 1.5rem;
		margin-bottom: 1.25rem;
	}

	.course-selector-label,
	.field-label {
		display: block;
		color: var(--ink-faint);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.course-selector-title {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.7rem;
		margin: 0.45rem 0 0;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.4rem;
		line-height: 1.1;
	}

	.course-code {
		color: var(--accent);
		font-size: 0.82rem;
		letter-spacing: 0.12em;
	}

	.course-selector-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}

	.course-selector-meta span {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink-soft);
		font-size: 0.78rem;
		padding: 0.35rem 0.5rem;
	}

	.course-select-box {
		display: grid;
		gap: 0.45rem;
	}

	.select-shell {
		position: relative;
	}

	.select-shell select {
		width: 100%;
		min-height: 2.75rem;
		border: 1.5px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		padding: 0.65rem 2.2rem 0.65rem 0.75rem;
		appearance: none;
	}

	.select-shell select:disabled {
		color: var(--ink-faint);
		border-color: var(--rule);
		cursor: not-allowed;
	}

	.dropdown-arrow {
		position: absolute;
		right: 0.65rem;
		top: 50%;
		display: grid;
		place-items: center;
		width: 1.15rem;
		height: 1.15rem;
		border: 1px solid var(--ink);
		background: var(--highlight);
		color: var(--ink);
		font-size: 0.75rem;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.empty-course-state {
		margin-bottom: 1.25rem;
		padding: 1.25rem 1.5rem;
	}

	.empty-course-state h2 {
		margin: 0.4rem 0 0;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.35rem;
	}

	.empty-course-state p {
		margin: 0.45rem 0 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(280px, 0.85fr) 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.upload-panel,
	.results-panel,
	.timeline {
		padding: 1.25rem 1.5rem 1.5rem;
	}

	.upload-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.drop-zone {
		display: grid;
		place-items: center;
		min-height: 160px;
		border: 1.5px dashed var(--rule);
		cursor: pointer;
		text-align: center;
		padding: 1rem;
		transition:
			border-color 0.12s,
			background 0.12s;
		position: relative;
	}

	.drop-zone:hover {
		border-color: var(--ink);
		background: var(--paper);
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
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.drop-subtitle {
		display: block;
		color: var(--ink-faint);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-top: 0.35rem;
	}

	.file-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.file-name {
		color: var(--ink);
		font-size: 0.9rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-badge {
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		border: 1px solid var(--rule);
		padding: 0.25rem 0.55rem;
		flex-shrink: 0;
	}

	.extract-list-head {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.extract-list ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: grid;
		gap: 0.5rem;
	}

	.extract-list li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--ink-soft);
		font-size: 0.88rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--rule);
	}

	.extract-list li:last-child {
		border-bottom: none;
	}

	.check {
		display: inline-grid;
		place-items: center;
		min-width: 1.15rem;
		height: 1.15rem;
		background: var(--ink);
		color: var(--paper);
		font-size: 0.7rem;
		flex-shrink: 0;
	}

	.upload-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.api-error {
		margin: 0;
		padding: 0.65rem 0.85rem;
		color: var(--accent);
		background: rgba(176, 58, 46, 0.08);
		border: 1px solid var(--accent);
		font-size: 0.8rem;
		line-height: 1.4;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.results-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem 1.5rem;
		margin-top: 0.5rem;
	}

	.data-group {
		min-width: 0;
	}

	.data-group-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--ink);
	}

	.group-index {
		font-size: 0.72rem;
		color: var(--ink-faint);
		letter-spacing: 0.14em;
	}

	.group-title {
		margin: 0;
		color: var(--ink);
		font-size: 0.95rem;
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		font-family: var(--font-display);
	}

	.data-group dl {
		display: grid;
		gap: 0.3rem;
		margin: 0;
	}

	.data-row {
		display: grid;
		grid-template-columns: minmax(7rem, 0.5fr) minmax(0, 1fr);
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
	}

	.data-row dd {
		margin: 0;
		color: var(--ink);
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		justify-content: space-between;
	}

	.data-row.needs-review dd > span:first-child {
		color: var(--accent);
	}

	.knowledge {
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--ink);
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
		grid-template-columns: 2.25rem 5.5rem 1fr;
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

	.outline-number {
		font-size: 0.8rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-align: center;
	}

	.outline-week {
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.outline-topic {
		font-size: 0.92rem;
		color: var(--ink);
	}

	.materials {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--ink);
	}

	.materials-copy {
		min-width: 0;
	}

	.materials-eyebrow {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		margin-bottom: 0.25rem;
	}

	.materials-title {
		margin: 0.35rem 0 0;
		color: var(--ink);
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.01em;
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
	}

	.upload-material input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}

	.results-empty {
		padding: 3rem 1rem;
		text-align: center;
	}

	.empty-text {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0;
	}

	.timeline {
		margin-top: 1.5rem;
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
	}

	.timeline-item.review {
		border-color: var(--accent);
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
	}

	.timeline-label {
		font-size: 0.92rem;
		color: var(--ink);
	}

	@media (max-width: 1024px) {
		.course-selector {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.workspace {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.materials {
			flex-direction: column;
			align-items: flex-start;
		}

		.results-grid {
			grid-template-columns: 1fr;
		}

		.timeline-list {
			grid-template-columns: 1fr;
		}

		.outline li {
			grid-template-columns: auto 1fr;
		}

		.outline li .outline-topic {
			grid-column: 2;
		}
	}
</style>
