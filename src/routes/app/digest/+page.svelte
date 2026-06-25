<script lang="ts">
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';

	type Digest = {
		week: string;
		label: string;
		summary: string;
		highlights: string[];
		upcoming: { item: string; date: string; urgency: 'low' | 'medium' | 'high' }[];
	};

	let { data }: { data: { digests?: Digest[] } } = $props();

	const digests = $derived(data.digests ?? []);

	let expandedWeek = $state<string | null>(null);
	const activeDigest = $derived.by(() => {
		if (expandedWeek) {
			const match = digests.find((d) => d.week === expandedWeek);
			if (match) return match;
		}
		return digests[0] ?? null;
	});

	const urgencyColor: Record<string, string> = {
		high: 'var(--accent)',
		medium: 'var(--ink-soft)',
		low: 'var(--ink-faint)'
	};
</script>

<svelte:head><title>Synapse · Digest</title></svelte:head>

<CatalogHeader term="Weekly" />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Weekly Digest</h1>
		<p class="page-tagline">
			{#if activeDigest}
				{activeDigest.label} · week of {activeDigest.week}
			{:else}
				A weekly summary of your graph activity
			{/if}
		</p>
	</div>

	{#if digests.length === 0}
		<div class="digest-empty">
			<h2 class="empty-head font-hand">No digests yet</h2>
			<p class="empty-text">Weekly summaries appear here once your graph has activity.</p>
		</div>
	{:else}
		<div class="week-tabs">
			{#each digests as d (d.week)}
				<button
					class="week-tab font-mono"
					class:active={activeDigest.week === d.week}
					onclick={() => (expandedWeek = d.week)}
				>
					{d.week}
				</button>
			{/each}
		</div>

		{#if activeDigest}
			<article class="digest-card surface-polaroid">
				<div class="digest-head">
					<span class="digest-week font-hand">{activeDigest.week}</span>
					<span class="digest-label font-mono">{activeDigest.label}</span>
				</div>

				<p class="digest-summary">{activeDigest.summary}</p>

				<div class="digest-section">
					<SectionHead title="What happened" />
					<ul class="digest-list">
						{#each activeDigest.highlights as h, i (i)}
							<li class="digest-li">{h}</li>
						{/each}
					</ul>
				</div>

				<div class="digest-section">
					<SectionHead title="On deck" />
					<ul class="digest-list">
						{#each activeDigest.upcoming as u, i (i)}
							<li class="digest-li upcoming-li">
								<span class="upcoming-name">{u.item}</span>
								<div class="upcoming-right">
									<span class="upcoming-date font-mono">{u.date}</span>
									<span class="upcoming-dot" style="background: {urgencyColor[u.urgency]}"></span>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</article>
		{/if}
	{/if}

	<div class="digest-footer">
		<span class="footer-note font-mono">Weekly summary of graph activity</span>
	</div>
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

	.week-tabs {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.week-tab {
		padding: 0.45rem 0.85rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-size: 0.72rem;
		color: var(--ink-soft);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
	}

	.week-tab:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.week-tab.active {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}

	.digest-card {
		padding: 1.5rem 1.5rem 1.75rem;
	}

	.digest-head {
		display: flex;
		align-items: baseline;
		gap: 0.85rem;
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--ink);
	}

	.digest-week {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.digest-label {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.digest-summary {
		font-size: 0.95rem;
		color: var(--ink);
		line-height: 1.55;
		margin: 0 0 1.5rem;
	}

	.digest-section {
		margin-bottom: 1.25rem;
	}

	.digest-section:last-child {
		margin-bottom: 0;
	}

	.digest-list {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.digest-li {
		font-size: 0.88rem;
		color: var(--ink-soft);
		line-height: 1.5;
		padding: 0.4rem 0 0.4rem 0.85rem;
		border-left: 2px solid var(--rule);
	}

	.upcoming-li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.45rem 0 0.45rem 0.85rem;
	}

	.upcoming-name {
		color: var(--ink);
		font-size: 0.88rem;
	}

	.upcoming-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.upcoming-date {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.upcoming-dot {
		width: 8px;
		height: 8px;
		flex-shrink: 0;
	}

	.digest-footer {
		display: flex;
		justify-content: center;
		margin-top: 2rem;
	}

	.footer-note {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.digest-empty {
		padding: 3rem 2rem;
		text-align: center;
		border: 1px dashed var(--rule);
		background: var(--paper);
	}

	.empty-head {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.empty-text {
		font-size: 0.9rem;
		color: var(--ink-soft);
		margin: 0 0 0.5rem;
	}
</style>
