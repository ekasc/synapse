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
	const relationshipState = $derived(
		state === 'upstream'
			? 'Prerequisite of the selected course'
			: state === 'downstream'
				? 'Requires the selected course'
				: state === 'conflict'
					? 'Has a planning conflict'
					: state === 'resolved'
						? 'Planning conflict resolved'
						: ''
	);
</script>

<article
	class={[
		'absolute z-2 box-border border border-[var(--ink)] bg-[var(--surface-paper)] shadow-[4px_4px_0_var(--shadow-ink)] transition-[opacity,border-color,box-shadow] duration-150 ease-[var(--ease-out-quart)]',
		state === 'upstream' && 'border-[var(--pen-blue)]',
		state === 'downstream' && 'border-[var(--pen-red)]',
		state === 'conflict' && 'border-2 border-[var(--accent)] bg-[var(--paper-edge)]',
		state === 'resolved' && 'border-2 border-double border-[var(--ok)]',
		state === 'muted' && 'opacity-28',
		selected &&
			'border-2 border-[var(--ink)] bg-[var(--paper-shelf)] shadow-[5px_5px_0_var(--shadow-ink)]'
	]}
	data-course-node={course.id}
	style:left={`${position.x}px`}
	style:top={`${position.y}px`}
	style:width={`${position.width}px`}
	style:height={`${position.height}px`}
>
	{#if state === 'conflict'}
		<span
			class="absolute -top-[0.65rem] left-[0.6rem] z-2 border border-current bg-[var(--surface-paper)] px-[0.35rem] py-[0.12rem] text-[var(--accent)] text-[var(--text-caption)]"
			>Conflict</span
		>
	{:else if state === 'resolved'}
		<span
			class="absolute -top-[0.65rem] left-[0.6rem] z-2 border border-current bg-[var(--surface-paper)] px-[0.35rem] py-[0.12rem] text-[var(--ok)] text-[var(--text-caption)]"
			>Resolved</span
		>
	{:else if preview}
		<span
			class="absolute -top-[0.65rem] left-[0.6rem] z-2 border border-current bg-[var(--surface-paper)] px-[0.35rem] py-[0.12rem] text-[var(--ok)] text-[var(--text-caption)]"
			>Moved</span
		>
	{/if}
	<div class="relative h-full">
		{#if relationshipState}<span class="sr-only">{relationshipState}.</span>{/if}
		<a
			href={resolve('/app/semesters/[semesterId]/courses/[courseId]', {
				semesterId: course.semesterId,
				courseId: course.id
			})}
			class="group flex min-w-0 flex-col justify-center py-3 pr-15 pl-3 text-[var(--ink)] no-underline"
		>
			<span class=" font-bold text-[var(--text-caption)]">{course.code}</span>
			<span
				class="mt-[0.3rem] line-clamp-2 overflow-hidden leading-[1.15] font-[var(--font-body)] font-semibold text-[var(--text-small)] group-hover:underline group-hover:underline-offset-[3px]"
				>{course.name}</span
			>
		</a>
		<button
			type="button"
			class={[
				'absolute right-[0.35rem] bottom-[0.35rem] min-h-11 min-w-12 cursor-pointer border border-[var(--rule)] bg-[var(--paper-shelf)] px-[0.45rem] py-[0.3rem]  text-[var(--ink-soft)] text-[var(--text-caption)] hover:border-[var(--ink)] hover:text-[var(--ink)]',
				selected && 'border-[var(--ink)] bg-[var(--surface-paper)] text-[var(--ink)]'
			]}
			data-course-inspect={course.id}
			onclick={() => oninspect(course.id)}
			aria-pressed={selected}
			aria-label={`${selected ? 'Close plan details for' : 'Check plan for'} ${course.code}`}
		>
			{selected ? 'Close' : 'Check'}
		</button>
	</div>
</article>
