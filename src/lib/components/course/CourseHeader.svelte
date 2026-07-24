<script lang="ts">
	type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';

	type Course = {
		id: string;
		semesterId: string;
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		tag?: string;
		color?: string;
		signals?: {
			status?: CourseStatus;
			riskLevel?: RiskLevel;
			currentGrade?: number;
			nextDeadline?: string;
			requirementGroup?: string;
		};
	};

	type Semester = { id: string; term: string; year: number; order: number };

	let {
		course,
		semester,
		backHref,
		onEdit,
		onDelete,
		onBack
	}: {
		course: Course;
		semester: Semester | null;
		backHref: string;
		onEdit: () => void;
		onDelete: () => void;
		onBack: () => void;
	} = $props();

	const status = $derived(course.signals?.status ?? 'planned');
	const statusLabel = $derived(status.replaceAll('-', ' '));

	const statusVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		status === 'completed'
			? 'ok'
			: status === 'at-risk'
				? 'crit'
				: status === 'active'
					? 'warn'
					: 'idle'
	);

	const riskLabel = $derived(course.signals?.riskLevel ?? 'none');

	const riskVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		riskLabel === 'high'
			? 'crit'
			: riskLabel === 'medium'
				? 'warn'
				: riskLabel === 'low'
					? 'ok'
					: 'idle'
	);
</script>

<button class="back-link font-mono" onclick={onBack}>← back</button>

<div class="page-cover">
	<div class="cover-head">
		<div class="cover-meta">
			<h1 class="page-title">{course.code}</h1>
			<p class="course-name">{course.name}</p>
			<p class="course-line font-mono">
				{#if semester}{semester.term} {semester.year} ·
				{/if}
				{#if course.instructor}{course.instructor} ·
				{/if}
				{#if course.credits !== undefined}{course.credits} credit{course.credits === 1
						? ''
						: 's'}{/if}
			</p>
			{#if course.tag || course.signals?.requirementGroup}
				<div class="course-tags">
					{#if course.tag}
						<span class="tag-chip font-mono">{course.tag}</span>
					{/if}
					{#if course.signals?.requirementGroup}
						<span class="tag-chip tag-chip-req font-mono">{course.signals.requirementGroup}</span>
					{/if}
				</div>
			{/if}
		</div>
		<div class="cover-actions">
			<button class="btn btn-secondary btn-sm" onclick={onEdit}>edit</button>
			<button class="btn btn-danger btn-sm" onclick={onDelete}>delete</button>
		</div>
	</div>

	<div class="state-line" aria-label="Course state">
		<span class="state-fact">
			<span class="state-label font-mono">Status</span>
			<span class="state-value state-{statusVariant}">{statusLabel}</span>
		</span>
		<span class="state-fact">
			<span class="state-label font-mono">Grade</span>
			<span class="state-value">
				{#if course.signals?.currentGrade !== undefined}
					{course.signals.currentGrade}
				{:else}
					<span class="state-empty">—</span>
				{/if}
			</span>
		</span>
		<span class="state-fact">
			<span class="state-label font-mono">Risk</span>
			<span class="state-value state-{riskVariant}">{riskLabel}</span>
		</span>
		{#if course.signals?.nextDeadline}
			<span class="state-fact">
				<span class="state-label font-mono">Next</span>
				<span class="state-value">{course.signals.nextDeadline}</span>
			</span>
		{/if}
	</div>
</div>

<style>
	.back-link {
		display: inline-block;
		margin-bottom: 1rem;
		padding: 0;
		border: none;
		background: none;
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		cursor: pointer;
		transition: color 0.12s var(--ease-out-quart);
	}

	.back-link:hover {
		color: var(--ink);
	}

	.page-cover {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--ink);
	}

	.cover-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.cover-actions {
		display: flex;
		gap: 0.5rem;
	}

	.cover-meta {
		flex: 1;
		min-width: 0;
	}

	.course-name {
		font-family: var(--font-body);
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 0.5rem;
		line-height: 1.3;
	}

	.course-line {
		font-size: 0.78rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}

	.course-tags {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.tag-chip {
		padding: 0.2rem 0.55rem;
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
		font-size: 0.7rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.tag-chip-req {
		background: var(--paper);
	}

	/* Compact facts line: mono labels + Inter values inline — not a metric strip. */
	.state-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.45rem 1.5rem;
	}

	.state-fact {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.state-label {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.state-value {
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1.2;
	}

	.state-empty {
		color: var(--ink-faint);
		font-weight: 400;
	}

	/* status/risk variants: crit → accent, ok → ok, warn → warn, idle → faint */
	.state-crit {
		color: var(--accent);
	}

	.state-ok {
		color: var(--ok);
	}

	.state-warn {
		color: var(--warn);
	}

	.state-idle {
		color: var(--ink-faint);
	}
</style>
