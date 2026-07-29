<script lang="ts">
	import {
		getBlockingPrerequisites,
		getDirectDependants,
		getDirectPrerequisites,
		getEarliestEligibleSemester,
		type BlockingReason
	} from './traversal';
	import CourseMoveSimulator from './CourseMoveSimulator.svelte';
	import type { CourseMoveScenario } from './simulation';
	import type { MapCourse, MapRelation, MapSemester } from './types';

	interface Props {
		course: MapCourse;
		courses: MapCourse[];
		semesters: MapSemester[];
		relations: MapRelation[];
		cycle?: string[];
		onapplymove: (courseId: string, targetSemesterId: string) => CourseMoveScenario;
		onclose: () => void;
	}

	let { course, courses, semesters, relations, cycle, onapplymove, onclose }: Props = $props();
	const coursesById = $derived(new Map(courses.map((item) => [item.id, item])));
	const semestersById = $derived(new Map(semesters.map((item) => [item.id, item])));
	const prerequisites = $derived(getDirectPrerequisites(course.id, relations));
	const dependants = $derived(getDirectDependants(course.id, relations));
	const blocking = $derived(getBlockingPrerequisites(course.id, courses, semesters, relations));
	const blockingById = $derived(new Map(blocking.map((item) => [item.courseId, item.reason])));
	const semester = $derived(semestersById.get(course.semesterId));
	const status = $derived(
		cycle
			? 'Circular prerequisite'
			: blocking.length > 0
				? 'Needs rescheduling'
				: 'Fits current plan'
	);
	const eligibility = $derived(
		getEarliestEligibleSemester(course.id, courses, semesters, relations)
	);

	function prerequisiteState(courseId: string) {
		const reason = blockingById.get(courseId);
		if (!reason) return 'scheduled earlier';
		const labels: Record<BlockingReason, string> = {
			missing: 'course record missing',
			unplaced: 'not assigned to a semester',
			'same-semester': 'scheduled in the same semester',
			'scheduled-later': 'scheduled too late'
		};
		return labels[reason];
	}

	function courseLabel(courseId: string) {
		return coursesById.get(courseId)?.code ?? 'Unknown prerequisite';
	}

	function scheduleStatusLabel(scheduleStatus: string) {
		if (scheduleStatus === 'too-early') return 'Before a prerequisite';
		if (scheduleStatus === 'valid') return 'Fits current plan';
		if (scheduleStatus === 'later-than-necessary') return 'Could be scheduled earlier';
		return 'Not currently scheduled';
	}
</script>

<aside
	class="fixed top-4 right-4 bottom-4 z-[1050] box-border grid w-[min(26rem,calc(100vw-2rem))] gap-4 overflow-y-auto border border-[var(--ink)] bg-[var(--surface-paper)] px-4 pt-13 pb-4 shadow-[-6px_6px_0_var(--shadow-ink)] max-[600px]:inset-y-0 max-[600px]:right-0 max-[600px]:w-full"
	data-dependency-inspector
	aria-label={`Dependency details for ${course.code}`}
