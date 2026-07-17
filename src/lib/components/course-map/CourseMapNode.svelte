<script lang="ts">
	import { resolve } from '$app/paths';
	import type { MapCourse, MapPosition } from './types';

	interface Props {
		course: MapCourse;
		position: MapPosition;
		state: 'default' | 'upstream' | 'downstream' | 'conflict' | 'resolved' | 'muted';
		selected?: boolean;
		preview?: boolean;
		oninspect: (courseId: string) => void;
	}

	let { course, position, state, selected = false, preview = false, oninspect }: Props = $props();
</script>

<article
	class={['node', state, { selected }]}
	style:left={`${position.x}px`}
	style:top={`${position.y}px`}
	style:width={`${position.width}px`}
	style:height={`${position.height}px`}
>
	{#if state === 'conflict'}
		<span class="state-label conflict-label font-mono">Conflict</span>
	{:else if state === 'resolved'}
		<span class="state-label resolved-label font-mono">Resolved</span>
	{:else if preview}
		<span class="state-label preview-label font-mono">Moved</span>
	{/if}
	<div class="node-copy">
		<a
			href={resolve('/app/semesters/[semesterId]/courses/[courseId]', {
				semesterId: course.semesterId,
				courseId: course.id
			})}
			class="course-link"
		>
			<span class="course-code font-mono">{course.code}</span>
			<span class="course-name">{course.name}</span>
		</a>
		<button
			type="button"
			class="inspect-button font-mono"
			onclick={() => oninspect(course.id)}
			aria-pressed={selected}
			aria-label={`${selected ? 'Clear inspection for' : 'Inspect'} ${course.code}`}
		>
			{selected ? 'Selected' : 'View'}
		</button>
	</div>
</article>

<style>
	.node {
		position: absolute;
		z-index: 2;
		box-sizing: border-box;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		box-shadow: 4px 4px 0 rgba(31, 28, 20, 0.1);
		transition:
			opacity 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.node-copy {
		position: relative;
		height: 100%;
	}

	.state-label {
		position: absolute;
		top: -0.65rem;
		left: 0.6rem;
		z-index: 2;
		padding: 0.12rem 0.35rem;
		border: 1px solid currentColor;
		background: var(--surface-paper);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.preview-label,
	.resolved-label {
		color: var(--ok);
	}

	.conflict-label {
		color: var(--accent);
	}

	.course-link {
		display: flex;
		min-width: 0;
		flex-direction: column;
		justify-content: center;
		padding: 0.75rem 3.75rem 0.75rem 0.75rem;
		color: var(--ink);
		text-decoration: none;
	}

	.course-link:hover .course-name {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.course-code {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.course-name {
		display: -webkit-box;
		overflow: hidden;
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-size: 0.95rem;
		line-height: 1.15;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.inspect-button {
		position: absolute;
		right: 0.35rem;
		bottom: 0.35rem;
		min-width: 48px;
		min-height: 44px;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.inspect-button:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.inspect-button:focus-visible,
	.course-link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.selected {
		border-width: 2px;
		border-color: var(--ok);
		background: var(--paper-shelf);
		box-shadow:
			inset 4px 0 0 var(--ok),
			5px 5px 0 rgba(31, 28, 20, 0.14);
	}

	.selected .inspect-button {
		border-color: var(--ok);
		background: var(--surface-paper);
		color: var(--ok);
	}

	.upstream {
		border-color: var(--pen-blue, #315c91);
	}

	.downstream {
		border-color: var(--pen-red, #a43a32);
	}

	.conflict {
		border-width: 2px;
		border-color: var(--accent);
		box-shadow: inset 4px 0 0 var(--accent);
	}

	.resolved {
		border-width: 2px;
		border-color: var(--ok);
		border-style: double;
	}

	.muted {
		opacity: 0.28;
	}
</style>
