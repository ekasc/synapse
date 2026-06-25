<script lang="ts">
	interface Cell {
		label: string;
		value: string | number;
		sub?: string;
		tone?: 'default' | 'crit' | 'warn';
		sparkline?: number[];
	}

	interface Props {
		cells: Cell[];
	}

	let { cells }: Props = $props();

	function sparkHeight(value: number, max: number) {
		return max === 0 ? '0%' : `${Math.max(8, Math.round((value / max) * 100))}%`;
	}
</script>

<div class="index-bar" aria-label="Index summary">
	{#each cells as cell (cell.label)}
		<div class="index-cell">
			<span class="index-label">{cell.label}</span>
			{#if cell.sparkline}
				{@const max = Math.max(...cell.sparkline, 1)}
				<div class="index-sparkline" aria-hidden="true">
					{#each cell.sparkline as value, i (i)}
						<span class="index-spark-bar" style="height: {sparkHeight(value, max)}"></span>
					{/each}
				</div>
			{:else}
				<span class="index-num" class:crit={cell.tone === 'crit'} class:warn={cell.tone === 'warn'}>
					{cell.value}
				</span>
			{/if}
			{#if cell.sub}
				<span class="index-sub">{cell.sub}</span>
			{/if}
		</div>
	{/each}
</div>
