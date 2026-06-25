<script lang="ts">
	interface Props {
		label?: string;
		term: string;
		year: number;
		progress?: number;
		stats?: string;
	}

	let { label = 'CURRENT TERM', term, year, progress = 0, stats = '' }: Props = $props();
</script>

<div class="term-block">
	<div class="term-block-label">{label}</div>
	<div class="term-block-name">{term} {year}</div>
	<div class="term-block-bar">
		<div class="term-block-bar-fill" style="width: {Math.min(100, Math.max(0, progress))}%"></div>
	</div>
	{#if stats}
		<div class="term-block-stats">{stats}</div>
	{/if}
</div>