>
	<button
		type="button"
		class="absolute top-[0.65rem] right-[0.65rem] grid size-11 cursor-pointer place-items-center border border-[var(--ink)] bg-[var(--surface-paper)] text-[var(--ink)] [font:500_1.4rem/1_var(--font-body)]"
		onclick={onclose}
		aria-label="Close course details">×</button
	>
	<header class="min-w-0 border-b border-[var(--rule)] pb-[0.8rem]">
		<p class="m-0 text-[var(--text-caption)]">{course.code}</p>
		<h2 class="mt-1 text-[1.35rem] font-[var(--font-body)]" tabindex="-1">{course.name}</h2>
		<p class="mt-[0.4rem] leading-[1.45] text-[var(--ink-soft)] text-[var(--text-caption)]">
			Scheduled: {semester ? `${semester.term} ${semester.year}` : 'Unplaced'}
		</p>
	</header>

	<section class="min-w-0">
		<h3 class="mb-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)]">Requires</h3>
		{#if prerequisites.length > 0}
			<ul class="m-0 pl-[1.1rem]">
				{#each prerequisites as courseId (courseId)}
					<li class="leading-[1.45] text-[var(--text-caption)]">
						<strong>{courseLabel(courseId)}</strong> - {prerequisiteState(courseId)}
						{#if !coursesById.has(courseId)}
							<span class="block text-[var(--ink-faint)]">Course record unavailable</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">No prerequisite relationships</p>
		{/if}
	</section>

	<section class="min-w-0">
		<h3 class="mb-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)]">Required for</h3>
		{#if dependants.length > 0}
			<ul class="m-0 pl-[1.1rem]">
				{#each dependants as courseId (courseId)}
					<li class="leading-[1.45] text-[var(--text-caption)]">{courseLabel(courseId)}</li>
				{/each}
			</ul>
		{:else}
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				No courses currently require this course
			</p>
		{/if}
	</section>

	<section
		class={[
			'min-w-0',
			(Boolean(cycle) || (blocking.length > 0 && !cycle)) &&
				'border border-[var(--pen-red)] bg-[var(--paper-shelf)] p-3'
		]}
	>
		<h3 class="mb-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)]">Plan check</h3>
		<strong>{status}</strong>
		{#if cycle}
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				Circular relationship: {cycle.map(courseLabel).join(' → ')}
			</p>
		{:else if blocking.length > 0}
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				{blocking.length} required course{blocking.length === 1 ? ' is' : 's are'} not scheduled earlier.
			</p>
		{:else}
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				Every confirmed prerequisite is scheduled earlier.
			</p>
		{/if}
	</section>

	<section
		class={[
			'min-w-0 border-t border-[var(--rule)] pt-4',
			eligibility.status === 'cycle' && 'border border-[var(--pen-red)] bg-[var(--paper-shelf)] p-3'
		]}
	>
		<h3 class="mb-[0.45rem] text-[var(--ink-soft)] text-[var(--text-caption)]">
			Earliest valid placement
		</h3>
		{#if eligibility.status === 'already-eligible'}
			<strong>No prerequisite constraint</strong>
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				This course has no confirmed prerequisites in the map.
			</p>
		{:else if eligibility.status === 'eligible'}
			<strong class="block text-[1.2rem] font-[var(--font-body)]"
				>{eligibility.semesterLabel}</strong
			>
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				Latest prerequisite{eligibility.latestPrerequisiteCourseIds.length === 1 ? '' : 's'}:
				<strong>
					{eligibility.latestPrerequisiteCourseIds.map(courseLabel).join(', ')} ·
					{eligibility.latestPrerequisiteSemesterLabel}
				</strong>
			</p>
			<div class="mt-3 border border-[var(--rule)] bg-[var(--paper-shelf)] px-3 py-[0.65rem]">
				<strong>{scheduleStatusLabel(eligibility.scheduleStatus)}</strong>
				{#if eligibility.currentSemesterLabel}
					<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
						Current: {eligibility.currentSemesterLabel}
					</p>
				{/if}
				<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
					Earliest placement: {eligibility.semesterLabel}
				</p>
			</div>
		{:else if eligibility.status === 'outside-plan'}
			<strong>No valid placement in the current plan</strong>
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				Add a semester after {eligibility.latestPrerequisiteSemesterLabel}.
			</p>
		{:else if eligibility.status === 'unknown'}
			<strong>Cannot determine placement</strong>
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				A prerequisite course is missing or not scheduled.
			</p>
		{:else}
			<strong>Circular prerequisite relationship</strong>
			<p class="m-0 leading-[1.45] text-[var(--text-caption)]">
				The cycle must be corrected before placement can be checked.
			</p>
		{/if}
	</section>

	<CourseMoveSimulator {course} {semesters} onapply={onapplymove} />
</aside>
