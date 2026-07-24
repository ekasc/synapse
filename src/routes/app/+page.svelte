<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import type { PriorityItem } from '$lib/dashboard/priority';

	let { data } = $props();
	let { semesters, courses } = $derived(data);
	const { summary, attentionItems, agendaDays, continueItems, currentTermLabel, termContextLabel } =
		$derived(data);
	const quietWeek = $derived(attentionItems.length === 0 && agendaDays.length === 0);
	const continueTitle = $derived(
		continueItems.length === 0 ||
			continueItems.some((item: PriorityItem) => item.kind === 'practice')
			? 'Continue working'
			: continueItems.every((item: PriorityItem) => item.kind === 'briefing')
				? 'Recent research'
				: 'Recent work'
	);

	const subjectColors: Record<string, string> = {
		COMP: 'var(--subject-comp)',
		MATH: 'var(--subject-math)',
		CSIS: 'var(--subject-csis)',
		STAT: 'var(--subject-stat)',
		ECON: 'var(--subject-econ)',
		ISYS: 'var(--subject-isys)',
		HUMN: 'var(--subject-humn)'
	};

	const courseColors = $derived(
		new Map(
			courses.map((course) => [
				course.code,
				course.color ?? subjectColors[course.code.split(/[\s-]/)[0]] ?? 'var(--accent)'
			])
		)
	);

	const todayEyebrow = $derived(
		new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
	);

	function navigate(href: string) {
		if (!href.startsWith('/app/') || href.startsWith('//')) return;
		void goto(href);
	}

	function addDeadline() {
		navigate('/app/calendar?new=1');
	}

	function fixed(path: '/app/calendar' | '/app/brief' | '/app/courses') {
		void goto(resolveRoute(path));
	}

	function colorFor(item: PriorityItem) {
		return item.courseCode
			? (courseColors.get(item.courseCode) ?? 'var(--accent)')
			: 'var(--ink-faint)';
	}
</script>

<svelte:head><title>Synapse · Today's focus</title></svelte:head>

