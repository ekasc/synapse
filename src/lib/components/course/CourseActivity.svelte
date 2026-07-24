<script lang="ts">
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';

	type CourseSignal = {
		status?: string;
		riskLevel?: RiskLevel;
		currentGrade?: number;
		deadlinesThisWeek?: number;
		studyHours?: number;
		materialCount?: number;
		noteCount?: number;
	};

	let {
		signals
	}: {
		signals?: CourseSignal;
	} = $props();
</script>

{#if signals && (signals.deadlinesThisWeek !== undefined || signals.studyHours !== undefined || signals.materialCount !== undefined || signals.noteCount !== undefined)}
	<section class="block">
		<header class="block-head">
			<h2 class="block-title font-mono">Activity</h2>
		</header>
		<dl class="activity">
			{#if signals.deadlinesThisWeek !== undefined}
				<div class="activity-row">
					<dt>Deadlines this week</dt>
					<dd>{signals.deadlinesThisWeek}</dd>
				</div>
			{/if}
			{#if signals.studyHours !== undefined}
				<div class="activity-row">
					<dt>Study hours</dt>
					<dd>{signals.studyHours}</dd>
				</div>
			{/if}
			{#if signals.materialCount !== undefined}
				<div class="activity-row">
					<dt>Materials</dt>
					<dd>{signals.materialCount}</dd>
				</div>
			{/if}
			{#if signals.noteCount !== undefined}
				<div class="activity-row">
					<dt>Notes</dt>
					<dd>{signals.noteCount}</dd>
				</div>
			{/if}
		</dl>
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
</style>
