<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';

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
	let closeRef = $state<HTMLButtonElement | undefined>();
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
		if (!open) return;
		closeRef?.focus();
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
		const JSZip = (await import('jszip')).default;
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
			font: 15px/1.65 var(--font-body);
		}
		img { max-width: 100%; height: auto; }
		table { width: 100%; border-collapse: collapse; margin: 16px 0; }
		td, th { border: 1px solid var(--rule-soft); padding: 8px; vertical-align: top; }
		th { font-weight: 650; background: var(--paper-shelf); }
		p { margin: 0 0 12px; }
		ul, ol { padding-left: 24px; }
		a { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
		a:hover { color: var(--pen-blue); }
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
	<div class="fixed inset-0 z-[var(--z-viewer)]">
		<div
			class="absolute inset-0 bg-[var(--backdrop-overlay)]"
			onclick={onClose}
			aria-hidden="true"
		></div>
		<div
			class="viewer-panel absolute inset-5 mx-auto flex max-w-[980px] flex-col border border-[var(--ink)] bg-[var(--paper)] shadow-[0_2px_6px_var(--shadow-ink)]"
			role="dialog"
			aria-modal="true"
			aria-label={fileName}
		>
			<header
				class="flex items-center justify-between gap-4 border-b border-[var(--rule)] bg-[var(--paper-shelf)] px-4 py-[0.8rem] max-[640px]:items-start"
			>
				<div class="min-w-0">
					<p class="mt-0 mb-[0.18rem] text-[var(--ink-faint)] text-[var(--text-caption)]">
						{fileType}
					</p>
					<h2
						class="m-0 truncate [font-family:var(--font-body)] text-base leading-[1.2] font-bold text-[var(--ink)]"
					>
						{fileName}
					</h2>
				</div>
				<div class="flex shrink-0 items-center gap-[0.6rem] max-[640px]:gap-[0.4rem]">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- downloadUrl points to a generated file/API URL. -->
					<a
						class=" text-[var(--ink)] text-[var(--text-caption)] underline decoration-[var(--border-faint)] underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[var(--ink)]"
						href={downloadUrl}
						download={fileName}>download</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<button
						type="button"
						bind:this={closeRef}
						class="size-8 cursor-pointer border border-[var(--rule)] bg-[var(--paper)] text-[1.4rem] leading-none text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink)]"
						onclick={onClose}
						aria-label="Close document viewer"
					>
						×
					</button>
				</div>
			</header>

			<div class="min-h-0 flex-1 overflow-auto bg-[var(--paper-shelf)]">
				{#if loading}
					<div
						class="flex min-h-full items-center justify-center p-8 text-center text-[var(--ink-soft)]"
					>
						Loading document…
					</div>
				{:else if error}
					<div
						class="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center text-[var(--accent)]"
					>
						<p class="m-0">{error}</p>
						<Button variant="secondary" size="sm" onclick={loadDocument}>Try again</Button>
					</div>
				{:else if fileType === 'pdf'}
					<div
						class="flex min-h-full items-start justify-center overflow-auto p-4"
						role="img"
						aria-label={`Page ${pageNum} of ${totalPages} of ${fileName}`}
					>
						<canvas
							bind:this={canvasRef}
							class="h-auto max-w-full bg-white shadow-[0_2px_12px_var(--shadow-ink)]"
							aria-hidden="true"
						></canvas>
					</div>
				{:else if fileType === 'docx' && docxSrcdoc}
					<iframe
						title={`${fileName} preview`}
						srcdoc={docxSrcdoc}
						sandbox=""
						class="block size-full border-0 bg-white"
					></iframe>
				{:else if fileType === 'pptx'}
					<div class="grid gap-4 p-4">
						{#each slides as slide (slide.number)}
							<article
								class="min-h-[280px] border border-[var(--rule)] bg-[var(--surface-paper)] p-6 shadow-[3px_3px_0_var(--shadow-ink)]"
							>
								<div class="mb-4 text-[var(--ink-faint)] text-[var(--text-caption)]">
									slide {slide.number}
								</div>
								<h3
									class="mt-0 mb-4 [font-family:var(--font-body)] text-[clamp(1.4rem,3vw,2rem)] leading-[1.1] font-bold text-[var(--ink)]"
								>
									{slide.title}
								</h3>
								{#if slide.body.length > 0}
									<ul class="m-0 pl-[1.2rem] text-base leading-[1.55] text-[var(--ink-soft)]">
										{#each slide.body as line, index (`${slide.number}-${index}`)}
											<li>{line}</li>
										{/each}
									</ul>
								{:else}
									<p class="m-0 text-xs tracking-[0.1em] text-[var(--ink-faint)]">
										No readable text on this slide.
									</p>
								{/if}
							</article>
						{/each}
					</div>
				{:else}
					<div
						class="flex min-h-full items-center justify-center p-8 text-center text-[var(--ink-soft)]"
					>
						No preview available.
					</div>
				{/if}
			</div>

			{#if fileType === 'pdf' && totalPages > 1}
				<footer
					class="flex items-center justify-center gap-4 border-t border-[var(--rule)] bg-[var(--paper-shelf)] px-4 py-[0.8rem]"
				>
					<Button variant="secondary" size="sm" disabled={pageNum <= 1} onclick={goToPrevPage}
						>Previous</Button
					>
					<span class="min-w-16 text-center text-[var(--ink-soft)] text-[var(--text-caption)]"
						>{pageNum} / {totalPages}</span
					>
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
	.viewer-panel {
		animation: viewer-in 0.18s var(--ease-out-quart);
	}

	@keyframes viewer-in {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (max-width: 640px) {
		.viewer-panel {
			inset: 0;
			box-shadow: none;
		}
	}
</style>
