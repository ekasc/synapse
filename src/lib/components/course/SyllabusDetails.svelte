<script lang="ts">
	type Professor = {
		name: string;
		email: string;
		office: string;
		officeHours: string;
	};

	type ImportantDate = {
		label: string;
		date: string;
		type: string;
		needsReview?: boolean;
	};

	let {
		professor,
		dates
	}: {
		professor: Professor | null;
		dates: ImportantDate[];
	} = $props();
</script>

{#if professor || dates.length > 0}
	<section class="block">
		<header class="block-head">
			<h2 class="block-title font-mono">Syllabus intelligence</h2>
			<span class="block-meta font-mono">saved to this course</span>
		</header>
		{#if professor}
			<dl class="activity">
				{#if professor.name && professor.name !== 'Not found'}
					<div class="activity-row">
						<dt>Instructor</dt>
						<dd>{professor.name}</dd>
					</div>
				{/if}
				{#if professor.email && professor.email !== 'Not found'}
					<div class="activity-row">
						<dt>Email</dt>
						<dd><a href={`mailto:${professor.email}`}>{professor.email}</a></dd>
					</div>
				{/if}
				{#if professor.office && professor.office !== 'Not found'}
					<div class="activity-row">
						<dt>Office</dt>
						<dd>{professor.office}</dd>
					</div>
				{/if}
				{#if professor.officeHours && professor.officeHours !== 'Not found'}
					<div class="activity-row">
						<dt>Office hours</dt>
						<dd>{professor.officeHours}</dd>
					</div>
				{/if}
			</dl>
		{/if}
		{#if dates.length > 0}
			<div class="syllabus-dates">
				{#each dates as item (`${item.label}-${item.date}`)}
					<div class="syllabus-date">
						<span>{item.label}</span>
						<time class="font-mono">{item.date}{item.needsReview ? ' · review' : ''}</time>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.activity {
		margin: 0;
		display: grid;
		gap: 0.4rem;
	}

	.activity-row {
		display: flex;
		justify-content: space-between;
		padding: 0.4rem 0;
		border-bottom: 1px dashed var(--rule);
	}

	.activity-row:last-child {
		border-bottom: none;
	}

	.activity-row dt {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.activity-row dd {
		font-size: 0.85rem;
		color: var(--ink);
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.activity-row a {
		color: inherit;
	}

	.syllabus-dates {
		display: grid;
		gap: 0.4rem;
		margin-top: 1rem;
	}

	.syllabus-date {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px dashed var(--rule);
		font-size: 0.85rem;
	}

	.syllabus-date time {
		color: var(--ink-soft);
		font-size: 0.72rem;
		white-space: nowrap;
	}
</style>
