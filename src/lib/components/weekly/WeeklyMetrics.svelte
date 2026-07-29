<script lang="ts">
	import type { WeeklyMetric } from '$lib/dashboard/weekly-view-model';
	let { metrics }: { metrics: WeeklyMetric[] } = $props();
</script>

<section
	class="grid grid-cols-4 border border-[var(--rule)] max-[42rem]:grid-cols-2"
	aria-label="Weekly summary"
>
	{#each metrics as metric, index (metric.label)}
		<article
			class="grid min-w-0 gap-[0.12rem] border-r border-[var(--rule-soft)] px-[0.85rem] py-3 {index ===
			metrics.length - 1
				? 'border-r-0'
				: ''} {index === 1 ? 'max-[42rem]:border-r-0' : ''} {index < 2
				? 'max-[42rem]:border-b max-[42rem]:border-[var(--rule-soft)]'
				: ''}"
		>
			<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">{metric.label}</span>
			<strong
				class="[font-family:var(--font-body)] text-[1.45rem] leading-none text-[var(--ink)] {metric.tone ===
				'warning'
					? 'text-[var(--warn)]'
					: ''}">{metric.value}</strong
			>
			{#if metric.detail}<small
					class=" text-[var(--ink-faint)] text-[var(--text-caption)] {metric.tone === 'warning'
						? 'text-[var(--warn)]'
						: ''}">{metric.detail}</small
				>{/if}
		</article>
	{/each}
</section>
