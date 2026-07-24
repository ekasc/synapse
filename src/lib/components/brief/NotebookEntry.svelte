<script lang="ts">
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

	let { brief }: { brief: BriefingDetailViewModel } = $props();

	const dateStamp = $derived.by(() => {
		const d = new Date(brief.researchedAt);
		if (isNaN(d.getTime())) return '';
		const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
		const day = String(d.getDate()).padStart(2, '0');
		const year = d.getFullYear();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${month} ${day} ${year} · ${hh}:${mm}`;
	});

	const title = $derived.by(() => {
		const escaped = brief.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return brief.title.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, 'i'), '') || brief.title;
	});

	const rmpRating = $derived(brief.studentReviews?.rating);
	const rmpLabel = $derived(rmpRating != null ? `${rmpRating.toFixed(1)} / 5` : 'N/A');
	const rmpVariant = $derived.by(() => {
		if (rmpRating == null) return 'idle';
		if (rmpRating < 3) return 'crit';
		if (rmpRating >= 4) return 'ok';
		return 'warn';
	});

	const termLabel = $derived(brief.offerings?.current?.term ?? '');
	const profLabel = $derived(
		brief.offerings?.current?.instructor?.name ?? brief.professor.requestedName ?? ''
	);
	const creditsLabel = $derived.by(() => {
		const text = brief.credits?.text?.trim();
		if (!text) return '';
		const m = text.match(/\d+/);
		return m ? `${m[0]} credit${m[0] === '1' ? '' : 's'}` : text;
	});
	const sourceLabel = $derived(
		`${brief.sources.length} source${brief.sources.length === 1 ? '' : 's'}`
	);

	const metaParts = $derived(
		[profLabel, termLabel, creditsLabel, sourceLabel].filter((s) => s && s.trim().length > 0)
	);
</script>

<a class="entry" href={`/app/brief/${encodeURIComponent(brief.courseCode)}`}>
	<div class="entry-body">
		<div class="entry-date font-mono">{dateStamp}</div>
		<div class="entry-row">
			<span class="entry-code font-mono">{brief.courseCode}</span>
			<span class="rmp font-mono rmp-{rmpVariant}">{rmpLabel}</span>
		</div>
		<h3 class="entry-title">{title}</h3>
		<div class="entry-meta">
			{metaParts.join(' · ')}
		</div>
	</div>
</a>

<style>
	.entry {
		display: flex;
		gap: 0;
		padding: 0;
		border: 0;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		color: inherit;
		text-decoration: none;
		transition: background 0.15s var(--ease-out-quart);
	}

	.entry:hover {
		background: var(--paper-shelf);
	}

	.entry:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}

	.entry-body {
		flex: 1 1 auto;
		padding: 1.25rem 1.5rem;
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}

	.entry-date {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.entry-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.1rem;
	}

	.entry-code {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.entry-title {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.4rem;
		line-height: 1.15;
		color: var(--ink);
		margin: 0.1rem 0 0;
		letter-spacing: -0.005em;
		transition: transform 0.15s var(--ease-out-quart);
		text-wrap: balance;
	}

	.entry:hover .entry-title {
		transform: translateY(-1px);
	}

	.entry-meta {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--ink-soft);
		margin-top: 0.15rem;
		overflow-wrap: anywhere;
	}

	.rmp {
		font-size: 0.78rem;
		font-weight: 500;
		padding: 0.15rem 0.45rem;
		line-height: 1.2;
		border: 1px solid transparent;
	}

	.rmp-ok {
		background: var(--highlight-soft);
		color: var(--ink);
	}

	.rmp-warn {
		background: var(--paper-shelf);
		color: var(--ink-soft);
	}

	.rmp-crit {
		background: var(--pen-red);
		color: var(--paper);
	}

	.rmp-idle {
		background: var(--paper-shelf);
		color: var(--ink-faint);
	}

	@media (max-width: 700px) {
		.entry-body {
			padding: 1rem 1rem 1rem 1.1rem;
		}
		.entry-title {
			font-size: 1.2rem;
		}
		.entry-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}
	}
</style>
