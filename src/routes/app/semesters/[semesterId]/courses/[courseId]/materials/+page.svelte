<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import DocumentViewer from '$lib/components/course-materials/DocumentViewer.svelte';

	type Course = { id: string; code: string; name: string };
	type MaterialIndex = {
		status: 'pending' | 'indexing' | 'ready' | 'needs_ocr' | 'unsupported' | 'failed' | 'too_large';
		pageCount: number | null;
		nextPage: number;
		characterCount: number;
		errorMessage: string | null;
	};

	type Material = {
		id: string;
		courseId: string;
		fileName: string;
		mimeType: string;
		size: number;
		uploadedAt: string;
		index: MaterialIndex;
	};

	let { data }: { data: { course: Course; materials: Material[] } } = $props();
	const course = $derived(data.course);
	const materials = $derived(data.materials);
	const totalSize = $derived(materials.reduce((sum, material) => sum + material.size, 0));

	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let dragOver = $state(false);
	let deletingId = $state<string | null>(null);
	let selectedMaterial = $state<Material | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let indexOverrides = $state<Record<string, MaterialIndex>>({});
	let processingIndexQueue = $state(false);

	function materialIndex(material: Material) {
		return indexOverrides[material.id] ?? material.index;
	}

	function indexLabel(index: MaterialIndex) {
		switch (index.status) {
			case 'pending':
				return 'Waiting to index';
			case 'indexing':
				return index.pageCount
					? `Indexing · ${Math.min(index.nextPage - 1, index.pageCount)} of ${index.pageCount} pages`
					: 'Starting index';
			case 'ready':
				return index.pageCount
					? `Ready · ${index.pageCount} page${index.pageCount === 1 ? '' : 's'}`
					: 'Ready';
			case 'needs_ocr':
				return 'Needs OCR';
			case 'unsupported':
				return 'Not available for Practice';
			case 'too_large':
				return 'Too large to index';
			case 'failed':
				return 'Indexing failed';
		}
	}

	async function processIndexQueue() {
		if (processingIndexQueue) return;
		processingIndexQueue = true;
		try {
			while (true) {
				const material = materials.find((item) => {
					const status = materialIndex(item).status;
					return status === 'pending' || status === 'indexing';
				});
				if (!material) break;
				const response = await fetch(`/api/courses/${course.id}/materials/${material.id}/index`, {
					method: 'POST'
				});
				const body = (await response.json().catch(() => null)) as {
					index?: MaterialIndex;
					error?: string;
				} | null;
				if (body?.index) {
					indexOverrides = { ...indexOverrides, [material.id]: body.index };
				}
				if (!response.ok && body?.index?.status !== 'too_large') {
					uploadError = body?.error ?? `Could not index ${material.fileName}`;
				}
				if (!body?.index) break;
				if (!['pending', 'indexing'].includes(body.index.status)) continue;
			}
			await invalidateAll();
		} catch {
			uploadError = 'Indexing paused. Reload the page to resume.';
		} finally {
			processingIndexQueue = false;
		}
	}

	async function retryIndex(material: Material) {
		indexOverrides = {
			...indexOverrides,
			[material.id]: { ...materialIndex(material), status: 'pending', errorMessage: null }
		};
		void processIndexQueue();
	}

	$effect(() => {
		if (
			materials.some((material) => ['pending', 'indexing'].includes(materialIndex(material).status))
		) {
			void processIndexQueue();
		}
	});

	async function onFiles(files: FileList | File[] | null) {
		if (!files || files.length === 0) return;
		uploading = true;
		uploadError = null;
		try {
			for (const file of Array.from(files)) {
				const form = new FormData();
				form.append('file', file);
				const response = await fetch(
					`/api/courses/${course.id}/materials?from=${encodeURIComponent($page.url.pathname + $page.url.search)}`,
					{ method: 'POST', body: form }
				);
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as { error?: string } | null;
					uploadError = body?.error ?? `Upload failed (${response.status})`;
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

	function startRename(material: Material) {
		renamingId = material.id;
		renameValue = material.fileName;
	}

	async function commitRename() {
		if (!renamingId || !renameValue.trim()) return;
		const id = renamingId;
		try {
			const response = await fetch(`/api/courses/${course.id}/materials`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, fileName: renameValue.trim() })
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
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
			const response = await fetch(`/api/courses/${course.id}/materials`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!response.ok) {
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

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function canPreview(material: Material) {
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

	function fileKind(mime: string) {
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

<svelte:head><title>Synapse · {course.code} materials</title></svelte:head>

<div class="page page-enter">
	<header class="page-cover">
		<div>
			<div class="eyebrow font-mono">Course materials</div>
			<h1 class="page-title font-hand">Materials</h1>
			<p class="page-tagline">Files used by Syllabus and Practice for {course.code}.</p>
		</div>
		<div class="material-total font-mono">
			{materials.length} file{materials.length === 1 ? '' : 's'}
			{materials.length > 0 ? ` · ${formatSize(totalSize)}` : ''}
		</div>
	</header>

	<label
		class="drop-zone"
		class:drop-zone-active={dragOver}
		class:drop-zone-busy={uploading}
		ondrop={onDrop}
		ondragover={onDragOver}
		ondragleave={() => (dragOver = false)}
	>
		<input
			type="file"
			multiple
			class="drop-zone-input"
			onchange={onFileInput}
			disabled={uploading}
			aria-label="Upload course materials"
		/>
		<span class="drop-title font-hand">{uploading ? 'Uploading…' : 'Drop files here'}</span>
		<span class="drop-subtitle font-mono">
			or choose files · pdf, slides, docs, images, anything course-related
		</span>
	</label>

	{#if uploadError}<p class="upload-error" role="alert">{uploadError}</p>{/if}

	{#if materials.length === 0}
		<section class="empty-state">
			<h2 class="font-hand">No materials yet</h2>
			<p>Upload course files here before generating Practice sessions.</p>
		</section>
	{:else}
		<ul class="material-list">
			{#each materials as material (material.id)}
				<li class="material-row" class:material-deleting={deletingId === material.id}>
					<div class="material-kind font-mono">{fileKind(material.mimeType)}</div>
					<div class="material-info">
						{#if renamingId === material.id}
							<input
								type="text"
								class="rename-input"
								bind:value={renameValue}
								onkeydown={(event) => {
									if (event.key === 'Enter') void commitRename();
									if (event.key === 'Escape') cancelRename();
								}}
								onblur={commitRename}
								autofocus
								aria-label="Rename file"
							/>
						{:else}
							<a
								class="material-name"
								href={`/api/courses/${course.id}/materials/${material.id}/download`}
								download={material.fileName}>{material.fileName}</a
							>
						{/if}
						<div class="material-meta font-mono">
							{formatSize(material.size)} · uploaded {formatDate(material.uploadedAt)}
						</div>
						<div
							class="index-status"
							aria-live="polite"
							class:index-ready={materialIndex(material).status === 'ready'}
							class:index-problem={['failed', 'needs_ocr', 'too_large'].includes(
								materialIndex(material).status
							)}
						>
							{indexLabel(materialIndex(material))}
							{#if materialIndex(material).errorMessage}
								<span> · {materialIndex(material).errorMessage}</span>
							{/if}
						</div>
					</div>
					<div class="material-actions">
						{#if materialIndex(material).status === 'failed'}
							<button class="btn btn-secondary btn-sm" onclick={() => retryIndex(material)}
								>retry index</button
							>
						{/if}
						{#if canPreview(material)}
							<button class="btn btn-secondary btn-sm" onclick={() => (selectedMaterial = material)}
								>preview</button
							>
						{/if}
						<button class="btn btn-ghost btn-sm" onclick={() => startRename(material)}
							>rename</button
						>
						<button
							class="btn btn-ghost btn-sm material-delete"
							disabled={deletingId !== null}
							onclick={() => deleteMaterial(material.id)}
							>{deletingId === material.id ? '…' : 'delete'}</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<DocumentViewer
	material={selectedMaterial}
	open={selectedMaterial !== null}
	onClose={() => (selectedMaterial = null)}
/>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}
	.page-cover {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1.25rem;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}
	.eyebrow,
	.material-total {
		color: var(--ink-faint);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.page-title {
		margin: 0.2rem 0 0.35rem;
		font-size: clamp(2rem, 4vw, 2.75rem);
	}
	.page-tagline {
		margin: 0;
		color: var(--ink-soft);
	}
	.drop-zone {
		display: flex;
		min-height: 9rem;
		flex-direction: column;
		justify-content: center;
		gap: 0.35rem;
		padding: 1.5rem;
		margin-bottom: 1rem;
		border: 1px dashed var(--rule);
		background: var(--paper);
		cursor: pointer;
		text-align: center;
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
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.drop-title {
		color: var(--ink);
		font-size: 1.2rem;
	}
	.drop-subtitle {
		color: var(--ink-faint);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.upload-error {
		color: var(--accent);
	}
	.empty-state {
		padding: 2rem;
		border: 1px solid var(--rule);
		text-align: center;
	}
	.empty-state h2,
	.empty-state p {
		margin: 0;
	}
	.empty-state p {
		margin-top: 0.4rem;
		color: var(--ink-soft);
	}
	.material-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}
	.material-row {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}
	.material-deleting {
		opacity: 0.4;
	}
	.material-kind,
	.material-meta {
		color: var(--ink-faint);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.material-info {
		min-width: 0;
	}
	.index-status {
		margin-top: 0.3rem;
		color: var(--ink-soft);
		font-size: 0.78rem;
	}
	.index-ready {
		color: var(--success, #3f684b);
	}
	.index-problem {
		color: var(--accent);
	}
	.material-name {
		display: block;
		overflow: hidden;
		color: var(--ink);
		font-size: 0.9rem;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.material-name:hover {
		text-decoration: underline;
		text-decoration-color: var(--accent);
	}
	.material-meta {
		margin-top: 0.2rem;
	}
	.material-actions {
		display: flex;
		gap: 0.4rem;
	}
	.rename-input {
		width: 100%;
		padding: 0.4rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		font: 0.85rem var(--font-body);
	}
	.material-delete {
		color: var(--accent);
	}
	@media (max-width: 640px) {
		.page-cover {
			align-items: flex-start;
			flex-direction: column;
		}
		.material-row {
			grid-template-columns: minmax(0, 1fr);
		}
		.material-actions {
			flex-wrap: wrap;
		}
	}
</style>
