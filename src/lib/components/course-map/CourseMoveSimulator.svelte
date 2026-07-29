<script lang="ts">
	import { Select } from 'bits-ui';
	import type { CourseMoveScenario } from './simulation';
	import type { MapCourse, MapSemester } from './types';

	interface Props {
		course: MapCourse;
		semesters: MapSemester[];
		onapply: (courseId: string, targetSemesterId: string) => CourseMoveScenario;
	}

	let { course, semesters, onapply }: Props = $props();
	let targetSemesterId = $state('');
	let result = $state<CourseMoveScenario | null>(null);
	const semestersById = $derived(new Map(semesters.map((semester) => [semester.id, semester])));
	const currentSemester = $derived(semestersById.get(course.semesterId));
	const options = $derived(
		[...semesters]
			.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
			.filter((semester) => semester.id !== course.semesterId)
	);

	function apply() {
		if (!targetSemesterId) return;
		result = onapply(course.id, targetSemesterId);
		if (result.status === 'valid' || result.status === 'invalid') targetSemesterId = '';
	}
</script>

<section class="col-span-full border-t border-[var(--rule)] pt-4" aria-labelledby="simulator-title">
	<div class="flex items-start justify-between gap-4 max-[520px]:flex-col">
		<h3 id="simulator-title" class="m-0 text-base font-[var(--font-body)]">
			Move {course.code}
		</h3>
		<p class="m-0 text-[length:var(--text-caption)] text-[var(--ink-soft)]">
			{currentSemester ? `${currentSemester.term} ${currentSemester.year}` : 'Unplaced'}
		</p>
	</div>

	{#if options.length === 0}
		<p class="m-0">No other semesters are available for simulation.</p>
	{:else}
		<div
			class="mt-[0.8rem] grid max-w-[620px] grid-cols-[minmax(180px,1fr)_auto] gap-x-[0.65rem] gap-y-[0.35rem] max-[520px]:grid-cols-1"
		>
			<label
				for="move-target"
				class="col-span-full text-[length:var(--text-small)] font-medium text-[var(--ink-soft)] max-[520px]:col-auto"
				>Target semester</label
			>
			<Select.Root
				type="single"
				name="move-target"
				items={options.map((semester) => ({
					value: semester.id,
					label: `${semester.term} ${semester.year}`
				}))}
				bind:value={targetSemesterId}
			>
				<Select.Trigger
					id="move-target"
					class="flex min-h-11 min-w-0 items-center rounded-none border border-[var(--ink)] bg-[var(--surface-paper)] px-[0.7rem] text-left font-[inherit] text-[var(--ink)]"
				>
					<Select.Value placeholder="Choose a semester" />
				</Select.Trigger>
				<Select.Portal>
					<Select.Content
						class="z-[var(--z-dropdown)] border border-[var(--ink)] bg-[var(--surface-paper)] shadow-[3px_3px_0_var(--shadow-ink)]"
					>
						<Select.Viewport>
							{#each options as semester (semester.id)}
								<Select.Item
									value={semester.id}
									label={`${semester.term} ${semester.year}`}
									class="min-h-10 cursor-pointer px-3 py-2 outline-none data-[highlighted]:bg-[var(--highlight-soft)] data-[selected]:bg-[var(--highlight)]"
								>
									{semester.term}
									{semester.year}
								</Select.Item>
							{/each}
						</Select.Viewport>
					</Select.Content>
				</Select.Portal>
			</Select.Root>
			<button
				type="button"
				onclick={apply}
				disabled={!targetSemesterId}
				class="min-h-11 cursor-pointer rounded-none border border-[var(--ink)] bg-[var(--ink)] px-4 font-[inherit] font-semibold text-[var(--surface-paper)] disabled:cursor-not-allowed disabled:opacity-45"
				>Add to draft plan</button
			>
		</div>
	{/if}

	{#if result && result.status !== 'valid' && result.status !== 'invalid'}
		<div
			class="mt-[0.8rem] border border-[var(--accent)] bg-[var(--paper-shelf)] p-3"
			aria-live="polite"
		>
			{#if result.status === 'cycle'}
				<strong>Circular prerequisite relationship</strong>
				<p class="m-0">This course belongs to a prerequisite cycle that must be corrected.</p>
			{:else if result.status === 'unknown'}
				<strong>Unable to apply this move</strong>
				<p class="m-0">A prerequisite course is missing or not scheduled.</p>
			{:else}
				<strong>This move cannot be added to the draft plan.</strong>
			{/if}
		</div>
	{/if}
</section>
