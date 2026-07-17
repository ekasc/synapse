<script lang="ts">
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

<section class="simulator" aria-labelledby="simulator-title">
	<div class="simulator-heading">
		<div>
			<p class="eyebrow font-mono">Test another semester</p>
			<h3 id="simulator-title">
				Move {course.name} from {currentSemester
					? `${currentSemester.term} ${currentSemester.year}`
					: 'Unplaced'} to:
			</h3>
		</div>
		<p class="preview-note">Scenario only — no changes will be saved.</p>
	</div>

	{#if options.length === 0}
		<p>No other semesters are available for simulation.</p>
	{:else}
		<div class="simulator-controls">
			<label for="move-target">Target semester</label>
			<select id="move-target" bind:value={targetSemesterId}>
				<option value="">Choose a semester</option>
				{#each options as semester (semester.id)}
					<option value={semester.id}>{semester.term} {semester.year}</option>
				{/each}
			</select>
			<button type="button" onclick={apply} disabled={!targetSemesterId}>Apply to Scenario</button>
		</div>
	{/if}

	{#if result && result.status !== 'valid' && result.status !== 'invalid'}
		<div class="result-message" aria-live="polite">
			{#if result.status === 'cycle'}
				<strong>Invalid prerequisite graph</strong>
				<p>This course belongs to a prerequisite cycle.</p>
			{:else if result.status === 'unknown'}
				<strong>Unable to apply this move</strong>
				<p>A prerequisite course is missing or not scheduled.</p>
			{:else}
				<strong>This move cannot be added to the scenario.</strong>
			{/if}
		</div>
	{/if}
</section>

<style>
	.simulator {
		grid-column: 1 / -1;
		padding-top: 1rem;
		border-top: 1px solid var(--rule);
	}

	.simulator-heading {
		display: flex;
		gap: 1rem;
		align-items: start;
		justify-content: space-between;
	}

	.eyebrow,
	h3,
	p {
		margin: 0;
	}

	.eyebrow,
	label {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	h3 {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-size: 1rem;
	}

	.preview-note {
		font-size: 0.72rem;
		color: var(--ink-faint);
	}

	.simulator-controls {
		display: grid;
		grid-template-columns: minmax(180px, 1fr) auto;
		gap: 0.35rem 0.65rem;
		max-width: 620px;
		margin-top: 0.8rem;
	}

	.simulator-controls label {
		grid-column: 1 / -1;
	}

	select,
	button {
		min-height: 44px;
		border: 1px solid var(--ink);
		border-radius: 0;
		font: inherit;
	}

	select {
		min-width: 0;
		padding: 0 0.7rem;
		background: var(--surface-paper);
		color: var(--ink);
	}

	button {
		padding: 0 1rem;
		background: var(--ink);
		color: var(--surface-paper);
		font-weight: 600;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	select:focus-visible,
	button:focus-visible {
		outline: 3px solid var(--ok);
		outline-offset: 2px;
	}

	.result-message {
		margin-top: 0.8rem;
		padding: 0.75rem;
		border-left: 3px solid var(--accent);
		background: var(--paper-shelf);
	}

	@media (max-width: 520px) {
		.simulator-heading {
			flex-direction: column;
		}

		.simulator-controls {
			grid-template-columns: 1fr;
		}

		.simulator-controls label {
			grid-column: auto;
		}
	}
</style>
