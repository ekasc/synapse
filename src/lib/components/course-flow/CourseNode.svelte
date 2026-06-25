<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { computeCourseSignals } from './graph';
	import type { CourseFlowNode } from './types';

	let { data, selected }: NodeProps<CourseFlowNode> = $props();

	function isValidConnection(connection: { source: string | null; target: string | null }) {
		if (connection.source === connection.target) return false;
		return true;
	}

	const course = $derived(data.course);
	const tagColor = $derived(data.tagColor);
	const semesterLabel = $derived(data.semesterLabel);
	const signals = $derived(computeCourseSignals(course));
	const warnings = $derived(data.warnings ?? []);
	const graphMode = $derived(data.graphMode ?? 'default');
	const atlasRole = $derived(data.atlasRole);

	const status = $derived(signals.status);
	const riskLevel = $derived(signals.riskLevel);
	const credits = $derived(signals.credits);
	const deadlinesThisWeek = $derived(signals.deadlinesThisWeek);
	const requirementGroup = $derived(signals.requirementGroup);
	const currentGrade = $derived(signals.currentGrade);
	const topics = $derived(signals.topics);

	const truncatedName = $derived(
		course.name.length > 24 ? course.name.slice(0, 22) + '...' : course.name
	);

	const riskLabel = $derived(
		riskLevel === 'high'
			? 'high risk'
			: riskLevel === 'medium'
				? 'medium risk'
				: riskLevel === 'low'
					? 'low risk'
					: ''
	);

	const hasCriticalWarning = $derived(warnings.some((w) => w.severity === 'critical'));

	const visibleTopics = $derived((topics ?? []).slice(0, 2));
	const extraTopicCount = $derived(Math.max(0, (topics ?? []).length - visibleTopics.length));

	const modeOpacity = $derived(
		graphMode === 'default'
			? 1
			: graphMode === 'this-week' && deadlinesThisWeek > 0
				? 1
				: graphMode === 'risk' && (riskLevel === 'medium' || riskLevel === 'high')
					? 1
					: graphMode === 'prereqs'
						? 0.5
						: graphMode === 'degree-progress'
							? 1
							: 1
	);

	const modeEmphasis = $derived(graphMode !== 'default' && modeOpacity < 1);
	const showStatusBadge = $derived(status !== 'planned');
</script>

<div
	class="course-node"
	class:selected
	class:status-planned={status === 'planned'}
	class:status-active={status === 'active'}
	class:status-completed={status === 'completed'}
	class:status-at-risk={status === 'at-risk'}
	class:risk-high={riskLevel === 'high'}
	class:risk-medium={riskLevel === 'medium'}
	class:risk-low={riskLevel === 'low'}
	class:critical-warning={hasCriticalWarning}
	class:mode-emphasis={modeEmphasis}
	class:atlas-center={atlasRole === 'center'}
	class:atlas-upstream={atlasRole === 'upstream'}
	class:atlas-downstream={atlasRole === 'downstream'}
	class:atlas-muted={atlasRole === 'muted'}
	style="background: {tagColor}; opacity: {modeOpacity};"
	role="button"
	tabindex="0"
	aria-label="{course.code}: {course.name}, {status}, {riskLabel}"
