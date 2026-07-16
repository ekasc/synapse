<script lang="ts">
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

	let { brief }: { brief: BriefingDetailViewModel } = $props();

	type Row = { label: string; value: string | null };

	const quickFacts = $derived.by<Row[]>(() => [
		{ label: 'Credits', value: brief.credits?.text?.trim() || null },
		{ label: 'Delivery', value: brief.delivery?.text?.trim() || null },
		{ label: 'Corequisites', value: brief.corequisites?.text?.trim() || null }
	]);

	const currentOffering = $derived(brief.offerings?.current ?? null);
	const upcomingOffering = $derived(brief.offerings?.upcoming ?? null);

	const rmpRating = $derived(brief.studentReviews?.rating);
	const rmpVariant = $derived.by(() => {
		if (rmpRating == null) return 'idle';
		if (rmpRating < 3) return 'crit';
		if (rmpRating >= 4) return 'ok';
		return 'warn';
	});
	const rmpWouldTake = $derived(brief.studentReviews?.wouldTakeAgainPercent);
	const rmpCount = $derived(brief.studentReviews?.ratingCount);
</script>

<aside class="sidebar" aria-label="Quick facts">
	<section class="section">
		<h2 class="section-label font-mono">quick facts</h2>
		<dl class="rows">
			{#each quickFacts as row (row.label)}
				<div class="row">
					<dt class="font-mono">{row.label}</dt>
					<dd>{row.value ?? '—'}</dd>
				</div>
			{/each}
		</dl>
	</section>

	{#if currentOffering}
		<section class="section">
			<h2 class="section-label font-mono">current offering</h2>
			<dl class="rows">
				<div class="row">
					<dt class="font-mono">Term</dt>
					<dd>{currentOffering.term}</dd>
				</div>
				{#if currentOffering.instructor}
					<div class="row">
						<dt class="font-mono">Instructor</dt>
						<dd>
							{currentOffering.instructor.name}
							<span class="hint font-mono">
								({currentOffering.instructor.sourceLabel ?? currentOffering.instructor.verification})
							</span>
						</dd>
					</div>
				{/if}
				{#if currentOffering.crn}
					<div class="row">
						<dt class="font-mono">CRN</dt>
						<dd>{currentOffering.crn}</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}

	{#if upcomingOffering}
		<section class="section">
			<h2 class="section-label font-mono">next offering</h2>
			<dl class="rows">
				<div class="row">
					<dt class="font-mono">Term</dt>
					<dd>{upcomingOffering.term}</dd>
				</div>
				{#if upcomingOffering.instructor}
					<div class="row">
						<dt class="font-mono">Instructor</dt>
						<dd>{upcomingOffering.instructor.name}</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}

	{#if brief.studentReviews}
		<section class="section">
			<h2 class="section-label font-mono">rmp rating</h2>
			<div class="rmp">
				{#if rmpRating != null}
					<div class="rmp-rating font-hand rmp-{rmpVariant}">
						{rmpRating.toFixed(1)}<small>/5</small>
					</div>
					<div class="rmp-meta">
						{#if rmpWouldTake != null}<span>{rmpWouldTake}% would take again</span>{/if}
						{#if rmpCount != null}<span>{rmpCount} ratings</span>{/if}
					</div>
				{:else}
					<p class="muted">No RMP rating available.</p>
				{/if}
				{#if brief.studentReviews.rmpNote}
					<p class="hint font-mono">{brief.studentReviews.rmpNote}</p>
				{/if}
			</div>
		</section>
	{/if}
</aside>

<style>
	.sidebar {
		background: var(--paper);
		border: 1px solid var(--rule);
		padding: 1.25rem;
		display: grid;
		gap: 1.1rem;
	}

	.section {
		display: grid;
		gap: 0.6rem;
	}

	.section + .section {
		border-top: 1px solid var(--rule-soft);
		padding-top: 1rem;
	}

	.section-label {
		font-size: 0.7rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		margin: 0;
	}

	.rows {
		display: grid;
		gap: 0.45rem;
		margin: 0;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 5.5rem) 1fr;
		gap: 0.5rem;
		align-items: baseline;
	}

	.row dt {
		font-size: 0.78rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.row dd {
		margin: 0;
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.hint {
		display: block;
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-top: 0.1rem;
	}

	.rmp {
		display: grid;
		gap: 0.4rem;
	}

	.rmp-rating {
		font-weight: 700;
		font-size: 2.2rem;
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.rmp-rating small {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--ink-faint);
		margin-left: 0.1rem;
	}

	.rmp-ok {
		color: var(--ok);
	}
	.rmp-warn {
		color: var(--ink);
	}
	.rmp-crit {
		color: var(--pen-red);
	}
	.rmp-idle {
		color: var(--ink-faint);
	}

	.rmp-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.85rem;
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.muted {
		font-family: var(--font-body);
		font-size: 0.9rem;
		color: var(--ink-faint);
		margin: 0;
	}
</style>
