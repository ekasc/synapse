<script lang="ts">
	type Week = {
		stamp: string;
		entry: string;
		data: string;
	};

	const weeks: Week[] = [
		{
			stamp: 'step 01',
			entry: 'add your courses and semester',
			data: 'keep course details and prerequisite paths together'
		},
		{
			stamp: 'step 02',
			entry: 'bring in a syllabus and course materials',
			data: 'capture deadlines, grade weights, and study sources'
		},
		{
			stamp: 'step 03',
			entry: 'see the workload on one calendar',
			data: 'review upcoming work across your active courses'
		},
		{
			stamp: 'step 04',
			entry: 'make a weekly plan and track study time',
			data: 'use current deadlines to decide what needs attention'
		},
		{
			stamp: 'step 05',
			entry: 'practice from your own course materials',
			data: 'review generated questions and flashcards by course'
		},
		{
			stamp: 'step 06',
			entry: 'review grades, research, and next-semester options',
			data: 'use the tools together as the semester changes'
		}
	];
</script>

<section class="section section--timeline" aria-labelledby="timeline-heading">
	<header class="timeline-head">
		<h2 id="timeline-heading" class="timeline-title font-hand">
			build your workspace <span class="highlighter">one step at a time</span>.
		</h2>
	</header>

	<div class="timeline-spread">
		<ol class="weeks">
			{#each weeks as w (w.stamp)}
				<li class="week">
					<div class="week-meta">
						<span class="week-step">{w.stamp}</span>
					</div>
					<p class="week-entry font-hand">{w.entry}</p>
					<p class="week-data font-body">{w.data}</p>
				</li>
			{/each}
		</ol>
		<aside class="timeline-index" aria-label="Week index">
			<ol class="week-index">
				<li>step 01</li>
				<li>step 02</li>
				<li>step 03</li>
				<li>step 04</li>
				<li>step 05</li>
				<li>step 06</li>
			</ol>
			<p class="timeline-note font-hand">six tools.<br />one workspace.</p>
		</aside>
	</div>
</section>

<style>
	.section--timeline {
		padding-top: clamp(3.5rem, 5vw, 4.75rem);
		padding-bottom: clamp(3.5rem, 5vw, 4.75rem);
		padding-inline: clamp(1.5rem, 4vw, 4rem);
		max-width: 84rem;
		margin-inline: auto;
	}

	.timeline-head {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 3rem;
		max-width: 44rem;
	}

	.timeline-title {
		font-size: clamp(2.2rem, 3.8vw, 3.2rem);
		margin: 0;
		line-height: 1.05;
		color: var(--ink);
	}

	.timeline-spread {
		max-width: 84rem;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 56rem) 1fr;
		gap: 3rem;
		align-items: start;
	}

	.timeline-index {
		position: sticky;
		top: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-top: 0.5rem;
		max-width: 12rem;
	}

	.week-index {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.week-index li {
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--ink-soft);
		padding: 8px 0;
		border-bottom: 1.5px dashed var(--ink-faint);
	}

	.week-index li:last-child {
		border-bottom: none;
	}

	.timeline-note {
		font-size: 1.2rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.15;
	}

	.weeks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.week {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: 2.5rem;
		padding: 1.5rem 0;
		border-bottom: 1.5px dashed var(--ink-faint);
		align-items: start;
	}

	.week:first-child {
		padding-top: 0;
	}

	.week:last-child {
		border-bottom: none;
	}

	.week-meta {
		display: flex;
		align-items: flex-start;
		padding-top: 0.55rem;
		grid-column: 1;
	}

	.week-step {
		font-family: var(--font-numeric);
		font-size: var(--text-small);
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--ink-soft);
		text-transform: uppercase;
	}

	.week-entry,
	.week-data {
		grid-column: 2;
	}

	.week-entry {
		font-size: clamp(1.5rem, 2.4vw, 1.875rem);
		line-height: 1.3;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.week-data {
		font-size: 1.05rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.55;
	}

	@media (max-width: 1024px) {
		.timeline-spread {
			grid-template-columns: 1fr;
		}

		.timeline-index {
			position: static;
			max-width: none;
		}
	}

	@media (max-width: 640px) {
		.week {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}
	}
</style>
