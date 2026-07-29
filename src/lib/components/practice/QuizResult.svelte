<script lang="ts">
	let {
		score,
		total,
		missedCount = 0,
		onrestartmissed,
		ontryagain
	}: {
		score: number;
		total: number;
		missedCount?: number;
		onrestartmissed?: () => void;
		ontryagain: () => void;
	} = $props();

	const resultTone = $derived(
		score === total && total > 0 ? 'ok' : score >= total / 2 ? 'warn' : 'crit'
	);

	const missedOnlyAvailable = $derived(missedCount > 0);
</script>

<div class="surface-polaroid flex flex-col items-center gap-[0.85rem] px-6 py-10 text-center">
	<h2 class="font-hand m-0 text-[1.7rem] leading-none tracking-[-0.01em] text-[var(--ink)]">
		Quiz Complete
	</h2>
	<p class="m-0 text-[1.1rem] text-[var(--ink-soft)]">{score} / {total} correct</p>
	<div class="h-1.5 w-[200px] overflow-hidden bg-[var(--rule)]">
		<div
			class="h-full w-full origin-left transition-transform duration-400"
			style="transform: scaleX({total > 0 ? score / total : 0});
				background: {resultTone === 'ok'
				? 'var(--ok)'
				: resultTone === 'warn'
					? 'var(--warn)'
					: 'var(--accent)'};"
		></div>
	</div>
	<p class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">
		{resultTone === 'ok'
			? 'Perfect score. Strong topic mastery.'
			: resultTone === 'warn'
				? 'Good. Review the ones you missed.'
				: 'Needs work. Flagged topics for your next study session.'}
	</p>
	<div class="flex flex-wrap justify-center gap-2">
		{#if missedOnlyAvailable && onrestartmissed}
			<button class="btn btn-primary" onclick={onrestartmissed}>
				redo missed ({missedCount})
			</button>
		{/if}
		<button class="btn btn-ghost" onclick={ontryagain}>try again</button>
	</div>
</div>
