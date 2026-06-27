<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import JSZip from 'jszip';

	type Material = {
		id: string;
		courseId: string;
		fileName: string;
		mimeType: string;
		size: number;
		uploadedAt: string;
	};

	type PdfJsModule = typeof import('pdfjs-dist');
	type SlidePreview = { number: number; title: string; body: string[] };

	const DOCX_ALLOWED_TAGS = new Set([
		'a',
		'b',
		'br',
		'caption',
		'code',
		'del',
		'div',
		'em',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'i',
		'img',
		'li',
		'ol',
		'p',
		'pre',
		's',
		'strong',
		'sub',
		'sup',
		'table',
		'tbody',
		'td',
		'tfoot',
		'th',
		'thead',
		'tr',
		'u',
		'ul'
	]);
	const DOCX_ALLOWED_ATTRS = new Set(['alt', 'colspan', 'href', 'rowspan', 'src', 'title']);

	let {
		material,
		open,
		onClose
	}: {
		material: Material | null;
		open: boolean;
		onClose: () => void;
	} = $props();

	let loading = $state(false);
	let error = $state('');
	let pageNum = $state(1);
	let totalPages = $state(0);
	let pdfDoc = $state<PDFDocumentProxy | null>(null);
	let canvasRef = $state<HTMLCanvasElement | undefined>();
	let docxSrcdoc = $state('');
	let slides = $state<SlidePreview[]>([]);
	let activeLoadId = 0;
	let activeRenderId = 0;
	let pdfjs: PdfJsModule | null = null;

	const fileName = $derived(material?.fileName ?? 'Document');
	const fileType = $derived(getFileType(material));
	const downloadUrl = $derived(
		material ? `/api/courses/${material.courseId}/materials/${material.id}/download` : '#'
	);

	$effect(() => {
		if (!open || !material) return;
		void loadDocument();
	});

	$effect(() => {
		if (!open || loading || fileType !== 'pdf' || !pdfDoc || !canvasRef) return;
		void renderPage(pageNum);
	});

	$effect(() => {
		if (open) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = '';

		return () => {
			document.body.style.overflow = '';
		};
	});

	async function loadDocument() {
		if (!material) return;

		const currentMaterial = material;
		const loadId = ++activeLoadId;
		loading = true;
		error = '';
		docxSrcdoc = '';
		slides = [];
		pageNum = 1;
		totalPages = 0;
		pdfDoc = null;

		try {
			const response = await fetch(
				`/api/courses/${currentMaterial.courseId}/materials/${currentMaterial.id}/download`
			);
			if (!response.ok) throw new Error(`Download failed (${response.status})`);

			const blob = await response.blob();
			if (loadId !== activeLoadId) return;

			const type = getFileType(currentMaterial);
			if (type === 'pdf') await loadPdf(blob, loadId);
			else if (type === 'docx') await loadDocx(blob, loadId);
			else if (type === 'pptx') await loadPptx(blob, loadId);
			else throw new Error('This file type cannot be previewed yet');
		} catch (err) {
			if (loadId !== activeLoadId) return;
			error = err instanceof Error ? err.message : 'Could not load document';
		} finally {
			if (loadId === activeLoadId) loading = false;
		}
	}

	async function loadPdf(blob: Blob, loadId: number) {
		const arrayBuffer = await blob.arrayBuffer();
		if (loadId !== activeLoadId) return;

		pdfjs = (await import('pdfjs-dist')) as PdfJsModule;
		pdfjs.GlobalWorkerOptions.workerSrc = new URL(
			'pdfjs-dist/build/pdf.worker.min.mjs',
			import.meta.url
		).href;

		const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
		if (loadId !== activeLoadId) return;
		pdfDoc = pdf;
		totalPages = pdf.numPages;
	}

	async function renderPage(num: number) {
		if (!pdfDoc || !canvasRef) return;

		const renderId = ++activeRenderId;
		const page = await pdfDoc.getPage(num);
		if (renderId !== activeRenderId || !canvasRef) return;

		const viewport = page.getViewport({ scale: 1.25 });
		const outputScale = Math.max(window.devicePixelRatio || 1, 1);
		canvasRef.width = Math.floor(viewport.width * outputScale);
		canvasRef.height = Math.floor(viewport.height * outputScale);
		canvasRef.style.width = `${viewport.width}px`;
		canvasRef.style.height = 'auto';

		const context = canvasRef.getContext('2d');
		if (!context) throw new Error('Canvas is not available');
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, canvasRef.width, canvasRef.height);

		await page.render({
			canvas: canvasRef,
			viewport,
			transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
		}).promise;
	}

	async function loadDocx(blob: Blob, loadId: number) {
		const arrayBuffer = await blob.arrayBuffer();
		if (loadId !== activeLoadId) return;

		const mammoth = await import('mammoth');
		const result = await mammoth.convertToHtml(
			{ arrayBuffer },
			{ convertImage: mammoth.images.dataUri }
		);
		if (loadId !== activeLoadId) return;

		docxSrcdoc = buildDocxPreviewSrcdoc(sanitizeDocxHtml(result.value));
	}

	async function loadPptx(blob: Blob, loadId: number) {
		const zip = await JSZip.loadAsync(await blob.arrayBuffer());
		if (loadId !== activeLoadId) return;

		const slideFiles = Object.keys(zip.files)
			.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
			.sort((a, b) => slideNumber(a) - slideNumber(b));

		const parsedSlides = await Promise.all(
			slideFiles.map(async (name) =>
				parseSlide(await zip.files[name].async('string'), slideNumber(name))
			)
		);
		if (loadId !== activeLoadId) return;

		slides = parsedSlides;
		if (slides.length === 0) throw new Error('No slides found in this PowerPoint file');
	}

	function parseSlide(xml: string, number: number): SlidePreview {
		const document = new DOMParser().parseFromString(xml, 'application/xml');
		const text = Array.from(document.getElementsByTagName('a:t'))
			.map((node) => node.textContent?.trim() ?? '')
			.filter(Boolean);
		const [title, ...body] = text;

		return {
			number,
			title: title || `Slide ${number}`,
			body
		};
	}

	function sanitizeDocxHtml(html: string) {
		const document = new DOMParser().parseFromString(html, 'text/html');

		for (const element of Array.from(document.body.querySelectorAll('*'))) {
			const tagName = element.tagName.toLowerCase();
			if (!DOCX_ALLOWED_TAGS.has(tagName)) {
				element.replaceWith(...Array.from(element.childNodes));
				continue;
			}

			for (const attribute of Array.from(element.attributes)) {
				const name = attribute.name.toLowerCase();
				const value = attribute.value.trim();
				const allowedHref = name === 'href' && /^(https?:|mailto:)/i.test(value);
				const allowedImage =
					name === 'src' && /^data:image\/(?:gif|jpe?g|png|webp);base64,/i.test(value);
				if (
					!DOCX_ALLOWED_ATTRS.has(name) ||
					(name === 'href' && !allowedHref) ||
					(name === 'src' && !allowedImage)
				) {
					element.removeAttribute(attribute.name);
				}
			}
		}

		return document.body.innerHTML;
	}

	function buildDocxPreviewSrcdoc(body: string) {
		return `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<style>
		:root { color-scheme: light; }
		* { box-sizing: border-box; }
		body {
			margin: 0;
			padding: 28px;
			color: var(--ink);
			background: var(--surface-paper);
			font: 15px/1.65 ui-serif, Georgia, Cambria, "Times New Roman", serif;
		}
		img { max-width: 100%; height: auto; }
		table { width: 100%; border-collapse: collapse; margin: 16px 0; }
		td, th { border: 1px solid var(--rule-soft); padding: 8px; vertical-align: top; }
		th { font-weight: 650; background: var(--paper-shelf); }
		p { margin: 0 0 12px; }
		ul, ol { padding-left: 24px; }
		a { color: var(--subject-comp); }
	</style>
</head>
<body>${body}</body>
</html>`;
	}

	function getFileType(target: Material | null): 'pdf' | 'docx' | 'pptx' | 'other' {
		if (!target) return 'other';
		const name = target.fileName.toLowerCase();
		const mime = target.mimeType.toLowerCase();
		if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
		if (mime.includes('wordprocessingml') || mime.includes('msword') || name.endsWith('.docx')) {
			return 'docx';
		}
		if (mime.includes('presentationml') || mime.includes('powerpoint') || name.endsWith('.pptx')) {
			return 'pptx';
		}
		return 'other';
	}

	function slideNumber(name: string): number {
		return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
	}

	function goToPrevPage() {
		if (pageNum > 1) pageNum--;
	}

	function goToNextPage() {
		if (pageNum < totalPages) pageNum++;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="viewer-shell">
		<div class="viewer-backdrop" onclick={onClose} aria-hidden="true"></div>
		<div class="viewer-panel" role="dialog" aria-modal="true" aria-label={fileName}>
			<header class="viewer-header">
				<div class="viewer-title-wrap">
					<p class="viewer-kicker font-mono">{fileType}</p>
					<h2 class="viewer-title">{fileName}</h2>
				</div>
				<div class="viewer-actions">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- downloadUrl points to a generated file/API URL. -->
					<a class="viewer-download font-mono" href={downloadUrl} download={fileName}>download</a>
					<button
						type="button"
						class="viewer-close"
						onclick={onClose}
						aria-label="Close document viewer"
					>
						×
					</button>
				</div>
			</header>

			<div class="viewer-body">
				{#if loading}
					<div class="viewer-state font-mono">Loading document…</div>
				{:else if error}
					<div class="viewer-state viewer-state-error">
						<p>{error}</p>
						<Button variant="secondary" size="sm" onclick={loadDocument}>Try again</Button>
					</div>
				{:else if fileType === 'pdf'}
					<div class="pdf-stage">
						<canvas bind:this={canvasRef} class="pdf-canvas"></canvas>
					</div>
				{:else if fileType === 'docx' && docxSrcdoc}
					<iframe title={`${fileName} preview`} srcdoc={docxSrcdoc} sandbox="" class="docx-frame"
					></iframe>
				{:else if fileType === 'pptx'}
					<div class="slide-list">
						{#each slides as slide (slide.number)}
							<article class="slide-card">
								<div class="slide-number font-mono">slide {slide.number}</div>
								<h3>{slide.title}</h3>
								{#if slide.body.length > 0}
									<ul>
										{#each slide.body as line, index (`${slide.number}-${index}`)}
											<li>{line}</li>
										{/each}
									</ul>
								{:else}
									<p class="slide-empty font-mono">No readable text on this slide.</p>
								{/if}
							</article>
						{/each}
					</div>
				{:else}
					<div class="viewer-state font-mono">No preview available.</div>
				{/if}
			</div>

			{#if fileType === 'pdf' && totalPages > 1}
				<footer class="viewer-footer">
					<Button variant="secondary" size="sm" disabled={pageNum <= 1} onclick={goToPrevPage}
						>Previous</Button
					>
					<span class="page-count font-mono">{pageNum} / {totalPages}</span>
					<Button
						variant="secondary"
						size="sm"
						disabled={pageNum >= totalPages}
						onclick={goToNextPage}>Next</Button
					>
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.viewer-shell {
		position: fixed;
		inset: 0;
		z-index: var(--z-viewer);
	}

	.viewer-backdrop {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--ink) 34%, transparent);
		backdrop-filter: blur(3px);
	}

	.viewer-panel {
		position: absolute;
		inset: 1.25rem;
		display: flex;
		flex-direction: column;
		max-width: 980px;
		margin-inline: auto;
		border: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: 8px 8px 0 rgba(26, 26, 23, 0.18);
	}

	.viewer-header,
	.viewer-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.viewer-footer {
		justify-content: center;
		border-top: 1px solid var(--rule);
		border-bottom: 0;
	}

	.viewer-title-wrap {
		min-width: 0;
	}

	.viewer-kicker {
		margin: 0 0 0.18rem;
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.viewer-title {
		margin: 0;
		overflow: hidden;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1rem;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.viewer-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.viewer-download {
		font-size: 0.68rem;
		color: var(--ink-soft);
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.viewer-download:hover {
		color: var(--ink);
	}

	.viewer-close {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
	}

	.viewer-body {
		min-height: 0;
		flex: 1;
		overflow: auto;
		background: var(--paper-shelf);
	}

	.viewer-state {
		display: flex;
		min-height: 100%;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		color: var(--ink-soft);
		text-align: center;
	}

	.viewer-state-error {
		flex-direction: column;
		gap: 1rem;
		color: var(--accent);
	}

	.viewer-state-error p {
		margin: 0;
	}

	.pdf-stage {
		display: flex;
		min-height: 100%;
		justify-content: center;
		align-items: flex-start;
		padding: 1rem;
		overflow: auto;
	}

	.pdf-canvas {
		max-width: 100%;
		height: auto;
		background: white;
		box-shadow: 0 2px 12px rgba(26, 26, 23, 0.18);
	}

	.docx-frame {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		background: white;
	}

	.slide-list {
		display: grid;
		gap: 1rem;
		padding: 1rem;
	}

	.slide-card {
		min-height: 280px;
		padding: 1.5rem;
		border: 1px solid var(--rule);
		background: var(--surface-paper);
		box-shadow: 3px 3px 0 rgba(26, 26, 23, 0.12);
	}

	.slide-number {
		margin-bottom: 1rem;
		font-size: 0.68rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.slide-card h3 {
		margin: 0 0 1rem;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 3vw, 2rem);
		line-height: 1.1;
	}

	.slide-card ul {
		margin: 0;
		padding-left: 1.2rem;
		color: var(--ink-soft);
		font-size: 1rem;
		line-height: 1.55;
	}

	.slide-empty {
		margin: 0;
		color: var(--ink-faint);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.page-count {
		min-width: 4rem;
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-align: center;
	}

	@media (max-width: 640px) {
		.viewer-panel {
			inset: 0;
			box-shadow: none;
		}

		.viewer-header {
			align-items: flex-start;
		}

		.viewer-actions {
			gap: 0.4rem;
		}
	}
</style>
