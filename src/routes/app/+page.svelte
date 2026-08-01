<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import type { PriorityItem } from '$lib/dashboard/priority';
	import AddDeadlineDialog from '$lib/components/dashboard/AddDeadlineDialog.svelte';

	let { data } = $props();
	let { semesters, courses, dashboardDataAvailable } = $derived(data);
	const { summary, attentionItems, agendaDays } = $derived(data);
	const quietWeek = $derived(attentionItems.length === 0 && agendaDays.length === 0);

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

	function colorFor(item: PriorityItem) {
		return item.courseCode
			? (courseColors.get(item.courseCode) ?? 'var(--accent)')
			: 'var(--ink-faint)';
	}

	const toneRank: Record<PriorityItem['tone'], number> = { critical: 2, warning: 1, neutral: 0 };
	const ranked = $derived(
		[...attentionItems].sort(
			(a, b) =>
				toneRank[b.tone] - toneRank[a.tone] ||
				(b.daysLate ?? 0) - (a.daysLate ?? 0) ||
				(b.gradeWeight ?? 0) - (a.gradeWeight ?? 0) ||
				a.title.localeCompare(b.title)
		)
	);
	const hero = $derived(ranked[0] ?? null);
	const rest = $derived(ranked.slice(1));

	let expanded = $state(false);
	const visibleRest = $derived(expanded ? rest : rest.slice(0, 3));
	const hiddenCount = $derived(rest.length - visibleRest.length);

	const attentionIds = $derived(new Set(attentionItems.map((item) => item.id)));
	const futureDays = $derived(
		agendaDays
			.map((day) => ({ ...day, items: day.items.filter((item) => !attentionIds.has(item.id)) }))
			.filter((day) => day.items.length > 0)
	);

	let addOpen = $state(false);
	let saveNotice = $state('');

	function navigate(href: string) {
		if (!href.startsWith('/app/') || href.startsWith('//')) return;
		// href comes from validated priority items (all /app/* routes); the route
		// union can't express arbitrary strings, so resolveRoute is bypassed.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(href);
	}

	function fixed(path: '/app/calendar' | '/app/brief' | '/app/courses') {
		void goto(resolveRoute(path));
	}

	async function onDeadlineSaved() {
		addOpen = false;
		await invalidateAll();
		saveNotice = 'Deadline added.';
	}
</script>

<svelte:head><title>Dashboard · Synapse</title></svelte:head>

