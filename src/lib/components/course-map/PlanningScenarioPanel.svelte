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
	<section class="planning-workspace" aria-labelledby="planning-title">
		{#if sharedSource.status === 'invalid'}
			<div class="shared-notice invalid-notice" role="status">
				<strong>Invalid shared draft plan link</strong>
				<p>The planning data in this URL could not be read.</p>
				<button type="button" onclick={onclearshared}>Remove invalid draft plan link</button>
			</div>
		{:else if sharedSource.status === 'loaded'}
			<div class="shared-notice" role="status">
				<strong>Shared draft plan</strong>
				{#if sharedSource.replay.appliedCount === 0}
					<p>This shared draft plan could not be applied to the current course plan.</p>
				{:else}
					<p>
						{sharedSource.replay.appliedCount} move{sharedSource.replay.appliedCount === 1
							? ''
							: 's'} applied from this link{sharedSource.replay.skippedCount > 0
							? ` · ${sharedSource.replay.skippedCount} move${sharedSource.replay.skippedCount === 1 ? '' : 's'} skipped`
							: ''}.
					</p>
				{/if}
				<p class="source-label">Loaded from shared link</p>
				{#if sharedSource.modified}<p class="modified-notice">
						This draft plan has changed since the shared link was opened. Copy a new link to share
						the current version.
					</p>{/if}
				<button type="button" onclick={onclearshared}>Clear shared draft plan</button>
			</div>
		{/if}

		{#if scenario.moves.length > 0}
			<div class="summary">
				<p class="eyebrow font-mono">Draft plan summary</p>
				<h3 id="planning-title">Changes from your saved schedule</h3>
				<dl>
					<div>
						<dt>Moved courses</dt>
						<dd>{scenario.comparison.changedCourseIds.length}</dd>
					</div>
					<div>
						<dt>Plan conflicts</dt>
						<dd>{scenario.comparison.newConflicts.length}</dd>
					</div>
					<div>
						<dt>Resolved conflicts</dt>
						<dd>{scenario.comparison.resolvedConflicts.length}</dd>
					</div>
					<div>
						<dt>Courses moved later</dt>
						<dd>{scenario.comparison.delayedCourseIds.length}</dd>
					</div>
				</dl>
				<p class:ready={scenario.comparison.ready} class="ready-status">
					No prerequisite conflicts: <strong>{scenario.comparison.ready ? 'Yes' : 'No'}</strong>
				</p>
				<div class="comparison-lists">
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

			<details class="history" open>
				<summary
					>Draft plan · {scenario.moves.length} change{scenario.moves.length === 1
						? ''
						: 's'}</summary
				>
				<ol>
					{#each scenario.moves as move (move.id)}
						<li data-move-id={move.id}>
							<div>
								<strong>✓ {course(move.courseId)?.code ?? 'Unknown course'}</strong><span
									>{semesterLabel(move.fromSemesterId)} → {semesterLabel(
										move.targetSemesterId
									)}</span
								>
							</div>
							<div class="move-actions">
								<button type="button" onclick={() => onjump(move.courseId)}>Jump to course</button
								><button type="button" onclick={() => onundo(move.id)}>Undo</button>
							</div>
						</li>
					{/each}
				</ol>
				<div class="scenario-actions">
					<button type="button" onclick={onundolast}>Undo last move</button><button
						type="button"
						class="reset"
						onclick={onreset}>Discard draft</button
					>
					<button type="button" class="copy" onclick={copyLink}>Copy draft plan link</button>
				</div>
				<div class="copy-feedback" aria-live="polite">
					{#if copyResult.status === 'copied'}
						<strong>Draft plan link copied</strong>
					{:else if copyResult.status === 'failed' && copyResult.url}
						<strong>Could not copy automatically.</strong>
						<label for="scenario-link-fallback">Select and copy this link:</label>
						<input id="scenario-link-fallback" type="text" readonly value={copyResult.url} />
					{/if}
				</div>
			</details>
		{/if}

		{#if sharedSource.status === 'loaded' && sharedSource.replay.skippedCount > 0}
			<section class="shared-issues">
				<h4>Shared link issues</h4>
				<p>
					{sharedSource.replay.skippedCount} move{sharedSource.replay.skippedCount === 1 ? '' : 's'} could
					not be applied
				</p>
				<ul>
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
								<strong>Move could not be safely applied</strong><span
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

<style>
	.planning-workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
		gap: 1rem;
		margin-bottom: 0.8rem;
		padding: 1rem;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
	}

	.shared-notice,
	.shared-issues {
		grid-column: 1 / -1;
		padding: 0.75rem;
		border-left: 3px solid var(--ok);
		background: var(--paper-shelf);
	}

	.invalid-notice,
	.shared-issues {
		border-color: var(--accent);
	}

	.shared-notice p,
	.shared-issues p {
		margin-top: 0.2rem;
		font-size: 0.78rem;
	}

	.source-label,
	.modified-notice,
	.shared-issues span {
		color: var(--ink-soft);
	}

	.shared-notice button {
		margin-top: 0.55rem;
	}

	.eyebrow,
	h3,
	h4,
	p,
	dl,
	dd {
		margin: 0;
	}

	.eyebrow,
	h4 {
		font-size: 0.65rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	h3 {
		margin-top: 0.2rem;
		font-family: var(--font-display);
	}

	dl {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
		margin-top: 0.7rem;
	}

	dl div {
		display: flex;
		justify-content: space-between;
		padding: 0.45rem;
		background: var(--paper-shelf);
		font-size: 0.75rem;
	}

	dd {
		font-weight: 700;
	}

	.ready-status {
		margin-top: 0.65rem;
		padding-left: 0.55rem;
		border-left: 3px solid var(--accent);
	}

	.ready-status.ready {
		border-color: var(--ok);
	}

	.comparison-lists {
		display: grid;
		gap: 0.55rem;
		margin-top: 0.8rem;
	}

	.comparison-lists p {
		margin-top: 0.15rem;
		font-size: 0.75rem;
	}

	.history {
		min-width: 0;
	}

	.history summary {
		padding: 0.55rem;
		border-bottom: 1px solid var(--rule);
		font-weight: 700;
		cursor: pointer;
	}

	ol {
		margin: 0;
		padding: 0 0 0 1.6rem;
	}

	li {
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--rule);
	}

	li span {
		display: block;
		font-size: 0.75rem;
		color: var(--ink-soft);
	}

	.move-actions,
	.scenario-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	button {
		min-height: 44px;
		padding: 0 0.7rem;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
		color: var(--ink);
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
	}

	button:focus-visible,
	.history summary:focus-visible {
		outline: 3px solid var(--ok);
		outline-offset: 2px;
	}

	.reset {
		border-color: var(--accent);
		color: var(--accent);
	}

	.copy {
		background: var(--ink);
		color: var(--surface-paper);
	}

	.copy-feedback {
		margin-top: 0.55rem;
		font-size: 0.75rem;
	}

	.copy-feedback label,
	.copy-feedback input {
		display: block;
		box-sizing: border-box;
		width: 100%;
	}

	.copy-feedback input {
		min-height: 44px;
		margin-top: 0.35rem;
		padding: 0 0.5rem;
		border: 1px solid var(--ink);
		background: var(--surface-paper);
	}

	.shared-issues ul {
		margin-bottom: 0;
	}

	.shared-issues span {
		display: block;
	}

	@media (max-width: 1000px) {
		.planning-workspace {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 520px) {
		.planning-workspace {
			padding: 0.75rem;
		}

		dl {
			grid-template-columns: 1fr;
		}
	}
</style>
