<script lang="ts">
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

	let { brief }: { brief: BriefingDetailViewModel } = $props();

	const title = $derived.by(() => {
		const escaped = brief.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return (
			brief.title.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, 'i'), '') || brief.title
		);
	});

	const dateLabel = $derived.by(() => {
		const d = new Date(brief.researchedAt);
		if (isNaN(d.getTime())) return '';
		return d
			.toLocaleString('en-US', {
				month: 'short',
				day: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			})
			.replace(',', ' ·');
	});

	const highlightText = $derived.by(() => {
		const prereq = brief.prerequisites?.text?.trim();
		if (prereq && prereq.length > 0) {
			return { label: 'PREREQ', value: prereq };
		}
		const cred = brief.credits?.text?.trim();
		if (cred) {
			return { label: 'CREDITS', value: cred };
		}
		const del = brief.delivery?.text?.trim();
		if (del) {
			return { label: 'DELIVERY', value: del };
		}
		if (brief.offerings?.current?.term) {
			return { label: 'OFFERED', value: brief.offerings.current.term };
		}
		return null;
	});
</script>

<header class="hero">
	<div class="hero-row">
		<span class="code font-mono">{brief.courseCode}</span>
		<span class="date font-mono">{dateLabel}</span>
	</div>
	<h1 class="title">{title}</h1>
	<p class="institution">{brief.institution}</p>
	{#if highlightText}
		<div class="highlight" role="note" aria-label={highlightText.label}>
			<span class="highlight-label font-mono">{highlightText.label}:</span>
			<span class="highlight-value">{highlightText.value}</span>
		</div>
	{/if}
</header>

<style>
	.hero {
		display: grid;
		gap: 0.4rem;
		padding-bottom: 1.5rem;
	}

	.hero-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.code {
		font-size: 0.85rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
	}

	.date {
		font-size: 0.78rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.title {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1.05;
		color: var(--ink);
		margin: 0.2rem 0 0;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}

	.institution {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--ink-soft);
		margin: 0.1rem 0 0;
		line-height: 1.4;
	}

	.highlight {
		margin-top: 0.85rem;
		padding: 0.6rem 0.9rem;
		background: var(--highlight);
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.4rem;
		line-height: 1.25;
		letter-spacing: -0.005em;
	}

	.highlight-label {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin-right: 0.4rem;
	}

	.highlight-value {
		font-family: var(--font-hand);
	}

	@media (max-width: 700px) {
		.hero-row {
			flex-direction: column;
			gap: 0.25rem;
		}
		.highlight {
			font-size: 1.15rem;
		}
	}
</style>
