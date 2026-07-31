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

	let ocrRun = $state<{ materialId: string; page: number; total: number } | null>(null);

	// Workers have no canvas, so the browser renders each scanned page and the
	// server transcribes it. Pages are sent one at a time; done:true finalizes.
	async function runOcr(material: Material) {
		const total = materialIndex(material).pageCount ?? 0;
		if (total === 0 || ocrRun) return;
		ocrRun = { materialId: material.id, page: 0, total };
		try {
			const pdfjs = (await import('pdfjs-dist')) as typeof import('pdfjs-dist');
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(
				'pdfjs-dist/build/pdf.worker.min.mjs',
				import.meta.url
			).toString();
			const download = await fetch(`/api/courses/${course.id}/materials/${material.id}/download`);
			if (!download.ok) throw new Error('the file could not be downloaded');
			const doc = await pdfjs.getDocument({ data: await download.arrayBuffer() }).promise;
			const canvas = document.createElement('canvas');
			const context = canvas.getContext('2d');
			if (!context) throw new Error('this browser cannot render pages');
			for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
				ocrRun = { materialId: material.id, page: pageNumber, total };
				const page = await doc.getPage(pageNumber);
				const viewport = page.getViewport({ scale: 1.5 });
				canvas.width = Math.floor(viewport.width);
				canvas.height = Math.floor(viewport.height);
				await page.render({ canvas, canvasContext: context, viewport }).promise;
				const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
				const response = await fetch(`/api/courses/${course.id}/materials/${material.id}/ocr`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						pageNumber,
						image: dataUrl.slice(dataUrl.indexOf(',') + 1),
						done: pageNumber === total
					})
				});
				const body = (await response.json().catch(() => null)) as {
					index?: MaterialIndex;
					error?: string;
				} | null;
				if (body?.index) indexOverrides = { ...indexOverrides, [material.id]: body.index };
				if (!response.ok) throw new Error(body?.error ?? 'a page could not be transcribed');
			}
			await invalidateAll();
		} catch (cause) {
			uploadError =
				cause instanceof Error && cause.message
					? `OCR stopped: ${cause.message}`
					: `OCR stopped for ${material.fileName}. Try again.`;
		} finally {
			ocrRun = null;
		}
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

<svelte:head><title>{course.code} · Materials · Synapse</title></svelte:head>

<div class="page-enter mx-auto max-w-[var(--page-width)] pt-8 pb-16">
	<header
		class="mb-6 flex items-end justify-between gap-4 border-b border-[var(--ink)] pb-5 max-[640px]:flex-col max-[640px]:items-start"
	>
		<div>
			<div class="text-[length:var(--text-small)] text-[var(--ink-soft)]">Course materials</div>
			<h1 class="mt-[0.2rem] mb-[0.35rem] text-[clamp(2rem,4vw,2.75rem)]">Materials</h1>
			<p class="m-0 text-[var(--ink-soft)]">
				Files used by Syllabus intelligence and Practice for {course.code}.
			</p>
		</div>
		<div class=" text-[length:var(--text-small)] text-[var(--ink-faint)]">
			{materials.length} file{materials.length === 1 ? '' : 's'}
			{materials.length > 0 ? ` · ${formatSize(totalSize)}` : ''}
		</div>
	</header>

	<label
		class="mb-4 flex min-h-36 cursor-pointer flex-col justify-center gap-[0.35rem] border border-dashed border-[var(--rule)] bg-[var(--paper)] p-6 text-center hover:border-[var(--ink)] hover:bg-[var(--paper-shelf)] {dragOver
			? 'border-[var(--ink)] bg-[var(--paper-shelf)]'
			: ''} {uploading ? 'cursor-progress opacity-60' : ''}"
		ondrop={onDrop}
		ondragover={onDragOver}
		ondragleave={() => (dragOver = false)}
	>
		<input
			type="file"
			multiple
			class="sr-only"
			onchange={onFileInput}
			disabled={uploading}
			aria-label="Upload course materials"
		/>
		<span class="font-hand text-[1.2rem] text-[var(--ink)]"
			>{uploading ? 'Uploading…' : 'Drop files here'}</span
		>
		<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">
			or choose files · pdf, slides, docs, images, anything course-related
		</span>
	</label>

	{#if uploadError}<p class="text-[var(--pen-red)]" role="alert">{uploadError}</p>{/if}

	{#if materials.length === 0}
		<section class="border border-[var(--rule)] p-8 text-center">
			<h2 class="font-hand m-0">No materials yet</h2>
			<p class="mt-[0.4rem] mb-0 text-[var(--ink-soft)]">
				Upload course files here before generating Practice sessions.
			</p>
		</section>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-2 p-0">
			{#each materials as material (material.id)}
				<li
					class="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border border-[var(--rule)] bg-[var(--paper)] px-[0.85rem] py-3 max-[640px]:grid-cols-[minmax(0,1fr)] {deletingId ===
					material.id
						? 'opacity-40'
						: ''}"
				>
					<div class=" text-[var(--ink-faint)] text-[var(--text-caption)]">
						{fileKind(material.mimeType)}
					</div>
					<div class="min-w-0">
						{#if renamingId === material.id}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								class="w-full border border-[var(--ink)] bg-[var(--paper)] p-[0.4rem] [font-family:var(--font-body)] text-[length:var(--text-small)] leading-[1.4]"
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
							<!-- eslint-disable svelte/no-navigation-without-resolve -- API download URL, not an app route. -->
							<a
								class="block truncate text-[var(--ink)] text-[var(--text-small)] no-underline hover:underline hover:decoration-[var(--ink)]"
								href={`/api/courses/${course.id}/materials/${material.id}/download`}
								download={material.fileName}>{material.fileName}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
						<div class="mt-[0.2rem] text-[var(--ink-faint)] text-[var(--text-caption)]">
							{formatSize(material.size)} · uploaded {formatDate(material.uploadedAt)}
						</div>
						<div
							class="mt-[0.3rem] text-[var(--text-caption)] {materialIndex(material).status ===
							'ready'
								? 'text-[var(--ok)]'
								: ['failed', 'needs_ocr', 'too_large'].includes(materialIndex(material).status)
									? 'text-[var(--pen-red)]'
									: 'text-[var(--ink-soft)]'}"
							aria-live="polite"
						>
							{indexLabel(materialIndex(material))}
							{#if materialIndex(material).errorMessage}
								<span> · {materialIndex(material).errorMessage}</span>
							{/if}
						</div>
					</div>
					<div class="flex gap-[0.4rem] max-[640px]:flex-wrap">
						{#if materialIndex(material).status === 'failed'}
							<button class="btn btn-secondary btn-sm" onclick={() => retryIndex(material)}
								>retry index</button
							>
						{/if}
						{#if materialIndex(material).status === 'needs_ocr'}
							<button
								class="btn btn-secondary btn-sm"
								disabled={ocrRun !== null}
								onclick={() => void runOcr(material)}
							>
								{ocrRun?.materialId === material.id
									? `OCR · page ${ocrRun.page} of ${ocrRun.total}`
									: 'run OCR'}
							</button>
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
							class="btn btn-ghost btn-sm text-[var(--pen-red)]"
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
