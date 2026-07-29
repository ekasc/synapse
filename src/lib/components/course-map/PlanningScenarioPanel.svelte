<script lang="ts">
	import type { PlanningScenario } from './planning';
	import type { SharedScenarioSourceState } from './sharing';
	import type { MapCourse, MapSemester } from './types';

	interface Props {
		scenario: PlanningScenario;
		semesters: MapSemester[];
		sharedSource: SharedScenarioSourceState;
		onundo: (moveId: string) => void;
		onundolast: () => void;
		onreset: () => void;
		onjump: (courseId: string) => void;
		oncopy: () => Promise<{ status: 'copied' | 'failed'; url: string }>;
		onclearshared: () => void;
	}

	let {
		scenario,
		semesters,
		sharedSource,
		onundo,
		onundolast,
		onreset,
		onjump,
		oncopy,
		onclearshared
	}: Props = $props();
	let copyResult = $state<{ status: 'idle' | 'copied' | 'failed'; url: string }>({
		status: 'idle',
		url: ''
	});
	const coursesById = $derived(
		new Map(scenario.currentCourses.map((course) => [course.id, course]))
	);
	const baselineById = $derived(
		new Map(scenario.baselineCourses.map((course) => [course.id, course]))
	);
	const semestersById = $derived(new Map(semesters.map((semester) => [semester.id, semester])));
	const movedEarlier = $derived(new Set(scenario.comparison.movedEarlierCourseIds));

	function course(id: string): MapCourse | undefined {
		return coursesById.get(id) ?? baselineById.get(id);
	}

	function semesterLabel(id: string | null) {
		if (!id) return 'Unplaced';
		const semester = semestersById.get(id);
		return semester ? `${semester.term} ${semester.year}` : 'Unplaced';
	}

	async function copyLink() {
		copyResult = await oncopy();
	}
</script>