>
	<div class="cn-top">
		<span class="cn-code font-mono">{course.code}</span>
		{#if showStatusBadge}
			<span class="cn-badge status-badge status-{status} font-mono">{status}</span>
		{/if}
	</div>
	<span class="cn-name">{truncatedName}</span>
	<div class="cn-bottom">
		<span class="cn-meta font-mono"
			>{semesterLabel} · {requirementGroup}{credits ? ` · ${credits}cr` : ''}</span
		>
	</div>
	{#if currentGrade !== undefined}
		<div class="cn-grade font-mono">grade {currentGrade.toFixed(1)}</div>
	{/if}
	{#if visibleTopics.length > 0}
		<div class="cn-topics">
			{#each visibleTopics as topic (topic)}
				<span class="cn-topic font-mono">{topic}</span>
			{/each}
			{#if extraTopicCount > 0}
				<span class="cn-topic font-mono">+{extraTopicCount}</span>
			{/if}
		</div>
	{/if}
	{#if deadlinesThisWeek > 0}
		<div class="cn-deadlines font-mono">
			{deadlinesThisWeek} deadline{deadlinesThisWeek > 1 ? 's' : ''} this week
		</div>
	{/if}
	{#if riskLevel !== 'none'}
		<div class="cn-risk risk-{riskLevel} font-mono">{riskLabel}</div>
	{/if}
	{#if hasCriticalWarning}
		<div class="cn-warning-icon">⚠</div>
	{/if}
	<Handle type="target" position={Position.Left} {isValidConnection} />
	<Handle type="source" position={Position.Right} {isValidConnection} />
	<Handle type="source" position={Position.Top} {isValidConnection} />
	<Handle type="target" position={Position.Bottom} {isValidConnection} />
</div>

<style>
	.course-node {
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		width: 220px;
		min-height: 80px;
		padding: 0.55rem 0.7rem;
		border: 1.5px solid var(--ink);
		cursor: grab;
		transition:
			box-shadow 0.12s,
			border-color 0.12s,
			opacity 0.2s;
		user-select: none;
		box-sizing: border-box;
		position: relative;
		gap: 0.18rem;
	}

	.course-node:hover {
		box-shadow: 0 2px 0 var(--ink);
	}

	.course-node.selected {
		border-width: 2px;
		box-shadow:
			0 0 0 2px var(--ink),
			0 2px 0 var(--ink);
		z-index: 10;
	}

	.course-node.status-completed {
		border-color: var(--ink-soft);
		opacity: 0.9;
	}

	.course-node.status-active {
		border-top: 3px solid var(--ink);
		padding-top: calc(0.55rem - 1.5px);
	}

	.course-node.status-at-risk {
		border-color: var(--accent);
	}

	.course-node.risk-high {
		border-color: var(--accent);
	}

	.course-node.risk-medium {
		border-color: var(--ink);
	}

	.course-node.critical-warning {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.course-node.mode-emphasis {
		opacity: 0.35;
	}

	.course-node.atlas-center {
		border-width: 2px;
		box-shadow:
			0 0 0 2px var(--ink),
			0 3px 0 var(--ink);
		z-index: 12;
	}

	.course-node.atlas-upstream {
		border-left-width: 5px;
	}

	.course-node.atlas-downstream {
		border-right-width: 5px;
	}

	.course-node.atlas-muted {
		opacity: 0.32 !important;
	}

	.cn-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.cn-code {
		font-size: 0.78rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
	}

	.cn-badge {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--ink);
		font-weight: 500;
	}

	.status-planned {
		background: transparent;
		color: var(--ink-faint);
		border-color: var(--ink-faint);
	}

	.status-active {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.status-completed {
		background: var(--ink-soft);
		color: var(--paper);
		border-color: var(--ink-soft);
	}

	.status-at-risk {
		background: var(--accent);
		color: var(--paper);
		border-color: var(--accent);
	}

	.cn-name {
		font-family: var(--font-display);
		font-size: 0.95rem;
		line-height: 1.1;
		color: var(--ink);
		font-weight: 600;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 0.15rem;
	}

	.cn-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.2rem;
	}

	.cn-meta {
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.cn-deadlines {
		font-size: 0.75rem;
		color: var(--accent);
		margin-top: 0.1rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.cn-grade {
		font-size: 0.75rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
		margin-top: 0.1rem;
	}

	.cn-topics {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.15rem;
	}

	.cn-topic {
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
		border: 1px solid var(--ink-soft);
		color: var(--ink);
		background: var(--paper);
		text-transform: lowercase;
		letter-spacing: 0.02em;
	}

	.cn-risk {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.1rem 0.4rem;
		display: inline-block;
		align-self: flex-start;
		margin-top: 0.15rem;
		font-weight: 500;
	}

	.risk-high {
		background: var(--accent);
		color: var(--paper);
		border: 1px solid var(--accent);
	}

	.risk-medium {
		background: var(--warn);
		color: var(--paper);
		border: 1px solid var(--warn);
	}

	.risk-low {
		background: var(--paper);
		color: var(--ink-soft);
		border: 1px solid var(--ink-soft);
	}

	.cn-warning-icon {
		position: absolute;
		top: -6px;
		right: -6px;
		font-size: 0.75rem;
		line-height: 1;
		background: var(--paper);
		padding: 0 0.2rem;
	}

	:global(.svelte-flow__handle) {
		background: var(--ink);
		border: 1.5px solid var(--paper);
		width: 9px;
		height: 9px;
	}

	:global(.svelte-flow__handle:hover) {
		background: var(--accent);
	}
</style>
