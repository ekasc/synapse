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

<div class="quiz-result surface-polaroid">
	<h2 class="result-head font-hand">Quiz Complete</h2>
	<p class="result-score">{score} / {total} correct</p>
	<div class="result-bar">
		<div
			class="result-fill"
			style="transform: scaleX({total > 0 ? score / total : 0});
				background: {resultTone === 'ok'
				? 'var(--ok)'
				: resultTone === 'warn'
					? 'var(--warn)'
					: 'var(--accent)'};"
		></div>
	</div>
	<p class="result-note font-mono">
		{resultTone === 'ok'
			? 'Perfect score. Strong topic mastery.'
			: resultTone === 'warn'
				? 'Good. Review the ones you missed.'
				: 'Needs work. Flagged topics for your next study session.'}
	</p>
	<div class="result-actions">
		{#if missedOnlyAvailable && onrestartmissed}
			<button class="btn btn-primary" onclick={onrestartmissed}>
				redo missed ({missedCount})
			</button>
		{/if}
		<button class="btn btn-ghost" onclick={ontryagain}>try again</button>
	</div>
</div>

<style>
	.quiz-result {
		padding: 2.5rem 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
	}

	.result-head {
		font-size: 1.7rem;
		color: var(--ink);
		margin: 0;
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.result-score {
		font-size: 1.1rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.result-bar {
		width: 200px;
		height: 6px;
		background: var(--rule);
		overflow: hidden;
	}

	.result-fill {
		height: 100%;
		width: 100%;
		transform-origin: left;
		transition: transform 0.4s var(--ease-out-quart);
	}

	.result-note {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.result-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}
</style>
