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
	}

	let { course, courses, semesters, relations, cycle, onapplymove }: Props = $props();
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

<aside class="inspector" aria-live="polite" aria-label={`Dependency details for ${course.code}`}>
	<header>
		<p class="course-code font-mono">{course.code}</p>
		<h2>{course.name}</h2>
		<p class="scheduled">
			Scheduled: {semester ? `${semester.term} ${semester.year}` : 'Unplaced'}
		</p>
	</header>

	<section>
		<h3>Requires</h3>
		<p class="section-help">Courses that must be scheduled before this course.</p>
		{#if prerequisites.length > 0}
			<ul>
				{#each prerequisites as courseId (courseId)}
					<li>
						<strong>{courseLabel(courseId)}</strong> - {prerequisiteState(courseId)}
						{#if !coursesById.has(courseId)}
							<span class="secondary">Course record unavailable</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p>No prerequisite relationships</p>
		{/if}
	</section>

	<section>
		<h3>Required for</h3>
		<p class="section-help">Courses that require this course first.</p>
		{#if dependants.length > 0}
			<ul>
				{#each dependants as courseId (courseId)}
					<li>{courseLabel(courseId)}</li>
				{/each}
			</ul>
		{:else}
			<p>No courses currently require this course</p>
		{/if}
	</section>

	<section class:invalid={Boolean(cycle)} class:blocked={blocking.length > 0 && !cycle}>
		<h3>Plan check</h3>
		<strong>{status}</strong>
		{#if cycle}
			<p>Circular relationship: {cycle.map(courseLabel).join(' → ')}</p>
		{:else if blocking.length > 0}
			<p>
				{blocking.length} required course{blocking.length === 1 ? ' is' : 's are'} not scheduled earlier.
			</p>
		{:else}
			<p>Every confirmed prerequisite is scheduled earlier.</p>
		{/if}
	</section>

	<section class="eligibility" class:invalid={eligibility.status === 'cycle'}>
		<h3>Earliest valid placement</h3>
		{#if eligibility.status === 'already-eligible'}
			<strong>No prerequisite constraint</strong>
			<p>This course has no confirmed prerequisites in the map.</p>
		{:else if eligibility.status === 'eligible'}
			<strong class="eligibility-term">{eligibility.semesterLabel}</strong>
			<p>
				Latest prerequisite{eligibility.latestPrerequisiteCourseIds.length === 1 ? '' : 's'}:
				<strong>
					{eligibility.latestPrerequisiteCourseIds.map(courseLabel).join(', ')} ·
					{eligibility.latestPrerequisiteSemesterLabel}
				</strong>
			</p>
			<div class="schedule-comparison">
				<strong>{scheduleStatusLabel(eligibility.scheduleStatus)}</strong>
				{#if eligibility.currentSemesterLabel}
					<p>Current: {eligibility.currentSemesterLabel}</p>
				{/if}
				<p>Earliest placement: {eligibility.semesterLabel}</p>
			</div>
		{:else if eligibility.status === 'outside-plan'}
			<strong>No valid placement in the current plan</strong>
			<p>Add a semester after {eligibility.latestPrerequisiteSemesterLabel}.</p>
		{:else if eligibility.status === 'unknown'}
			<strong>Cannot determine placement</strong>
			<p>A prerequisite course is missing or not scheduled.</p>
		{:else}
			<strong>Circular prerequisite relationship</strong>
			<p>The cycle must be corrected before placement can be checked.</p>
		{/if}
	</section>

	<CourseMoveSimulator {course} {semesters} onapply={onapplymove} />
</aside>

<style>
	.inspector {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		padding: 1rem;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		box-shadow: 5px 5px 0 var(--shadow-ink);
	}

	header,
	section {
		min-width: 0;
	}

	header {
		padding-bottom: 0.8rem;
		border-bottom: 1px solid var(--rule);
	}

	.course-code,
	h2,
	h3,
	p,
	ul {
		margin: 0;
	}

	.course-code,
	h3 {
		font-size: 0.68rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	h2 {
		margin-top: 0.25rem;
		font-family: var(--font-hand);
		font-size: 1.35rem;
	}

	h3 {
		margin-bottom: 0.45rem;
		color: var(--ink-soft);
	}

	.scheduled,
	section p,
	li {
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.scheduled {
		margin-top: 0.4rem;
		color: var(--ink-soft);
	}

	.section-help {
		margin-bottom: 0.45rem;
		color: var(--ink-faint);
	}

	.secondary {
		display: block;
		color: var(--ink-faint);
	}

	ul {
		padding-left: 1.1rem;
	}

	.blocked,
	.invalid {
		padding: 0.75rem;
		border: 1px solid var(--pen-red);
		background: var(--paper-shelf);
	}

	.eligibility {
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
	}

	.eligibility-term {
		display: block;
		font-family: var(--font-hand);
		font-size: 1.2rem;
	}

	.schedule-comparison {
		margin-top: 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	@media (min-width: 800px) {
		.inspector {
			grid-template-columns: 1.2fr 1fr 1fr 1fr;
		}

		.eligibility {
			grid-column: 1 / -1;
		}

		header {
			padding: 0 1rem 0 0;
			border-right: 1px solid var(--rule);
			border-bottom: 0;
		}
	}
</style>