<div class="page">
	{#if !dashboardDataAvailable}
		<section class="empty-onboarding" aria-labelledby="dashboard-error-title">
			<h1 id="dashboard-error-title" class="page-title">Dashboard unavailable</h1>
			<p class="page-tagline">Your academic data could not be refreshed. Try loading it again.</p>
			<button class="btn btn-primary" onclick={() => invalidateAll()}>Try again</button>
		</section>
	{:else if semesters.length === 0}
		<section class="empty-onboarding" aria-labelledby="onboarding-title">
			<h1 id="onboarding-title" class="page-title">Set up your workspace</h1>
			<p class="page-tagline">Add a semester, then your courses, to see what needs attention.</p>
			<button class="btn btn-primary" onclick={() => navigate('/app/semesters?new=1')}
				>Add your first semester</button
			>
		</section>
	{:else if courses.length === 0}
		<section class="empty-onboarding" aria-labelledby="courses-empty-title">
			<h1 id="courses-empty-title" class="page-title">Add your first course</h1>
			<p class="page-tagline">
				Courses connect your deadlines, materials, and progress in one place.
			</p>
			<button class="btn btn-primary" onclick={() => navigate('/app/semesters')}
				>Add a course</button
			>
		</section>
	{:else}
		<header class="focus-header">
			<div class="focus-heading">
				<h1 class="page-title">Today's focus</h1>
				<p class="status-line" aria-live="polite">{summary.sentence}</p>
			</div>
			<button
				class="btn btn-primary"
				onclick={() => {
					saveNotice = '';
					addOpen = true;
				}}>Add deadline</button
			>
		</header>
		{#if saveNotice}
			<p class="save-notice" role="status">{saveNotice}</p>
		{/if}

		{#if quietWeek}
			<section class="all-clear" aria-labelledby="all-clear-title">
				<div class="all-clear-mark" aria-hidden="true">✓</div>
				<div>
					<h2 id="all-clear-title" class="section-title">Make progress before the next deadline</h2>
					<p>Use the open week for practice or plan ahead in your calendar.</p>
					<div class="all-clear-actions">
						<button class="btn btn-secondary" onclick={() => navigate('/app/practice')}
							>Practice</button
						>
						<button class="btn btn-secondary" onclick={() => fixed('/app/calendar')}
							>Plan ahead</button
						>
					</div>
				</div>
			</section>
		{:else}
			<div class="focus-main">
				{#if hero}
					<section aria-label="Next up">
						<button
							class="upnext"
							style={`--edge: ${colorFor(hero)}`}
							onclick={() => navigate(hero.href)}
						>
							<span class="upnext-copy">
								<span class="upnext-meta">
									<span class="upnext-chip">{hero.eyebrow}</span>
									{hero.courseCode ?? hero.kind}{hero.dateLabel
										? ` · ${hero.dateLabel}`
										: ''}{hero.gradeWeight ? ` · ${hero.gradeWeight}% of grade` : ''}
								</span>
								<span class="upnext-title">{hero.title}</span>
								<span class="upnext-reason">{hero.reason}</span>
							</span>
							<span class="item-action">{hero.actionLabel} <span aria-hidden="true">→</span></span>
						</button>
					</section>
					{#if hero && !rest.length && !futureDays.length}
						<p class="quiet-line">Nothing else on your plate this week.</p>
					{/if}
				{/if}

				{#if rest.length}
					<section aria-labelledby="attention-title">
						<div class="section-head">
							<h2 id="attention-title" class="section-title">Also needs attention</h2>
							<span class="section-count">{rest.length} items</span>
						</div>
						<div class="item-list">
							{#each visibleRest as item (item.id)}
								<button
									class="row-card"
									style={`--edge: ${colorFor(item)}`}
									onclick={() => navigate(item.href)}
								>
									<span class="row-copy">
										<span class="row-meta"
											>{item.courseCode ?? item.kind} · {item.eyebrow}{item.dateLabel
												? ` · ${item.dateLabel}`
												: ''}</span
										>
										<span class="row-title">{item.title}</span>
									</span>
									<span class="item-action"
										>{item.actionLabel} <span aria-hidden="true">→</span></span
									>
								</button>
							{/each}
						</div>
						{#if hiddenCount > 0 && !expanded}
							<button class="more-toggle" onclick={() => (expanded = true)}>
								Show {hiddenCount} more
							</button>
						{:else if expanded && rest.length > 3}
							<button class="more-toggle" onclick={() => (expanded = false)}>Show fewer</button>
						{/if}
					</section>
				{/if}

				{#if futureDays.length}
					<section aria-labelledby="agenda-title">
						<div class="section-head">
							<h2 id="agenda-title" class="section-title">Coming up</h2>
							<button class="text-link" onclick={() => fixed('/app/calendar')}
								>full calendar →</button
							>
						</div>
						<div class="agenda">
							{#each futureDays as day (day.date)}
								<div class="agenda-day">
									<div class="day-label">{day.dateLabel}</div>
									{#each day.items as item (item.id)}
										<button
											class="row-card"
											style={`--edge: ${colorFor(item)}`}
											onclick={() => navigate(item.href)}
										>
											<span class="row-copy">
												<span class="row-meta">{item.courseCode ?? item.kind} · {item.reason}</span>
												<span class="row-title">{item.title}</span>
											</span>
											<span class="item-action"
												>{item.actionLabel} <span aria-hidden="true">→</span></span
											>
										</button>
									{/each}
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<AddDeadlineDialog bind:open={addOpen} {courses} onsaved={onDeadlineSaved} />

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding: 2.5rem 0 4rem;
	}

	/* ── Header ── */
	.focus-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1.5rem;
		padding-bottom: 1.4rem;
		border-bottom: 2px solid var(--ink);
		margin-bottom: 2.25rem;
	}
	.page-title {
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 2.25rem;
		line-height: 1.1;
		margin: 0;
		text-wrap: balance;
	}
	.page-tagline {
		font: 400 var(--text-small)/1.5 var(--font-body);
		color: var(--ink-soft);
		margin: 0;
		max-width: 40rem;
	}

	/* ── Status line ── */
	.status-line {
		margin: 0.65rem 0 0;
		font: 500 var(--text-small)/1.45 var(--font-body);
		color: var(--ink-soft);
	}

	.focus-main {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}
	/* ── Section headings ── */
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}
	.section-title {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1.15rem;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.section-count {
		font: 500 var(--text-caption)/1 var(--font-body);
		color: var(--ink-faint);
	}

	/* ── Hero card ── */
	.upnext {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: 1.25rem;
		width: 100%;
		text-align: left;
		border: 1px solid var(--ink);
		background: color-mix(in srgb, var(--edge) 8%, var(--paper));
		padding: 1.5rem;
		cursor: pointer;
		transition:
			transform 0.18s var(--ease-out-quart),
			box-shadow 0.18s var(--ease-out-quart);
	}
	.upnext:hover {
		transform: translateY(-2px);
		box-shadow: 6px 6px 0 color-mix(in srgb, var(--edge) 30%, transparent);
	}
	.upnext-copy {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
		flex: 1;
	}
	.upnext-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font: 500 var(--text-caption)/1.3 var(--font-body);
		color: var(--ink-soft);
	}
	.upnext-chip {
		display: inline-block;
		padding: 0.12rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--edge) 55%, transparent);
		background: color-mix(in srgb, var(--edge) 14%, var(--paper));
		color: color-mix(in srgb, var(--edge) 72%, var(--ink));
		font-weight: 600;
	}
	.upnext-title {
		font-family: var(--font-body);
		font-weight: 700;
		font-size: clamp(1.55rem, 3.2vw, 2.05rem);
		line-height: 1.15;
		letter-spacing: -0.015em;
		color: var(--ink);
	}
	.upnext-reason {
		font: 400 var(--text-small)/1.4 var(--font-body);
		color: var(--ink-soft);
	}
	/* ── Row cards ── */
	.item-list,
	.agenda {
		display: flex;
		flex-direction: column;
	}
	.row-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		text-align: left;
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 0.8rem 1rem;
		margin-bottom: 0.55rem;
		cursor: pointer;
		transition:
			transform 0.16s var(--ease-out-quart),
			background 0.16s var(--ease-out-quart),
			border-color 0.16s var(--ease-out-quart);
	}
	.row-card:hover {
		transform: translateX(3px);
		background: var(--surface-paper);
		border-color: var(--ink-faint);
	}
	.row-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}
	.row-meta {
		font: 500 var(--text-caption)/1.3 var(--font-body);
		color: var(--ink-soft);
	}
	.row-title {
		font: 600 var(--text-small)/1.35 var(--font-body);
		color: var(--ink);
	}
	.item-action {
		flex: 0 0 auto;
		font: 500 var(--text-caption)/1.3 var(--font-body);
		color: var(--ink-soft);
		white-space: nowrap;
	}
	.row-card:hover .item-action,
	.upnext:hover .item-action {
		color: var(--ink);
	}

	.quiet-line {
		margin: 0;
		text-align: center;
		font: 500 var(--text-subheading)/1.4 var(--font-body);
		color: var(--ink-faint);
	}

	.more-toggle {
		align-self: flex-start;
		border: 0;
		background: none;
		padding: 0.5rem 0.25rem;
		font: 500 var(--text-small)/1 var(--font-body);
		color: var(--ink-soft);
		cursor: pointer;
		border-bottom: 1px solid transparent;
	}
	.more-toggle:hover {
		color: var(--ink);
		border-bottom-color: var(--ink);
	}

	/* ── Agenda ── */
	.agenda-day {
		margin-bottom: 0.5rem;
	}
	.day-label {
		font: 600 var(--text-caption)/1.3 var(--font-body);
		color: var(--ink);
		margin: 0.6rem 0 0.45rem;
	}
	.agenda-day .row-card {
		margin-bottom: 0.45rem;
	}

	.text-link {
		border: 0;
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
		font: 500 var(--text-caption)/1.4 var(--font-body);
	}
	.text-link:hover {
		color: var(--ink);
		text-decoration: underline;
	}

	/* ── All clear ── */
	.all-clear {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem;
		border: 1px solid var(--ok);
		background: color-mix(in srgb, var(--ok) 6%, var(--paper));
	}
	.all-clear-mark {
		display: grid;
		width: 2rem;
		height: 2rem;
		flex: 0 0 2rem;
		place-items: center;
		border: 1.5px solid var(--ok);
		color: var(--ok);
		font-weight: 700;
	}
	.all-clear .section-title {
		font-size: 1.5rem;
	}
	.all-clear p {
		margin: 0.5rem 0 0;
		color: var(--ink-soft);
		font-size: var(--text-small);
		line-height: 1.5;
	}
	.all-clear-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1rem;
	}

	.save-notice {
		margin: -1rem 0 2rem;
		font: 600 var(--text-small)/1.4 var(--font-body);
		color: var(--ok);
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
		.focus-header {
			align-items: stretch;
			flex-direction: column;
		}
		.focus-header .btn {
			align-self: flex-start;
		}
		.page-title {
			font-size: 2rem;
		}
		.item-action {
			display: none;
		}
	}
</style>
