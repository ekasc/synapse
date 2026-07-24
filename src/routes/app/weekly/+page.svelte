<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';
	import WeeklyMetrics from '$lib/components/weekly/WeeklyMetrics.svelte';
	import NextUpCard from '$lib/components/weekly/NextUpCard.svelte';
	import WeeklyTimeline from '$lib/components/weekly/WeeklyTimeline.svelte';
	import WeeklyPriorityList from '$lib/components/weekly/WeeklyPriorityList.svelte';
	import CollapsibleSection from '$lib/components/weekly/CollapsibleSection.svelte';
	import { buildWeeklyViewModel } from '$lib/dashboard/weekly-view-model';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let regenerating = $state(false);
	const digest = $derived(data.digest);
	const model = $derived(buildWeeklyViewModel(digest));
	const hasAnyContent = $derived(
		digest.priorities.length +
			digest.deadlines.length +
			digest.studyGaps.length +
			digest.continuationItems.length +
			digest.warnings.length >
			0
	);

	function dateFromKey(key: string): Date {
		const [year, month, day] = key.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	const rangeLabel = $derived.by(() => {
		const start = dateFromKey(digest.weekStart);
		const end = dateFromKey(digest.weekEnd);
		const format = (date: Date) =>
			date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `${format(start)} – ${format(end)}, ${end.getFullYear()}`;
	});
	const generatedLabel = $derived(
		new Date(digest.generatedAt).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		})
	);

	function navigate(href: string) {
		if (!href.startsWith('/app/') || href.startsWith('//')) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}
</script>

<svelte:head><title>Weekly plan · Synapse</title></svelte:head>

