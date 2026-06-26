<script lang="ts">
	import { getContext } from 'svelte';
	import { BaseEdge, EdgeLabel, EdgeToolbar, getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import type { CourseFlowEdge, CourseRelation } from './types';
	import { Button, Input, Select } from '$lib/components/ui';

	let { id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps<CourseFlowEdge> =
		$props();

	const onUpdateEdge =
		getContext<(edgeId: string, updates: Partial<CourseRelation>) => void>('edgeUpdate');

	const relationType = $derived(data?.relationType ?? 'related');
	const directed = $derived(data?.directed ?? true);
	const graphMode = $derived(data?.graphMode ?? 'default');
	const reviewStatus = $derived(data?.reviewStatus);
	const atlasRole = $derived(data?.atlasRole);
	const edgeTypeOptions: CourseRelation['type'][] = [
		'prereq',
		'coreq',
		'unlocks',
		'topic-overlap',
		'same-requirement',
		'grade-risk',
		'study-dependency',
		'related'
	];

	let [edgePath, labelX, labelY] = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY }));

	let editing = $state(false);
	let editValue = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (editing && inputEl) {
			inputEl.focus();
			inputEl.select();
		}
	});

	function startEditing() {
		editValue = data?.label ?? '';
		editing = true;
	}

	function saveEdit() {
		editing = false;
		if (onUpdateEdge && editValue !== (data?.label ?? '')) {
			onUpdateEdge(id, { label: editValue });
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') {
			editing = false;
		}
	}

	function updateType(type: string) {
		onUpdateEdge?.(id, { type: type as CourseRelation['type'], label: type });
	}

	const modeOpacity = $derived(
		graphMode === 'default'
			? 1
			: graphMode === 'prereqs' &&
				  (relationType === 'prereq' || relationType === 'coreq' || relationType === 'unlocks')
				? 1
				: graphMode === 'risk' && relationType === 'grade-risk'
					? 1
					: graphMode === 'this-week'
						? 0.6
						: graphMode === 'degree-progress'
							? 1
							: graphMode === 'prereqs'
								? 0.2
								: graphMode === 'risk'
									? 0.3
									: 1
	);

	const edgeClass = $derived(
		`course-edge ${relationType} ${directed ? 'directed' : 'undirected'} ${selected ? 'selected' : ''} ${reviewStatus === 'rejected' ? 'rejected' : ''} ${atlasRole === 'connected' ? 'atlas-connected' : ''} ${atlasRole === 'muted' ? 'atlas-muted' : ''}`
	);

	const labelText = $derived(data?.label ?? '');
</script>

<BaseEdge {id} path={edgePath} class={edgeClass} style="opacity: {modeOpacity};" />
{#if labelText && reviewStatus !== 'rejected'}
	<EdgeLabel x={labelX} y={labelY}>
		{#if editing}
			<Input
				class="edge-label-input font-mono"
				bind:value={editValue}
				bind:ref={inputEl}
				onblur={saveEdit}
				onkeydown={handleKeydown}
			/>
		{:else}
			<span
				class="edge-label font-mono"
				class:selected
				role="button"
				tabindex="0"
				onclick={startEditing}
				onkeydown={(e) => {
					if (e.key === 'Enter') startEditing();
				}}>{labelText}</span
			>
		{/if}
	</EdgeLabel>
{/if}

{#if selected}
	<EdgeToolbar {id} x={labelX} y={labelY}>
		<div class="edge-toolbar-inner">
			<Button size="sm" onclick={startEditing}>edit label</Button>
			<Select
				class="etb-select font-mono"
				value={relationType}
				options={edgeTypeOptions.map((option) => ({ value: option, label: option }))}
				onValueChange={updateType}
			/>
		</div>
	</EdgeToolbar>
{/if}

<style>
	:global(.course-edge) {
		stroke: var(--ink-soft);
		stroke-width: 3;
		stroke-linecap: round;
		opacity: 0.9;
		transition: opacity 0.2s var(--ease-out-quart);
	}

	:global(.course-edge.selected) {
		stroke: var(--accent);
		stroke-width: 4.5;
	}

	:global(.course-edge.prereq) {
		stroke: var(--ink);
		stroke-width: 3.5;
	}

	:global(.course-edge.coreq) {
		stroke: var(--ink);
		stroke-width: 2.5;
		stroke-dasharray: 6 3;
	}

	:global(.course-edge.unlocks) {
		stroke: var(--ink);
		stroke-width: 4;
		stroke-dasharray: 10 4;
	}

	:global(.course-edge.topic-overlap) {
		stroke-dasharray: 8 4;
		opacity: 0.7;
	}

	:global(.course-edge.same-requirement) {
		stroke: var(--ink-faint);
		stroke-width: 2;
		opacity: 0.6;
	}

	:global(.course-edge.grade-risk) {
		stroke: var(--accent);
		stroke-width: 3.5;
	}

	:global(.course-edge.study-dependency) {
		stroke-dasharray: 3 3;
		opacity: 0.7;
	}

	:global(.course-edge.rejected) {
		display: none;
	}

	:global(.course-edge.atlas-connected) {
		stroke-width: 4;
	}

	:global(.course-edge.atlas-muted) {
		opacity: 0.18 !important;
	}

	.edge-label {
		position: absolute;
		transform: translate(-50%, -50%);
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		padding: 0.2rem 0.5rem;
		font-size: 0.72rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
		cursor: pointer;
		pointer-events: auto;
		white-space: nowrap;
	}

	.edge-label.selected {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	:global(.edge-label-input) {
		position: absolute;
		transform: translate(-50%, -50%);
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		padding: 0.2rem 0.4rem;
		font-size: 0.72rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
		white-space: nowrap;
		min-width: 60px;
		outline: none;
	}

	.edge-toolbar-inner {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--ink);
		background: var(--paper);
	}

	:global(.etb-select) {
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 500;
		pointer-events: auto;
	}

	:global(.etb-select) {
		padding: 0.15rem 0.3rem;
	}
</style>