<div class="page">
	{#if semesters.length === 0}
		<section class="empty-onboarding" aria-labelledby="onboarding-title">
			<div class="eyebrow">First page</div>
			<h1 id="onboarding-title" class="page-title font-hand">Set up your notebook</h1>
			<p class="page-tagline">Add your semesters and courses to see what needs attention today.</p>
			<button class="btn btn-primary" onclick={() => navigate('/app/semesters?new=1')}
				>Add your first semester →</button
			>
		</section>
	{:else}
		<header class="brief-header">
			<div>
				<div class="eyebrow">Today · {todayEyebrow}</div>
				<h1 class="page-title font-hand">Today's focus</h1>
				<p class="page-tagline">{summary.sentence}</p>
				<div class="term-meta">{termContextLabel ?? 'Term'} · {currentTermLabel ?? '—'}</div>
			</div>
			<button class="btn btn-primary" onclick={addDeadline}>+ add deadline</button>
		</header>

		<div class:quiet={quietWeek} class="brief-grid">
			<main class="main-column">
				{#if quietWeek}
					<section class="all-clear" aria-labelledby="all-clear-title">
						<div class="all-clear-mark" aria-hidden="true">✓</div>
						<div>
							<div class="row-meta">Week clear</div>
							<h2 id="all-clear-title" class="section-title font-hand">
								Make progress before the next deadline.
							</h2>
							<p>Use the open week for practice, review, or planning ahead.</p>
						</div>
					</section>
				{:else}
					{#if attentionItems.length}
						<section aria-labelledby="attention-title">
							<div class="section-head">
								<h2 id="attention-title" class="section-title font-hand">Needs attention</h2>
								<span class="section-meta">{attentionItems.length} items</span>
							</div>
							<div class="item-list">
								{#each attentionItems as item (item.id)}
									<article class="priority-row {item.tone}">
										<div class="row-copy">
											<div class="row-meta">{item.courseCode ?? item.kind} · {item.eyebrow}</div>
											<h3>{item.title}</h3>
											<p>{item.reason}{item.dateLabel ? ` · ${item.dateLabel}` : ''}</p>
										</div>
										<button class="btn btn-ghost btn-sm" onclick={() => navigate(item.href)}
											>{item.actionLabel} →</button
										>
									</article>
								{/each}
							</div>
						</section>
					{/if}

					{#if agendaDays.length}
						<section aria-labelledby="agenda-title">
							<div class="section-head">
								<h2 id="agenda-title" class="section-title font-hand">Next 7 days</h2>
								<button class="text-link" onclick={() => fixed('/app/calendar')}
									>full calendar →</button
								>
							</div>
							<div class="agenda">
								{#each agendaDays as day (day.date)}
									<div class="agenda-day">
										<div class="day-label">{day.dateLabel}</div>
										{#each day.items as item (item.id)}<article class="agenda-row">
												<span class="course-edge" style={`background: ${colorFor(item)}`}></span>
												<div class="row-copy">
													<div class="row-meta">
														{item.courseCode ?? item.kind} · {item.eyebrow}
													</div>
													<h3>{item.title}</h3>
													<p>{item.reason}</p>
												</div>
												<button class="btn btn-ghost btn-sm" onclick={() => navigate(item.href)}
													>{item.actionLabel} →</button
												>
											</article>{/each}
									</div>
								{/each}
							</div>
						</section>
					{/if}
				{/if}
			</main>

			<aside class="rail">
				<section aria-labelledby="continue-title">
					<div class="section-head">
						<h2 id="continue-title" class="section-title font-hand">{continueTitle}</h2>
					</div>
					{#if continueItems.length}<div class="continue-list">
							{#each continueItems as item (item.id)}<article class="continue-row">
									<div class="row-copy">
										<div class="row-meta">{item.courseCode ?? item.kind} · {item.eyebrow}</div>
										<h3>{item.title}</h3>
										<p>{item.reason}</p>
									</div>
									<button class="btn btn-ghost btn-sm" onclick={() => navigate(item.href)}
										>{item.actionLabel} →</button
									>
								</article>{/each}
						</div>{:else}<p class="quiet-message">
							Your desk is clear. Pick a place to begin.
						</p>{/if}
				</section>
				<section aria-labelledby="quick-title">
					<div class="section-head">
						<h2 id="quick-title" class="section-title font-hand">Quick actions</h2>
					</div>
					<nav class="quick-actions" aria-label="Quick actions">
						<button onclick={() => navigate('/app/semesters')}>Add a course <span>→</span></button
						><button onclick={() => fixed('/app/brief')}>Research a course <span>→</span></button
						><button onclick={() => fixed('/app/courses')}>Open course map <span>→</span></button>
					</nav>
				</section>
			</aside>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding: 2rem 0 4rem;
	}
	.brief-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--ink);
		margin-bottom: 2rem;
	}
	.eyebrow,
	.row-meta,
	.day-label,
	.term-meta,
	.section-meta {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}
	.eyebrow {
		margin-bottom: 0.5rem;
	}
	.page-title {
		font-size: clamp(1.8rem, 4vw, 2.5rem);
		margin: 0.2rem 0 0.45rem;
		line-height: 1;
	}
	.page-tagline {
		color: var(--ink-soft);
		font-size: 1rem;
		line-height: 1.5;
		margin: 0;
		max-width: 38rem;
	}
	.term-meta {
		margin-top: 0.8rem;
		color: var(--ink-soft);
	}
	.brief-grid {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 3rem;
	}
	.brief-grid.quiet {
		grid-template-columns: 1fr 1fr;
	}
	.all-clear {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--rule);
		background: color-mix(in srgb, var(--ok) 8%, var(--paper));
	}
	.all-clear-mark {
		display: grid;
		width: 1.75rem;
		height: 1.75rem;
		flex: 0 0 1.75rem;
		place-items: center;
		border: 1px solid var(--ok);
		color: var(--ok);
		font-weight: 700;
	}
	.all-clear .section-title {
		margin-top: 0.25rem;
	}
	.all-clear p {
		margin: 0.45rem 0 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.main-column,
	.rail {
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--ink);
		padding-bottom: 0.65rem;
	}
	.section-title {
		font-size: 1.45rem;
		margin: 0;
	}
	.item-list,
	.agenda,
	.continue-list {
		display: flex;
		flex-direction: column;
	}
	.priority-row,
	.agenda-row,
	.continue-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		border-bottom: 1px solid var(--rule);
		padding: 0.85rem 0 0.85rem 0.75rem;
		position: relative;
	}
	.priority-row::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.85rem;
		bottom: 0.85rem;
		width: 4px;
		background: var(--ink-faint);
	}
	.priority-row.critical::before {
		background: var(--pen-red);
	}
	.priority-row.warning::before {
		background: var(--warn);
	}
	.row-copy {
		min-width: 0;
		flex: 1;
	}
	.row-copy h3 {
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0.2rem 0;
	}
	.row-copy p {
		font-size: 0.84rem;
		line-height: 1.4;
		color: var(--ink-soft);
		margin: 0;
	}
	.row-meta {
		font-size: 0.64rem;
	}
	.day-label {
		padding: 1rem 0 0.35rem;
		color: var(--ink-soft);
	}
	.agenda-row {
		padding-left: 0;
	}
	.course-edge {
		width: 4px;
		align-self: stretch;
		min-height: 2.5rem;
		flex-shrink: 0;
	}
	.text-link {
		border: 0;
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
		font: 0.72rem var(--font-mono);
		text-transform: uppercase;
	}
	.text-link:hover {
		color: var(--ink);
	}
	.quiet-message {
		font-size: 0.92rem;
		line-height: 1.5;
		padding: 1rem 0;
		color: var(--ink-soft);
	}
	.quick-actions {
		display: flex;
		flex-direction: column;
	}
	.quick-actions button {
		display: flex;
		justify-content: space-between;
		padding: 0.75rem 0;
		border: 0;
		border-bottom: 1px solid var(--rule);
		background: none;
		color: var(--ink);
		cursor: pointer;
		text-align: left;
		font: 500 0.88rem var(--font-body);
	}
	.quick-actions button:hover {
		background: var(--highlight-soft);
	}
	.empty-onboarding {
		text-align: center;
		padding: 4rem 1rem;
	}
	.empty-onboarding .page-tagline {
		margin: 0 auto 1.5rem;
	}
	@media (max-width: 800px) {
		.page {
			padding: 1.5rem 1rem 3rem;
		}
		.brief-header {
			align-items: stretch;
			flex-direction: column;
		}
		.brief-header .btn {
			align-self: flex-start;
		}
		.brief-grid,
		.brief-grid.quiet {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
	}
</style>
