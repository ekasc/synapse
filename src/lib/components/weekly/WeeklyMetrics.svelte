<script lang="ts">
	import type { WeeklyMetric } from '$lib/dashboard/weekly-view-model';
	let { metrics }: { metrics: WeeklyMetric[] } = $props();
</script>

<section class="metrics" aria-label="Weekly summary">
	{#each metrics as metric (metric.label)}
		<article class:warning={metric.tone === 'warning'}>
			<span>{metric.label}</span>
			<strong>{metric.value}</strong>
			{#if metric.detail}<small>{metric.detail}</small>{/if}
		</article>
	{/each}
</section>

<style>
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border: 1px solid var(--rule);
	}
	article {
		min-width: 0;
		padding: 0.75rem 0.85rem;
		display: grid;
		gap: 0.12rem;
		border-right: 1px solid var(--rule-soft);
	}
	article:last-child {
		border-right: 0;
	}
	span,
	small {
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
	}
	span {
		font-size: 0.62rem;
	}
	strong {
		font-family: var(--font-hand);
		font-size: 1.45rem;
		line-height: 1;
		color: var(--ink);
	}
	small {
		font-size: 0.58rem;
	}
	.warning strong,
	.warning small {
		color: var(--warn);
	}
	@media (max-width: 42rem) {
		.metrics {
			grid-template-columns: repeat(2, 1fr);
		}
		article:nth-child(2) {
			border-right: 0;
		}
		article:nth-child(-n + 2) {
			border-bottom: 1px solid var(--rule-soft);
		}
	}
</style>
