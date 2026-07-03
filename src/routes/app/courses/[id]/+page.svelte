<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import DocumentViewer from '$lib/components/course-materials/DocumentViewer.svelte';
	import CourseEditDialog from '$lib/components/course/CourseEditDialog.svelte';

	type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';

	type Course = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		tag?: string;
		color?: string;
		signals?: {
			status?: CourseStatus;
			riskLevel?: RiskLevel;
			currentGrade?: number;
			projectedGrade?: number;
			deadlinesThisWeek?: number;
			nextDeadline?: string;
			studyHours?: number;
			materialCount?: number;
			noteCount?: number;
			requirementGroup?: string;
			topics?: string[];
		};
	};

	type Semester = { id: string; term: string; year: number; order: number };

	type Edge = {
		id?: string;
		source: string;
		target: string;
		label?: string;
		type?: string;
	};

	type Material = {
		id: string;
		courseId: string;
		fileName: string;
		mimeType: string;
		size: number;
		uploadedAt: string;
	};

	let {
		data
	}: {
		data: {
			course: Course;
			semester: Semester | null;
			semesters: Semester[];
			incoming: Edge[];
			outgoing: Edge[];
			materials: Material[];
			courses: Course[];
		};
	} = $props();

	const course = $derived(data.course);
	const semester = $derived(data.semester);
	const semesters = $derived(data.semesters);
	const incoming = $derived(data.incoming);
	const outgoing = $derived(data.outgoing);
	const materials = $derived(data.materials);
	const coursesById = $derived(new Map(data.courses.map((c) => [c.id, c])));

	const headerTerm = $derived(semester ? `${semester.term} ${semester.year}` : 'No term');

	const status = $derived(course.signals?.status ?? 'planned');
	const statusLabel = $derived(status.replaceAll('-', ' '));

	const statusVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		status === 'completed'
			? 'ok'
			: status === 'at-risk'
				? 'crit'
				: status === 'active'
					? 'warn'
					: 'idle'
	);

	const riskLabel = $derived(course.signals?.riskLevel ?? 'none');

	const riskVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		riskLabel === 'high'
			? 'crit'
			: riskLabel === 'medium'
				? 'warn'
				: riskLabel === 'low'
					? 'ok'
					: 'idle'
	);

	const topics = $derived(course.signals?.topics ?? []);

	function edgeLabel(edge: Edge): string {
		return edge.type?.replaceAll('-', ' ') ?? edge.label ?? 'related';
	}

	const backHref = $derived.by(() => {
		const from = $page.url.searchParams.get('from');
		if (from && from.startsWith('/') && !from.startsWith('//')) return from;
		return resolveRoute('/app/courses/manage');
	});

	function goBack() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- backHref is a user-supplied ?from= param, validated to be an internal path
		void goto(backHref);
	}

	let showEditModal = $state(false);

	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let dragOver = $state(false);
	let deletingId = $state<string | null>(null);
	let selectedMaterial = $state<Material | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	const totalSize = $derived(materials.reduce((sum, m) => sum + m.size, 0));

	async function onFiles(files: FileList | File[] | null) {
		if (!files || (files as FileList).length === 0) return;
		uploading = true;
		uploadError = null;
		try {
			for (const file of Array.from(files as FileList)) {
				const form = new FormData();
				form.append('file', file);
				const res = await fetch(
					`/api/courses/${course.id}/materials?from=${encodeURIComponent($page.url.pathname + $page.url.search)}`,
					{ method: 'POST', body: form }
				);
				if (!res.ok) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null;
					uploadError = body?.error ?? `Upload failed (${res.status})`;
					return;
				}
			}
			await invalidateAll();
		} catch {
			uploadError = 'Upload failed. Is the server running?';
		} finally {
			uploading = false;
		}
	}

	function onFileInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void onFiles(input.files);
		input.value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		void onFiles(event.dataTransfer?.files ?? null);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	async function startRename(material: Material) {
		renamingId = material.id;
		renameValue = material.fileName;
	}

	async function commitRename() {
		if (!renamingId || !renameValue.trim()) return;
		const id = renamingId;
		renamingId = null;
		try {
			const res = await fetch(`/api/courses/${course.id}/materials`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, fileName: renameValue.trim() })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				uploadError = body?.error ?? 'Rename failed';
				return;
			}
			await invalidateAll();
		} catch {
			uploadError = 'Rename failed. Is the server running?';
		} finally {
			renamingId = null;
		}
	}

	function cancelRename() {
		renamingId = null;
		renameValue = '';
	}

	async function deleteMaterial(id: string) {
		if (deletingId) return;
		deletingId = id;
		try {
			const res = await fetch(`/api/courses/${course.id}/materials`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) {
				uploadError = 'Delete failed';
				return;
			}
			await invalidateAll();
		} catch {
			uploadError = 'Delete failed. Is the server running?';
		} finally {
			deletingId = null;
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function canPreview(material: Material): boolean {
		const name = material.fileName.toLowerCase();
		const mime = material.mimeType.toLowerCase();
		return (
			mime === 'application/pdf' ||
			name.endsWith('.pdf') ||
			mime.includes('wordprocessingml') ||
			mime.includes('msword') ||
			name.endsWith('.docx') ||
			mime.includes('presentationml') ||
			mime.includes('powerpoint') ||
			name.endsWith('.pptx')
		);
	}

	function closeViewer() {
		selectedMaterial = null;
	}

	function fileKind(mime: string): string {
		if (mime.startsWith('application/pdf')) return 'PDF';
		if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Slides';
		if (mime.includes('word') || mime.includes('document')) return 'Doc';
		if (mime.startsWith('image/')) return 'Image';
		if (mime.startsWith('video/')) return 'Video';
		if (mime.startsWith('audio/')) return 'Audio';
		if (mime.startsWith('text/')) return 'Text';
		return 'File';
	}
</script>

<svelte:head><title>Synapse · {course.code}</title></svelte:head>

<div class="page page-enter">
	<button class="back-link font-mono" onclick={goBack}>← back</button>

	<div class="page-cover">
		<div class="cover-head">
			<div class="cover-meta">
				<h1 class="page-title font-display">{course.code}</h1>
				<p class="course-name">{course.name}</p>
				<p class="course-line font-mono">
					{#if semester}{semester.term} {semester.year} ·
					{/if}
					{#if course.instructor}{course.instructor} ·
					{/if}
					{#if course.credits !== undefined}{course.credits} credit{course.credits === 1
							? ''
							: 's'}{/if}
				</p>
				{#if course.tag || course.signals?.requirementGroup}
					<div class="course-tags">
						{#if course.tag}
							<span class="tag-chip font-mono">{course.tag}</span>
						{/if}
						{#if course.signals?.requirementGroup}
							<span class="tag-chip tag-chip-req font-mono">{course.signals.requirementGroup}</span>
						{/if}
					</div>
				{/if}
			</div>
			<button class="btn btn-secondary btn-sm" onclick={() => (showEditModal = true)}>edit</button>
		</div>

		<div class="state-strip" aria-label="Course state">
			<div class="state-cell">
				<span class="state-label font-mono">Status</span>
				<span class="state-value state-{statusVariant} font-display">{statusLabel}</span>
			</div>
			<div class="state-cell">
				<span class="state-label font-mono">Grade</span>
				<span class="state-value font-display">
					{#if course.signals?.currentGrade !== undefined}
						{course.signals.currentGrade}
					{:else}
						<span class="state-empty">—</span>
					{/if}
				</span>
			</div>
			<div class="state-cell">
				<span class="state-label font-mono">Risk</span>
				<span class="state-value state-{riskVariant} font-display">{riskLabel}</span>
			</div>
			{#if course.signals?.nextDeadline}
				<div class="state-cell">
					<span class="state-label font-mono">Next</span>
					<span class="state-value state-next font-display">{course.signals.nextDeadline}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if topics.length > 0}
		<section class="block">
			<header class="block-head">
				<h2 class="block-title font-mono">Topics</h2>
				<span class="block-meta font-mono">{topics.length}</span>
			</header>
			<div class="topic-list">
				{#each topics as topic (topic)}
					<span class="topic-chip font-mono">{topic}</span>
				{/each}
			</div>
		</section>
	{/if}

	<section class="block">
		<header class="block-head">
			<h2 class="block-title font-mono">Connections</h2>
			<span class="block-meta font-mono">{incoming.length + outgoing.length}</span>
		</header>

		{#if incoming.length === 0 && outgoing.length === 0}
			<p class="empty font-mono">No saved connections to other courses.</p>
		{:else}
			{#if incoming.length > 0}
				<div class="conn-group">
					<div class="conn-label font-mono">Prereqs feed in</div>
					<ul class="conn-list">
						{#each incoming as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
							{@const source = coursesById.get(edge.source)}
							<li class="conn-row">
								<span class="conn-source font-mono">
									{#if source}{source.code} · {source.name}{:else}—{/if}
								</span>
								<span class="conn-arrow font-mono" aria-hidden="true">→</span>
								<span class="conn-this font-mono">this course</span>
								<span class="conn-type font-mono">{edgeLabel(edge)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if outgoing.length > 0}
				<div class="conn-group">
					<div class="conn-label font-mono">This course unlocks</div>
					<ul class="conn-list">
						{#each outgoing as edge (edge.id ?? `${edge.source}-${edge.target}-${edge.type}`)}
							{@const target = coursesById.get(edge.target)}
							<li class="conn-row">
								<span class="conn-this font-mono">this course</span>
								<span class="conn-arrow font-mono" aria-hidden="true">→</span>
								<span class="conn-source font-mono">
									{#if target}{target.code} · {target.name}{:else}—{/if}
								</span>
								<span class="conn-type font-mono">{edgeLabel(edge)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</section>

	<section class="block">
		<header class="block-head">
			<h2 class="block-title font-mono">Materials</h2>
			<span class="block-meta font-mono">
				{materials.length}{materials.length > 0 ? ` · ${formatSize(totalSize)}` : ''}
			</span>
		</header>

		<label
			class="drop-zone"
			class:drop-zone-active={dragOver}
			class:drop-zone-busy={uploading}
			ondrop={onDrop}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
		>
			<input
				type="file"
				multiple
				class="drop-zone-input"
				onchange={onFileInput}
				disabled={uploading}
				aria-label="Upload course materials"
			/>
			<span class="drop-title font-display">
				{uploading ? 'Uploading…' : 'Drop files here'}
			</span>
			<span class="drop-subtitle font-mono">
				or choose files · pdf, slides, docs, images, anything course-related
			</span>
		</label>

		{#if uploadError}
			<p class="upload-error font-mono">{uploadError}</p>
		{/if}

		{#if materials.length === 0}
			<p class="empty font-mono">No materials uploaded yet.</p>
		{:else}
			<ul class="material-list">
				{#each materials as material (material.id)}
					<li class="material-row" class:material-deleting={deletingId === material.id}>
						<div class="material-kind font-mono">{fileKind(material.mimeType)}</div>
						<div class="material-info">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is an API download endpoint, not an app route -->
							{#if renamingId === material.id}
								<input
									type="text"
									class="rename-input font-mono"
									bind:value={renameValue}
									onkeydown={(e) => {
										if (e.key === 'Enter') commitRename();
										if (e.key === 'Escape') cancelRename();
									}}
									onblur={commitRename}
									autofocus
									aria-label="Rename file"
								/>
							{:else}
								<a
									class="material-name"
									href={`/api/courses/${course.id}/materials/${material.id}/download`}
									download={material.fileName}
									aria-label={`Download ${material.fileName}`}
								>
									{material.fileName}
								</a>
							{/if}
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<div class="material-meta font-mono">
								{formatSize(material.size)} · uploaded {formatDate(material.uploadedAt)}
							</div>
						</div>
						<div class="material-actions">
							{#if canPreview(material)}
								<button
									type="button"
									class="btn btn-secondary btn-sm material-action"
									onclick={() => (selectedMaterial = material)}
									aria-label={`Preview ${material.fileName}`}
								>
									preview
								</button>
							{/if}
							<button
								type="button"
								class="btn btn-ghost btn-sm material-action"
								disabled={renamingId !== null}
								onclick={() => startRename(material)}
								aria-label={`Rename ${material.fileName}`}
							>
								rename
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-sm material-delete material-action"
								disabled={deletingId !== null}
								onclick={() => deleteMaterial(material.id)}
								aria-label={`Delete ${material.fileName}`}
							>
								{deletingId === material.id ? '…' : 'delete'}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if course.signals && (course.signals.deadlinesThisWeek || course.signals.studyHours || course.signals.materialCount || course.signals.noteCount)}
		<section class="block">
			<header class="block-head">
				<h2 class="block-title font-mono">Activity</h2>
			</header>
			<dl class="activity">
				{#if course.signals.deadlinesThisWeek !== undefined}
					<div class="activity-row">
						<dt>Deadlines this week</dt>
						<dd>{course.signals.deadlinesThisWeek}</dd>
					</div>
				{/if}
				{#if course.signals.studyHours !== undefined}
					<div class="activity-row">
						<dt>Study hours</dt>
						<dd>{course.signals.studyHours}</dd>
					</div>
				{/if}
				{#if course.signals.materialCount !== undefined}
					<div class="activity-row">
						<dt>Materials</dt>
						<dd>{course.signals.materialCount}</dd>
					</div>
				{/if}
				{#if course.signals.noteCount !== undefined}
					<div class="activity-row">
						<dt>Notes</dt>
						<dd>{course.signals.noteCount}</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}
</div>

<DocumentViewer
	material={selectedMaterial}
	open={selectedMaterial !== null}
	onClose={closeViewer}
/>

<CourseEditDialog bind:open={showEditModal} {course} {semesters} />

<style>
	.page {
		max-width: 900px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 1rem;
		padding: 0;
		border: none;
		background: none;
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		cursor: pointer;
		transition: color 0.12s var(--ease-out-quart);
	}

	.back-link:hover {
		color: var(--ink);
	}

	.page-cover {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}

	.cover-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.cover-meta {
		flex: 1;
		min-width: 0;
	}

	.page-title {
		font-size: clamp(2.6rem, 5vw, 3.4rem);
		color: var(--ink);
		margin: 0 0 0.4rem;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	.course-name {
		font-family: var(--font-display);
		font-size: 1.4rem;
		color: var(--ink);
		margin: 0 0 0.5rem;
		line-height: 1.2;
	}

	.course-line {
		font-size: 0.78rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}

	.course-tags {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.tag-chip {
		padding: 0.2rem 0.55rem;
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
		font-size: 0.7rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.tag-chip-req {
		background: var(--paper);
	}

	.state-strip {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.state-cell {
		padding: 0.85rem 1rem;
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.state-cell:last-child {
		border-right: 0;
	}

	.state-label {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.state-value {
		font-size: 1.4rem;
		color: var(--ink);
		line-height: 1;
	}

	.state-empty {
		color: var(--ink-faint);
	}

	.state-next {
		font-size: 0.95rem;
	}

	.block {
		padding-block: 1.25rem;
		border-bottom: 1px solid var(--rule);
	}

	.block:last-of-type {
		border-bottom: none;
	}

	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.85rem;
	}

	.block-title {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-weight: 500;
		margin: 0;
	}

	.block-meta {
		font-size: 0.7rem;
		color: var(--ink-faint);
	}

	.topic-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.topic-chip {
		padding: 0.25rem 0.6rem;
		background: var(--paper);
		border: 1px solid var(--rule);
		font-size: 0.72rem;
		color: var(--ink);
	}

	.rename-input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.15rem 0.3rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.9rem;
		outline: none;
	}

	.empty {
		font-size: 0.78rem;
		color: var(--ink-faint);
		margin: 0;
	}

	.conn-group + .conn-group {
		margin-top: 1rem;
	}

	.conn-label {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.conn-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.conn-row {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: var(--paper);
		border: 1px solid var(--rule);
		font-size: 0.85rem;
	}

	.conn-source {
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.conn-arrow {
		color: var(--ink-soft);
	}

	.conn-this {
		color: var(--ink-faint);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.conn-type {
		color: var(--ink-soft);
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.1em;
	}

	.activity {
		margin: 0;
		display: grid;
		gap: 0.4rem;
	}

	.activity-row {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
		border-bottom: 1px dashed var(--rule);
	}

	.activity-row:last-child {
		border-bottom: none;
	}

	.activity-row dt {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.activity-row dd {
		font-size: 0.85rem;
		color: var(--ink);
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1.5rem;
		margin-bottom: 0.85rem;
		border: 1px dashed var(--rule);
		background: var(--paper);
		cursor: pointer;
		text-align: center;
		transition:
			border-color 0.12s,
			background 0.12s;
	}

	.drop-zone:hover,
	.drop-zone-active {
		border-color: var(--ink);
		background: var(--paper-shelf);
	}

	.drop-zone-busy {
		opacity: 0.6;
		cursor: progress;
	}

	.drop-zone-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		border: 0;
	}

	.drop-title {
		font-size: 1rem;
		color: var(--ink);
	}

	.drop-subtitle {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.upload-error {
		font-size: 0.78rem;
		color: var(--accent);
		margin: 0 0 0.85rem;
	}

	.material-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.material-row {
		display: grid;
		grid-template-columns: 4.5rem 1fr auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.65rem 0.85rem;
		background: var(--paper);
		border: 1px solid var(--rule);
		transition: opacity 0.12s var(--ease-out-quart);
	}

	.material-deleting {
		opacity: 0.4;
	}

	.material-kind {
		font-size: 0.7rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.material-info {
		min-width: 0;
	}

	.material-name {
		display: block;
		font-size: 0.9rem;
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid transparent;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition: border-color 0.12s var(--ease-out-quart);
	}

	.material-name:hover {
		border-bottom-color: var(--accent);
	}

	.material-meta {
		margin-top: 0.2rem;
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.material-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.material-action,
	.material-delete {
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	@media (max-width: 640px) {
		.state-strip {
			grid-template-columns: repeat(2, 1fr);
		}

		.state-cell:nth-child(2) {
			border-right: 0;
		}

		.state-cell:nth-child(-n + 2) {
			border-bottom: 1px solid var(--rule);
		}

		.conn-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		.material-row {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}

		.material-kind {
			order: -1;
		}
	}
</style>
