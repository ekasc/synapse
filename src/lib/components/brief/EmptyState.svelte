<div class="empty">
	<p class="empty-head">Your notebook is empty.</p>
	<p class="empty-text">Research a course to start your first brief.</p>
	<p class="empty-hint">e.g. CSIS 3375</p>
</div>

<style>
	.empty {
		display: grid;
		place-items: center;
		gap: 0.75rem;
		padding: 6rem 1.5rem;
		border: 1px dashed var(--rule-soft);
		background: var(--paper);
		text-align: center;
	}

	.empty-head {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.75rem;
		color: var(--ink);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.empty-text {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.45;
	}

	.empty-hint {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--ink-faint);
		margin: 0;
		letter-spacing: 0.04em;
	}
</style>