{#if scenario.moves.length > 0 || sharedSource.status !== 'none'}
	<section
		class="mb-[0.8rem] grid grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] gap-4 border border-[var(--ink)] bg-[var(--surface-paper)] p-4 max-[1000px]:grid-cols-1 max-[520px]:p-3 [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:border [&_button]:border-[var(--ink)] [&_button]:bg-[var(--surface-paper)] [&_button]:px-[0.7rem] [&_button]:font-[inherit] [&_button]:text-[var(--ink)] [&_button]:text-[var(--text-caption)] [&_dd]:m-0 [&_h3]:mt-[0.2rem] [&_h3]:mb-0 [&_h3]:font-[var(--font-body)] [&_h4]:m-0 [&_h4]:text-[length:var(--text-small)] [&_h4]:text-[var(--ink-soft)] [&_li]:border-b [&_li]:border-[var(--rule)] [&_li]:py-[0.65rem] [&_li_span]:block [&_li_span]:text-[var(--ink-soft)] [&_li_span]:text-[var(--text-caption)] [&_p]:m-0"
		aria-labelledby="planning-title"
	>
		{#if sharedSource.status === 'invalid'}
			<div
				class="col-span-full border border-[var(--pen-red)] bg-[var(--paper-shelf)] p-3"
				role="status"
			>
				<strong>Invalid shared draft plan link</strong>
				<p>The planning data in this URL could not be read.</p>
				<button type="button" onclick={onclearshared}>Remove invalid draft plan link</button>
			</div>
		{:else if sharedSource.status === 'loaded'}
			<div
				class="col-span-full border border-[var(--rule)] bg-[var(--paper-shelf)] p-3"
				role="status"
			>
				<strong>Shared draft plan</strong>
				{#if sharedSource.replay.appliedCount === 0}
					<p>This shared draft plan could not be loaded into the preview.</p>
				{:else}
					<p>
						{sharedSource.replay.appliedCount} move{sharedSource.replay.appliedCount === 1
							? ''
							: 's'} loaded into this preview{sharedSource.replay.skippedCount > 0
							? ` · ${sharedSource.replay.skippedCount} move${sharedSource.replay.skippedCount === 1 ? '' : 's'} skipped`
							: ''}.
					</p>
				{/if}
				<p class="mt-[0.2rem] text-[var(--ink-soft)] text-[var(--text-caption)]">
					Loaded from shared link
				</p>
				{#if sharedSource.modified}<p
						class="mt-[0.2rem] text-[var(--ink-soft)] text-[var(--text-caption)]"
					>
						This draft plan has changed since the shared link was opened. Copy a new link to share
						the current version.
					</p>{/if}
				<button class="mt-[0.55rem]" type="button" onclick={onclearshared}
					>Clear shared draft plan</button
				>
			</div>
		{/if}

		{#if scenario.moves.length > 0}
			<div class="summary">
				<h3 id="planning-title">Draft comparison</h3>
				<dl class="mt-[0.7rem] grid grid-cols-2 gap-[0.4rem] max-[520px]:grid-cols-1">
					<div class="flex justify-between bg-[var(--paper-shelf)] p-[0.45rem] text-xs">
						<dt>Moved courses</dt>
						<dd class="font-bold">{scenario.comparison.changedCourseIds.length}</dd>
					</div>
					<div class="flex justify-between bg-[var(--paper-shelf)] p-[0.45rem] text-xs">
						<dt>Plan conflicts</dt>
						<dd class="font-bold">{scenario.comparison.newConflicts.length}</dd>
					</div>
					<div class="flex justify-between bg-[var(--paper-shelf)] p-[0.45rem] text-xs">
						<dt>Resolved conflicts</dt>
						<dd class="font-bold">{scenario.comparison.resolvedConflicts.length}</dd>
					</div>
					<div class="flex justify-between bg-[var(--paper-shelf)] p-[0.45rem] text-xs">
						<dt>Courses moved later</dt>
						<dd class="font-bold">{scenario.comparison.delayedCourseIds.length}</dd>
					</div>
				</dl>
				<p
					class={[
						'mt-[0.65rem] border border-[var(--accent)] bg-[var(--paper-shelf)] px-[0.6rem] py-[0.4rem]',
						scenario.comparison.ready && 'border-[var(--ok)]'
					]}
				>
					No prerequisite conflicts: <strong>{scenario.comparison.ready ? 'Yes' : 'No'}</strong>
				</p>
				<div class="mt-[0.8rem] grid gap-[0.55rem] [&_p]:mt-[0.15rem] [&_p]:text-xs">
					{#if scenario.comparison.changedCourseIds.length > 0}
						<div>
							<h4>Changed courses</h4>
							<p>
								{scenario.comparison.changedCourseIds
									.map((id) => course(id)?.code ?? 'Unknown')
									.join(', ')}
							</p>
						</div>
					{/if}
					{#if scenario.comparison.newConflicts.length > 0}
						<div>
							<h4>Plan conflicts</h4>
							<p>
								{[
									...new Set(
										scenario.comparison.newConflicts.map(
											(violation) => course(violation.courseId)?.code ?? 'Unknown'
										)
									)
								].join(', ')}
							</p>
						</div>
					{/if}
					{#if scenario.comparison.resolvedConflicts.length > 0}
						<div>
							<h4>Resolved conflicts</h4>
							<p>
								{[
									...new Set(
										scenario.comparison.resolvedConflicts.map(
											(violation) => course(violation.courseId)?.code ?? 'Unknown'
										)
									)
								].join(', ')}
							</p>
						</div>
					{/if}
					{#if scenario.comparison.delayedCourseIds.length > 0}
						<div>
							<h4>Courses moved later</h4>
							<p>
								{scenario.comparison.delayedCourseIds
									.map((id) => course(id)?.code ?? 'Unknown')
									.join(', ')}
							</p>
						</div>
					{/if}
					{#if movedEarlier.size > 0}
						<div>
							<h4>Courses moved earlier</h4>
							<p>{[...movedEarlier].map((id) => course(id)?.code ?? 'Unknown').join(', ')}</p>
						</div>
					{/if}
				</div>
			</div>

			<details class="min-w-0">
				<summary class="cursor-pointer border-b border-[var(--rule)] p-[0.55rem] font-bold"
					>Draft plan · {scenario.moves.length} change{scenario.moves.length === 1
						? ''
						: 's'}</summary
				>
				<ol class="m-0 py-0 pr-0 pl-[1.6rem]">
					{#each scenario.moves as move (move.id)}
						<li data-move-id={move.id}>
							<div>
								<strong>✓ {course(move.courseId)?.code ?? 'Unknown course'}</strong><span
									>{semesterLabel(move.fromSemesterId)} → {semesterLabel(
										move.targetSemesterId
									)}</span
								>
							</div>
							<div class="mt-[0.4rem] flex flex-wrap gap-[0.4rem]">
								<button type="button" onclick={() => onjump(move.courseId)}>Jump to course</button
								><button type="button" onclick={() => onundo(move.id)}>Undo</button>
							</div>
						</li>
					{/each}
				</ol>
				<div class="mt-[0.4rem] flex flex-wrap gap-[0.4rem]">
					<button type="button" onclick={onundolast}>Undo last move</button><button
						type="button"
						class="!border-[var(--accent)] !text-[var(--accent)]"
						onclick={() => {
							if (window.confirm('Discard every change in this comparison draft?')) onreset();
						}}>Discard comparison draft</button
					>
					<button
						type="button"
						class="!bg-[var(--ink)] !text-[var(--surface-paper)]"
						onclick={copyLink}>Copy draft plan link</button
					>
				</div>
				<div class="mt-[0.55rem] text-xs" aria-live="polite">
					{#if copyResult.status === 'copied'}
						<strong>Draft plan link copied</strong>
					{:else if copyResult.status === 'failed' && copyResult.url}
						<strong>Could not copy automatically.</strong>
						<label class="block w-full" for="scenario-link-fallback"
							>Select and copy this link:</label
						>
						<input
							id="scenario-link-fallback"
							type="text"
							readonly
							value={copyResult.url}
							class="mt-[0.35rem] box-border block min-h-11 w-full border border-[var(--ink)] bg-[var(--surface-paper)] px-2"
						/>
					{/if}
				</div>
			</details>
		{/if}

		{#if sharedSource.status === 'loaded' && sharedSource.replay.skippedCount > 0}
			<section
				class="col-span-full border border-[var(--pen-red)] bg-[var(--paper-shelf)] p-3 [&_p]:mt-[0.2rem] [&_p]:text-[var(--text-caption)] [&_span]:block [&_span]:text-[var(--ink-soft)]"
			>
				<h4>Shared link issues</h4>
				<p>
					{sharedSource.replay.skippedCount} move{sharedSource.replay.skippedCount === 1 ? '' : 's'} could
					not be loaded into the preview
				</p>
				<ul class="mb-0">
					{#each sharedSource.replay.entries.filter((entry) => entry.status !== 'applied') as entry (entry.index)}
						<li>
							{#if entry.status === 'skipped-course-missing'}
								<strong>Course unavailable</strong><span>Course ID: {entry.courseId}</span>
							{:else if entry.status === 'skipped-semester-missing' || entry.status === 'skipped-target-unplaced'}
								<strong>Target semester unavailable</strong><span
									>Semester ID: {entry.targetSemesterId}</span
								>
							{:else if entry.status === 'skipped-no-op'}
								<strong
									>{course(entry.courseId)?.code ?? 'Course'} was already in that semester</strong
								>
							{:else}
								<strong>Move could not be safely previewed</strong><span
									>{course(entry.courseId)?.code ?? 'Course unavailable'}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</section>
{/if}
