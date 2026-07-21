<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import type { DigestWarning } from '$lib/dashboard/weekly';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const digest = $derived(data.digest);

	type MaterialWarning = Extract<DigestWarning, { kind: 'material_index' }>;
	type BriefingFinding = Extract<DigestWarning, { kind: 'briefing' }>;
	type PrerequisiteWarning = Extract<DigestWarning, { kind: 'prerequisite' }>;

	const materialWarnings = $derived(
		digest.warnings.filter(
			(warning): warning is MaterialWarning => warning.kind === 'material_index'
		)
	);
	const briefingFindings = $derived(
		digest.warnings.filter((warning): warning is BriefingFinding => warning.kind === 'briefing')
	);
	const prerequisiteWarnings = $derived(
		digest.warnings.filter(
			(warning): warning is PrerequisiteWarning => warning.kind === 'prerequisite'
		)
	);

	const hasAnyContent = $derived(
		digest.priorities.length +
			digest.deadlines.length +
			digest.crunchWindows.length +
			digest.studyGaps.length +
			digest.continuationItems.length +
			digest.warnings.length >
			0
	);

	function dateFromKey(key: string): Date {
		const [year, month, dayNumber] = key.split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, dayNumber));
	}

	function deadlineLabel(dueDate: string): string {
		return dateFromKey(dueDate).toLocaleDateString('en-US', {
			timeZone: 'UTC',
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	const rangeLabel = $derived.by(() => {
		const start = dateFromKey(digest.weekStart);
		const end = dateFromKey(digest.weekEnd);
		const format = (date: Date) =>
			date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
		return `${format(start)} – ${format(end)}, ${end.getUTCFullYear()}`;
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
		// hrefs are concrete app URLs produced by the weekly digest engine
		// (same guarded goto pattern as the dashboard; app base is empty).
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}
</script>

{#if $navigating}
	<div class="loading" aria-live="polite" role="status">
		<span></span><span></span><span></span>
		<em>updating plan</em>
	</div>
{/if}

<div class="weekly">
	<header class="weekly-head">
		<span class="weekly-kicker">The next seven days</span>
		<h1 class="weekly-title">Weekly Plan</h1>
		<p class="weekly-range">
			<span class="range">{rangeLabel}</span>
			<span class="generated">generated {generatedLabel}</span>
		</p>
	</header>

	{#if data.degraded.length > 0}
		<p class="degraded" role="status">
			Some sources were unavailable ({data.degraded.join(', ')}), so this plan may be incomplete.
		</p>
	{/if}

	{#if data.prose}
		<p class="prose">
			{data.prose}
			<span class="prose-model">ai summary · {data.proseModel}</span>
		</p>
	{/if}

	{#if !data.hasCourses}
		<section class="empty-panel" aria-label="No courses yet">
			<p class="empty-head">No course data yet.</p>
			<p class="empty-text">
				Set up a semester and add courses, and this page will plan the week for you.
			</p>
			<button class="btn btn-secondary btn-sm" onclick={() => navigate('/app/setup')}>
				Go to setup
			</button>
		</section>
	{:else if !hasAnyContent}
		<section class="empty-panel" aria-label="Nothing needs attention">
			<p class="empty-head">Nothing needs attention this week.</p>
			<p class="empty-text">
				Deadlines, crunch windows, study gaps, and paused practice will show up here as they appear.
			</p>
		</section>
	{:else}
		<section class="block" aria-label="Top priorities">
			<SectionHead eyebrow="Focus" title="This week’s priorities" meta="top 3" />
			{#if digest.priorities.length > 0}
				<ol class="priorities">
					{#each digest.priorities as item (item.id)}
						<li class="priority" class:first={item.rank === 1}>
							<span class="priority-rank" aria-hidden="true">{item.rank}</span>
							<div class="priority-body">
								<p class="priority-reason">{item.reason}</p>
								{#if item.factors.length > 0}
									<p class="priority-factors">{item.factors.join(' · ')}</p>
								{/if}
								<button class="btn btn-ghost btn-sm" onclick={() => navigate(item.link.href)}>
									{item.link.label} →
								</button>
							</div>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="quiet">
					No priorities right now — no deadlines, paused practice, or unindexed materials.
				</p>
			{/if}
		</section>

		{#if digest.crunchWindows.length > 0}
			<section class="block" aria-label="Crunch windows">
				{#each digest.crunchWindows as window (`${window.startDate}-${window.endDate}`)}
					<div class="crunch">
						<span class="crunch-stamp">crunch</span>
						<p class="crunch-text">
							{window.reason}
							<span class="crunch-events">{window.eventTitles.join(' · ')}</span>
						</p>
						<button class="btn btn-ghost btn-sm" onclick={() => navigate(window.link.href)}>
							{window.link.label} →
						</button>
					</div>
				{/each}
			</section>
		{/if}

		<section class="block" aria-label="Deadlines">
			<SectionHead
				eyebrow="Chronological"
				title="Deadlines"
				meta={`${digest.deadlines.length} in plan`}
			/>
			{#if digest.deadlines.length > 0}
				<ul class="deadlines">
					{#each digest.deadlines as deadline (deadline.id)}
						<li class="deadline" class:overdue={deadline.overdue}>
							<span class="deadline-date">
								{deadlineLabel(deadline.dueDate)}
								{#if deadline.time}<span class="deadline-time">· {deadline.time}</span>{/if}
							</span>
							<span class="deadline-main">
								<span class="deadline-title">{deadline.title}</span>
								<span class="deadline-course">{deadline.courseCode}</span>
							</span>
							<span class="deadline-weight" title="Grade weight">
								{deadline.gradeWeight != null ? `${deadline.gradeWeight}%` : '—'}
							</span>
							{#if deadline.overdue}<span class="overdue-tag">overdue</span>{/if}
							<button class="btn btn-ghost btn-sm" onclick={() => navigate(deadline.link.href)}>
								Calendar →
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="quiet">No deadlines in the next seven days.</p>
			{/if}
		</section>

		<div class="columns">
			<section class="block" aria-label="Continue learning">
				<SectionHead eyebrow="Practice" title="Continue learning" />
				{#if digest.continuationItems.length > 0}
					<ul class="plain-list">
						{#each digest.continuationItems as item (item.id)}
							<li>
								<p class="list-reason">{item.reason}</p>
								<button class="btn btn-ghost btn-sm" onclick={() => navigate(item.link.href)}>
									{item.link.label} →
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="quiet">No paused or in-progress practice sessions.</p>
				{/if}
			</section>

			<section class="block" aria-label="Study gaps">
				<SectionHead eyebrow="Activity" title="Study gaps" />
				{#if digest.studyGaps.length > 0}
					<ul class="plain-list">
						{#each digest.studyGaps as gap (gap.courseId)}
							<li>
								<p class="list-reason">{gap.reason}</p>
								<button class="btn btn-ghost btn-sm" onclick={() => navigate(gap.link.href)}>
									{gap.link.label} →
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="quiet">Every course with deadlines has recent study time.</p>
				{/if}
			</section>
		</div>

		{#if materialWarnings.length > 0}
			<section class="block" aria-label="Material indexing">
				<SectionHead eyebrow="Practice materials" title="Material indexing" />
				<ul class="plain-list">
					{#each materialWarnings as warning (warning.materialId)}
						<li>
							<p class="list-reason">{warning.message}</p>
							<button class="btn btn-ghost btn-sm" onclick={() => navigate(warning.link.href)}>
								{warning.link.label} →
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if briefingFindings.length > 0}
			<section class="block" aria-label="From your course briefs">
				<SectionHead eyebrow="Research" title="From your course briefs" />
				<ul class="plain-list">
					{#each briefingFindings as finding (finding.message)}
						<li>
							<p class="list-reason">{finding.message}</p>
							<button class="btn btn-ghost btn-sm" onclick={() => navigate(finding.link.href)}>
								{finding.link.label} →
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if prerequisiteWarnings.length > 0}
			<section class="block" aria-label="Course map notes">
				<SectionHead eyebrow="Course map" title="Sequencing notes" />
				<ul class="plain-list">
					{#each prerequisiteWarnings as warning (warning.message)}
						<li>
							<p class="list-reason">{warning.message}</p>
							<button class="btn btn-ghost btn-sm" onclick={() => navigate(warning.link.href)}>
								{warning.link.label} →
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.weekly {
		max-width: 62rem;
		margin: 0 auto;
		padding: 1.5rem 2rem 4rem;
		display: grid;
		gap: 2rem;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem 2rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.loading span {
		width: 0.3rem;
		height: 0.3rem;
		background: var(--ink-faint);
		animation: weekly-dot 1s var(--ease-out-quart) infinite;
	}
	.loading span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.loading span:nth-child(3) {
		animation-delay: 0.3s;
	}
	.loading em {
		font-style: normal;
		margin-left: 0.3rem;
	}
	@keyframes weekly-dot {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}

	.weekly-head {
		display: grid;
		gap: 0.35rem;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1rem;
	}
	.weekly-kicker {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.weekly-title {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 2rem;
		line-height: 1.05;
		color: var(--ink);
		margin: 0;
	}
	.weekly-range {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink-soft);
	}
	.weekly-range .range {
		background: var(--highlight);
		color: var(--ink);
		padding: 0.05rem 0.35rem;
	}
	.weekly-range .generated {
		color: var(--ink-faint);
	}

	.degraded {
		margin: 0;
		border: 1px dashed rgba(192, 138, 46, 0.55);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.85rem;
		line-height: 1.5;
		padding: 0.7rem 0.9rem;
	}

	.prose {
		margin: 0;
		border-left: 3px solid var(--rule);
		padding: 0.3rem 0 0.3rem 1rem;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--ink-soft);
	}
	.prose-model {
		display: block;
		margin-top: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.empty-panel {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding: 4rem 1.5rem;
		border: 1px dashed var(--rule-soft);
		text-align: center;
	}
	.empty-head {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.6rem;
		color: var(--ink);
		margin: 0;
	}
	.empty-text {
		font-size: 0.95rem;
		color: var(--ink-soft);
		margin: 0;
		max-width: 34rem;
		line-height: 1.5;
	}

	.block {
		display: grid;
		gap: 0.75rem;
	}

	.quiet {
		margin: 0;
		border: 1px dashed var(--rule-soft);
		color: var(--ink-faint);
		font-size: 0.85rem;
		padding: 0.8rem;
	}

	.priorities {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.priority {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 0.8rem 0.9rem;
	}
	.priority.first {
		border-color: var(--ink);
	}
	.priority-rank {
		flex: none;
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.3rem;
		border: 1px solid var(--ink);
		color: var(--ink);
	}
	.priority.first .priority-rank {
		background: var(--highlight);
	}
	.priority-body {
		display: grid;
		gap: 0.3rem;
		min-width: 0;
	}
	.priority-reason {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--ink);
	}
	.priority-factors {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.priority-body .btn {
		justify-self: start;
	}

	.crunch {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 0.9rem;
		border-left: 3px solid var(--warn);
		background: var(--paper-shelf);
		padding: 0.7rem 0.9rem;
	}
	.crunch-stamp {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--warn);
		border: 1px dashed var(--warn);
		padding: 0.05rem 0.5rem;
		text-transform: lowercase;
	}
	.crunch-text {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--ink);
		flex: 1 1 20rem;
	}
	.crunch-events {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-soft);
		margin-top: 0.2rem;
	}
	.crunch .btn {
		margin-left: auto;
	}

	.deadlines {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	.deadline {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding: 0.6rem 0.2rem;
		border-bottom: 1px solid var(--rule-soft);
	}
	.deadline-date {
		flex: none;
		width: 9.5rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink);
	}
	.deadline-time {
		color: var(--ink-faint);
	}
	.deadline-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.3rem 0.6rem;
	}
	.deadline-title {
		font-size: 0.92rem;
		color: var(--ink);
	}
	.deadline-course {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-soft);
		background: var(--paper-shelf);
		padding: 0.05rem 0.4rem;
	}
	.deadline-weight {
		flex: none;
		width: 3rem;
		text-align: right;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink-soft);
	}
	.overdue-tag {
		flex: none;
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 0.8rem;
		color: var(--pen-red);
		border: 1px dashed var(--pen-red);
		padding: 0 0.45rem;
		transform: rotate(-2deg);
	}
	.deadline .btn {
		flex: none;
	}

	.columns {
		display: grid;
		gap: 2rem;
	}
	@media (min-width: 56rem) {
		.columns {
			grid-template-columns: 1fr 1fr;
		}
	}

	.plain-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.plain-list li {
		border: 1px solid var(--rule-soft);
		background: var(--paper);
		padding: 0.65rem 0.8rem;
		display: grid;
		gap: 0.3rem;
		justify-items: start;
	}
	.list-reason {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--ink);
	}

	@media (max-width: 40rem) {
		.weekly {
			padding: 1rem 1rem 3rem;
		}
		.deadline {
			flex-wrap: wrap;
			gap: 0.4rem 0.8rem;
		}
		.deadline-date {
			width: auto;
		}
		.deadline .btn {
			margin-left: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loading span {
			animation: none;
		}
	}
</style>