{#if $navigating || regenerating}
	<div class="loading" role="status" aria-live="polite">
		<LoadingDots label={regenerating ? 'Regenerating plan' : 'Updating plan'} />
	</div>
{/if}

<div class="weekly">
	<header class="weekly-head">
		<div>
			<span class="kicker">The next seven days</span>
			<h1>Weekly Plan</h1>
			<p class="range">
				<span>{rangeLabel}</span> generated {generatedLabel}{#if data.cached}<b>cached</b
					>{/if}{#if data.isSunday}<b>new week</b>{/if}
			</p>
		</div>
		<form
			method="POST"
			action="?/regenerate"
			use:enhance={() => {
				regenerating = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						regenerating = false;
					}
				};
			}}
		>
			<button class="btn btn-ghost btn-sm" disabled={regenerating}
				>{regenerating ? 'Regenerating…' : 'Regenerate'}</button
			>
		</form>
	</header>

	{#if data.degraded.length}
		<p class="degraded" role="status">
			Some sources were unavailable ({data.degraded.join(', ')}). This plan may be incomplete.
		</p>
	{/if}

	{#if !data.hasCourses}
		<section class="empty">
			<h2>No course data yet.</h2>
			<p>Set up a semester and add courses, and this page will plan the week for you.</p>
			<button class="btn btn-secondary btn-sm" onclick={() => navigate('/app/setup')}
				>Go to setup</button
			>
		</section>
	{:else if !hasAnyContent}
		<section class="empty">
			<h2>Your week is clear.</h2>
			<p>No deadlines, paused practice, or plan warnings need attention right now.</p>
		</section>
	{:else}
		{#if data.prose}
			<details class="glance">
				<summary>Week at a glance</summary>
				<p>{data.prose}</p>
				<small>AI summary · {data.proseModel}</small>
			</details>
		{/if}

		<WeeklyMetrics metrics={model.metrics} />
		{#if model.nextUp}<NextUpCard item={model.nextUp} onnavigate={navigate} />{/if}
		<WeeklyTimeline days={model.days} overdue={model.overdue} onnavigate={navigate} />
		{#if model.priorities.length}<WeeklyPriorityList
				priorities={model.priorities}
				onnavigate={navigate}
			/>{/if}

		<div class="secondary">
			{#if digest.continuationItems.length}
				<CollapsibleSection
					title="Continue learning"
					count={digest.continuationItems.length}
					hint={`${digest.continuationItems.length} session${digest.continuationItems.length === 1 ? '' : 's'}`}
				>
					<ul>
						{#each digest.continuationItems as item (item.id)}<li>
								<div><strong>{item.courseCode}</strong><span>{item.reason}</span></div>
								<button class="btn btn-ghost btn-sm" onclick={() => navigate(item.link.href)}
									>{item.link.label} →</button
								>
							</li>{/each}
					</ul>
				</CollapsibleSection>
			{/if}
			{#if digest.studyGaps.length}
				<CollapsibleSection
					title="Study gaps"
					count={digest.studyGaps.length}
					hint={`${digest.studyGaps.length} course${digest.studyGaps.length === 1 ? '' : 's'}`}
				>
					<ul>
						{#each digest.studyGaps as gap (gap.courseId)}<li>
								<div><strong>{gap.courseCode}</strong><span>{gap.reason}</span></div>
								<button class="btn btn-ghost btn-sm" onclick={() => navigate(gap.link.href)}
									>{gap.link.label} →</button
								>
							</li>{/each}
					</ul>
				</CollapsibleSection>
			{/if}
			{#if model.healthCount || data.degraded.length}
				<CollapsibleSection
					title="Plan health"
					count={model.healthCount + data.degraded.length}
					hint={`${model.healthCount + data.degraded.length} item${model.healthCount + data.degraded.length === 1 ? '' : 's'} need review`}
				>
					<div class="health">
						{#if data.degraded.length}<p>
								<strong>Unavailable sources</strong><span>{data.degraded.join(', ')}</span>
							</p>{/if}
						{#each model.materialWarnings as warning (warning.materialId)}<p>
								<strong>Material indexing · {warning.courseCode ?? 'Unknown course'}</strong><span
									>{warning.message}</span
								><button class="btn btn-ghost btn-sm" onclick={() => navigate(warning.link.href)}
									>{warning.link.label} →</button
								>
							</p>{/each}
						{#each model.briefingWarnings as warning, index (`briefing:${warning.courseCode}:${index}:${warning.message}`)}<p
							>
								<strong>Course brief · {warning.courseCode}</strong><span>{warning.message}</span
								><button class="btn btn-ghost btn-sm" onclick={() => navigate(warning.link.href)}
									>{warning.link.label} →</button
								>
							</p>{/each}
						{#each model.prerequisiteWarnings as warning, index (`prerequisite:${warning.courseCode}:${index}:${warning.message}`)}<p
							>
								<strong>Sequencing · {warning.courseCode}</strong><span>{warning.message}</span
								><button class="btn btn-ghost btn-sm" onclick={() => navigate(warning.link.href)}
									>{warning.link.label} →</button
								>
							</p>{/each}
						{#each model.invalidDateWarnings as warning, index (`invalid-date:${warning.courseCode ?? 'none'}:${index}:${warning.message}`)}<p
							>
								<strong>Invalid date</strong><span>{warning.message}</span>
							</p>{/each}
					</div>
				</CollapsibleSection>
			{/if}
		</div>
	{/if}
</div>

<style>
	.weekly {
		max-width: 72rem;
		margin: 0 auto;
		padding-block: 1.5rem 4rem;
		display: grid;
		gap: 1.5rem;
	}
	.loading {
		max-width: 72rem;
		margin: 0 auto;
		padding: 0.5rem 0;
	}
	.weekly-head {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--rule);
	}
	.weekly-head > div {
		display: grid;
		gap: 0.3rem;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	h1 {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 2rem;
		line-height: 1.05;
		color: var(--ink);
	}
	.range {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--ink-faint);
	}
	.range > span {
		padding: 0.05rem 0.35rem;
		background: var(--highlight);
		color: var(--ink);
	}
	.range b {
		padding: 0.05rem 0.32rem;
		border: 1px solid var(--rule-soft);
		font-size: 0.55rem;
		text-transform: uppercase;
		font-weight: 400;
	}
	.degraded {
		margin: 0;
		padding: 0.65rem 0.8rem;
		border: 1px dashed color-mix(in srgb, var(--warn) 55%, transparent);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.8rem;
	}
	.glance {
		border: 1px solid var(--rule);
		padding: 0.65rem 0.8rem;
	}
	.glance summary {
		cursor: pointer;
		font-family: var(--hand);
		font-weight: 700;
		color: var(--ink);
	}
	.glance p {
		margin: 0.5rem 0 0.25rem;
		max-width: 58rem;
		line-height: 1.55;
		color: var(--ink-soft);
		font-size: 0.88rem;
	}
	.glance small {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.secondary {
		display: grid;
		gap: 0.65rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.55rem 0.65rem;
		background: var(--paper-shelf);
	}
	li > div,
	.health p {
		display: grid;
		gap: 0.12rem;
	}
	li strong,
	.health strong {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		color: var(--ink);
	}
	li span,
	.health span {
		font-size: 0.78rem;
		line-height: 1.4;
		color: var(--ink-soft);
	}
	.health {
		display: grid;
		gap: 0.4rem;
	}
	.health p {
		margin: 0;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--rule-soft);
		justify-items: start;
	}
	.empty {
		min-height: 20rem;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.7rem;
		text-align: center;
		border: 1px dashed var(--rule);
		padding: 2rem;
	}
	.empty h2 {
		margin: 0;
		font-family: var(--font-hand);
		color: var(--ink);
	}
	.empty p {
		margin: 0;
		color: var(--ink-soft);
	}
	@media (max-width: 40rem) {
		.weekly {
			padding-block: 1rem 3rem;
			gap: 1.2rem;
		}
		.weekly-head {
			align-items: start;
			flex-direction: column;
		}
		li {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
