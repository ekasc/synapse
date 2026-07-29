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

	const sectionClass =
		'grid gap-[0.6rem] [&+section]:border-t [&+section]:border-[var(--rule-soft)] [&+section]:pt-4';
	const headingClass = 'm-0 text-[var(--text-caption)] text-[var(--ink-faint)] ';
	const rowsClass =
		'm-0 grid gap-[0.45rem] [&_dd]:m-0 [&_dd]:text-[var(--text-small)] [&_dd]:leading-[1.4] [&_dd]:text-[var(--ink)] [&_dd]:[overflow-wrap:anywhere] [&_dd]:font-[family-name:var(--font-body)] [&_dt]:text-[var(--text-caption)] [&_dt]:text-[var(--text-caption)] [&_dt]:text-[var(--ink-soft)]';
	const rowClass = 'grid grid-cols-[minmax(0,5.5rem)_1fr] items-baseline gap-2';
</script>

<aside
	class="grid gap-[1.1rem] border border-[var(--rule)] bg-[var(--paper)] p-5"
	aria-label="Quick facts"
>
	<section class={sectionClass}>
		<h2 class={headingClass}>quick facts</h2>
		<dl class={rowsClass}>
			{#each quickFacts as row (row.label)}
				<div class={rowClass}>
					<dt>{row.label}</dt>
					<dd>{row.value ?? '—'}</dd>
				</div>
			{/each}
		</dl>
	</section>

	{#if currentOffering}
		<section class={sectionClass}>
			<h2 class={headingClass}>current offering</h2>
			<dl class={rowsClass}>
				<div class={rowClass}>
					<dt>Term</dt>
					<dd>{currentOffering.term}</dd>
				</div>
				{#if currentOffering.instructor}
					<div class={rowClass}>
						<dt>Instructor</dt>
						<dd>
							{currentOffering.instructor.name}
							<span
								class="mt-[0.1rem] block tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]"
							>
								({currentOffering.instructor.sourceLabel ??
									currentOffering.instructor.verification})
							</span>
						</dd>
					</div>
				{/if}
				{#if currentOffering.crn}
					<div class={rowClass}>
						<dt>CRN</dt>
						<dd>{currentOffering.crn}</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}

	{#if upcomingOffering}
		<section class={sectionClass}>
			<h2 class={headingClass}>next offering</h2>
			<dl class={rowsClass}>
				<div class={rowClass}>
					<dt>Term</dt>
					<dd>{upcomingOffering.term}</dd>
				</div>
				{#if upcomingOffering.instructor}
					<div class={rowClass}>
						<dt>Instructor</dt>
						<dd>{upcomingOffering.instructor.name}</dd>
					</div>
				{/if}
			</dl>
		</section>
	{/if}

	{#if brief.studentReviews}
		<section class={sectionClass}>
			<h2 class={headingClass}>rmp rating</h2>
			<div class="grid gap-[0.4rem]">
				{#if rmpRating != null}
					<div
						class={[
							'font-hand text-[2.2rem] leading-none font-bold tracking-[-0.01em]',
							rmpVariant === 'ok' && 'text-[var(--ok)]',
							rmpVariant === 'warn' && 'text-[var(--ink)]',
							rmpVariant === 'crit' && 'text-[var(--pen-red)]',
							rmpVariant === 'idle' && 'text-[var(--ink-faint)]'
						]}
					>
						{rmpRating.toFixed(1)}<small
							class="ml-[0.1rem] font-normal text-[var(--ink-faint)] text-[var(--text-caption)]"
							>/5</small
						>
					</div>
					<div
						class="flex flex-wrap gap-x-[0.85rem] gap-y-2 font-[family-name:var(--font-body)] tracking-[0.1em] text-[var(--ink-soft)] text-[var(--text-caption)]"
					>
						{#if rmpWouldTake != null}<span>{rmpWouldTake}% would take again</span>{/if}
						{#if rmpCount != null}<span>{rmpCount} ratings</span>{/if}
					</div>
				{:else}
					<p
						class="m-0 font-[family-name:var(--font-body)] text-[var(--ink-faint)] text-[var(--text-small)]"
					>
						No RMP rating available.
					</p>
				{/if}
				{#if brief.studentReviews.rmpNote}
					<p
						class="m-0 font-[family-name:var(--font-body)] text-[0.875rem] leading-normal tracking-normal text-[var(--ink-soft)] normal-case"
					>
						{brief.studentReviews.rmpNote}
					</p>
				{/if}
			</div>
		</section>
	{/if}
</aside>
