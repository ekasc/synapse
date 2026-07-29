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
			<h2 class="block-title">Activity</h2>
		</header>
		<dl class="m-0 grid gap-1.5">
			{#if signals.deadlinesThisWeek !== undefined}
				<div
					class="flex justify-between border-b border-dashed border-[var(--rule)] py-1.5 last:border-b-0"
				>
					<dt class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">Deadlines this week</dt>
					<dd class="m-0 text-[var(--ink)] text-[var(--text-caption)] tabular-nums">
						{signals.deadlinesThisWeek}
					</dd>
				</div>
			{/if}
			{#if signals.studyHours !== undefined}
				<div
					class="flex justify-between border-b border-dashed border-[var(--rule)] py-1.5 last:border-b-0"
				>
					<dt class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">Study hours</dt>
					<dd class="m-0 text-[var(--ink)] text-[var(--text-caption)] tabular-nums">
						{signals.studyHours}
					</dd>
				</div>
			{/if}
			{#if signals.materialCount !== undefined}
				<div
					class="flex justify-between border-b border-dashed border-[var(--rule)] py-1.5 last:border-b-0"
				>
					<dt class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">Materials</dt>
					<dd class="m-0 text-[var(--ink)] text-[var(--text-caption)] tabular-nums">
						{signals.materialCount}
					</dd>
				</div>
			{/if}
			{#if signals.noteCount !== undefined}
				<div
					class="flex justify-between border-b border-dashed border-[var(--rule)] py-1.5 last:border-b-0"
				>
					<dt class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">Notes</dt>
					<dd class="m-0 text-[var(--ink)] text-[var(--text-caption)] tabular-nums">
						{signals.noteCount}
					</dd>
				</div>
			{/if}
		</dl>
	</section>
{/if}
