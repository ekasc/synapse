<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import StatusChip from '$lib/components/catalog/StatusChip.svelte';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';

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

	let { data }: { data: { course: SetupCourse; semester: SetupSemester } } = $props();

	const courseOptions = $derived([
		{
			...data.course,
			term: `${data.semester.term} ${data.semester.year}`
		}
	]);
	const resultHref = $derived(
		resolveRoute('/app/semesters/[semesterId]/courses/[courseId]/syllabus/result', {
			semesterId: data.semester.id,
			courseId: data.course.id
		})
	);

	let syllabus = $state<SyllabusImport | null>(null);
	let selectedCourseId = $state(data.course.id);
	let loadedCourseId = '';
	let selectedSyllabusFileName = $state('');
	let selectedSyllabusFile = $state<File | null>(null);
	let isExtracting = $state(false);
	let isResetting = $state(false);
	let apiError = $state('');

	let activeCourse = $derived(
		courseOptions.find((course) => course.id === selectedCourseId) ?? courseOptions[0] ?? null
	);
	let selectedCourseLabel = $derived(
		activeCourse ? `${activeCourse.code} - ${activeCourse.name}` : 'No course selected'
	);

	$effect(() => {
		const courseId = data.course.id;
		if (loadedCourseId === courseId) return;
		loadedCourseId = courseId;
		selectedCourseId = courseId;
		selectedSyllabusFile = null;
		apiError = '';
		void loadSyllabus(courseId);
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
			await goto(resultHref);
		} catch (error) {
			apiError = error instanceof Error ? error.message : 'Could not extract syllabus';
		} finally {
			isExtracting = false;
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
	<title>Syllabus intelligence · Synapse</title>
</svelte:head>

<div class="page">
	<div class="page-cover">
		<h1 class="page-title">Syllabus intelligence</h1>
		<p class="page-tagline">Upload a course outline. Extract the details students actually need.</p>
		<div class="page-status">
			<StatusChip variant={statusVariant} label={statusLabel} />
		</div>
	</div>

	<section
		class="course-selector surface-polaroid"
		aria-label={`Syllabus for ${selectedCourseLabel}`}
	>
		<div class="course-selector-main">
			<span class="course-selector-label font-mono">Course context</span>
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
	</section>

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
				<span class="drop-title font-hand">Drop syllabus PDF</span>
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

			{#if isExtracting}
				<div class="progress-panel" role="status">
					<LoadingDots label="Extracting syllabus" />
					<span>Extracting from your syllabus PDF.</span>
				</div>
			{:else}
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
			{/if}

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

			{#if syllabus}
				<div class="existing-result">
					<p class="existing-text">
						Syllabus extracted for <strong>{activeCourse?.code || 'this course'}</strong>.
					</p>
					<div class="existing-actions">
						<a href={resultHref} class="btn btn-primary"> View extraction results </a>
						<span class="existing-status font-mono">
							{syllabus.status === 'ready'
								? 'Ready'
								: syllabus.status === 'mocked'
									? 'Sample data'
									: syllabus.status}
						</span>
					</div>
				</div>
			{:else if isExtracting}
				<div class="results-empty">
					<p class="empty-text">
						Extraction in progress. Results will appear on the results page once complete.
					</p>
				</div>
			{:else}
				<div class="results-empty">
					<p class="empty-text">Upload a syllabus PDF to extract student-useful details.</p>
				</div>
			{/if}
		</article>
	</section>
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

	.course-selector-label {
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
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.4rem;
		line-height: 1.1;
	}

	.course-code {
		color: var(--ink-soft);
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

	.workspace {
		display: grid;
		grid-template-columns: minmax(280px, 0.85fr) 1fr;
		gap: 1.25rem;
		align-items: start;
	}

	.upload-panel,
	.results-panel {
		min-width: 0;
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
			border-color 0.12s var(--ease-out-quart),
			background 0.12s var(--ease-out-quart);
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

	/* ── Honest indeterminate extraction state ── */
	.progress-panel {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 1rem 1.25rem;
		color: var(--ink-soft);
		font-size: 0.88rem;
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
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.api-error {
		margin: 0;
		padding: 0.65rem 0.85rem;
		color: var(--pen-red);
		background: rgba(194, 54, 42, 0.08);
		border: 1px solid var(--pen-red);
		font-size: 0.8rem;
		line-height: 1.4;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* ── Existing result state ── */
	.existing-result {
		margin-top: 0.5rem;
	}

	.existing-text {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0 0 1rem;
	}

	.existing-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.existing-status {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
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

	@media (max-width: 1024px) {
		.course-selector {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.workspace {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
