<script lang="ts">
	import type {
		BriefingDetailViewModel,
		SourceClass,
		SourceCurrentness
	} from '$lib/server/briefing/view-model';

	let { brief }: { brief: BriefingDetailViewModel } = $props();

	function sourceClassLabel(cls: SourceClass): string {
		const labels: Record<SourceClass, string> = {
			official_catalog: 'Official catalog',
			official_outline: 'Official outline',
			official_schedule: 'Official timetable',
			official_faculty: 'Official faculty page',
			rmp_review: 'Student-reported review',
			secondary: 'Secondary source',
			unknown: 'Unclassified source'
		};
		return labels[cls];
	}

	function currentnessLabel(c: SourceCurrentness): string {
		const labels: Record<SourceCurrentness, string> = {
			current: 'Current',
			historical: 'Historical',
			unknown: 'Date unavailable'
		};
		return labels[c];
	}

	function sourceDomain(url: string | null): string {
		if (!url) return 'Link unavailable';
		try {
			return new URL(url).hostname;
		} catch {
			return 'Link unavailable';
		}
	}

	const descriptionText = $derived(brief.description?.text?.trim() || '');
	const requestedName = $derived(brief.professor.requestedName);
	const listedInstructor = $derived(brief.professor.currentListedInstructor);

	const sentimentPositives = $derived(brief.studentSentiment?.positives ?? []);
	const sentimentConcerns = $derived(brief.studentSentiment?.concerns ?? []);

	const assessmentComponents = $derived(brief.assessmentComponents ?? []);
	const gradeBreakdown = $derived(brief.gradeBreakdown ?? []);
	const passingRequirements = $derived(brief.passingRequirements ?? []);

	const contradictions = $derived(brief.contradictions ?? []);
	const missingEvidence = $derived(brief.missingEvidence ?? []);

	const sources = $derived(brief.sources ?? []);
	const evidenceCount = $derived(contradictions.length + missingEvidence.length);

	const showAssessment = $derived(
		assessmentComponents.length > 0 ||
			gradeBreakdown.length > 0 ||
			passingRequirements.length > 0 ||
			!!brief.assessments?.text
	);
</script>

<div class="narrative">
	{#if descriptionText}
		<section class="block">
			<h2 class="heading">About this course</h2>
			<p class="prose">{descriptionText}</p>
		</section>
	{/if}

	<section class="block">
		<h2 class="heading">Instructor</h2>
		<dl class="kv">
			<div class="kv-row">
				<dt>Requested</dt>
				<dd>{requestedName || listedInstructor || '—'}</dd>
			</div>
			{#if brief.professor.facultyAffiliation}
				<div class="kv-row">
					<dt>Faculty</dt>
					<dd>{brief.professor.facultyAffiliation}</dd>
				</div>
			{/if}
		</dl>

		{#if sentimentPositives.length || sentimentConcerns.length}
			<div class="sentiment">
				<h3 class="subhead">What students say</h3>
				{#if sentimentPositives.length}
					<p class="quote positives">
						{sentimentPositives.map((q) => `"${q}"`).join('; ')}
					</p>
				{/if}
				{#if sentimentConcerns.length}
					<p class="quote concerns">
						{sentimentConcerns.map((q) => `"${q}"`).join('; ')}
					</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if showAssessment}
		<section class="block">
			<h2 class="heading">Assessment</h2>
			{#if brief.assessmentHistoryNote}
				<p class="hint">{brief.assessmentHistoryNote}</p>
			{/if}
			{#if assessmentComponents.length}
				<table class="assessment-table">
					<thead>
						<tr>
							<th>Assessment</th>
							<th class="weight-head">Weight</th>
						</tr>
					</thead>
					<tbody>
						{#each assessmentComponents as ac, index (`${ac.label}-${index}`)}
							<tr>
								<th>
									{ac.label}
									{#if ac.note}<small>{ac.note}</small>{/if}
								</th>
								<td class="weight font-mono">{ac.weightDisplay}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else if gradeBreakdown.length}
				<div class="grade-structure">
					{#each gradeBreakdown as g (g.item)}
						<div class="grade-row">
							<span class="grade-item">{g.item}</span>
							<span class="grade-weight font-mono">{g.weight}</span>
						</div>
					{/each}
				</div>
				{#if brief.gradeNotes}
					<p class="hint">{brief.gradeNotes}</p>
				{/if}
			{/if}
			{#if passingRequirements.length}
				<div class="requirements">
					<h3 class="subhead">Passing requirements</h3>
					{#each passingRequirements as rule, i (`${rule.ruleType}-${i}`)}
						<div class="requirement-row">
							<span class="req-text">{rule.ruleText}</span>
							{#if rule.threshold != null}
								<span class="req-thresh font-mono">≥{rule.threshold}%</span>
							{/if}
						</div>
						{#if rule.explanation}
							<p class="hint">{rule.explanation}</p>
						{/if}
					{/each}
				</div>
			{/if}
			{#if brief.assessments?.text && !assessmentComponents.length}
				<div class="assessments-text">
					<h3 class="subhead">{brief.assessments.title ?? 'Assessment'}</h3>
					<p class="prose">{brief.assessments.text}</p>
				</div>
			{/if}
		</section>
	{/if}

	{#if evidenceCount > 0}
		<section class="block">
			<details class="disclosure">
				<summary>
					<span class="summary-text">Research notes</span>
					<span class="summary-count font-mono">{evidenceCount}</span>
				</summary>
				<div class="evidence-grid">
					{#if contradictions.length}
						<div>
							<strong class="evidence-label">Contradictions</strong>
							<ul>
								{#each contradictions as item (item)}
									<li><span class="glyph glyph-warn" aria-hidden="true">⚠</span> {item}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if missingEvidence.length}
						<div>
							<strong class="evidence-label">Unavailable details</strong>
							<ul>
								{#each missingEvidence as item (item)}
									<li><span class="glyph glyph-faint" aria-hidden="true">◇</span> {item}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</details>
		</section>
	{/if}

	{#if sources.length}
		<section class="block">
			<details class="disclosure">
				<summary>
					<span class="summary-text">Sources</span>
					<span class="summary-count font-mono">{sources.length}</span>
				</summary>
				<ol class="source-list">
					{#each sources as source, i (source.id || i)}
						{@const sid = source.id || String(i + 1)}
						{@const label = source.label || `Source ${i + 1}`}
						{@const cls = sourceClassLabel(source.class)}
						{@const cur = currentnessLabel(source.currentness)}
						{@const dom = sourceDomain(source.url)}
						<li class="source-item" id={`source-${sid}`}>
							<div class="source-head">
								<span class="source-num font-mono">{sid}.</span>
								{#if source.url}
									<a class="source-label" href={source.url} target="_blank" rel="noreferrer">
										{label}
									</a>
								{:else}
									<span class="source-label">{label}</span>
								{/if}
							</div>
							<div class="source-meta font-mono">{cls} · {cur} · {dom}</div>
						</li>
					{/each}
				</ol>
			</details>
		</section>
	{/if}
</div>

<style>
	.narrative {
		display: grid;
		gap: 2rem;
	}

	.block {
		display: grid;
		gap: 0.85rem;
	}

	.heading {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.5rem;
		line-height: 1.15;
		color: var(--ink);
		margin: 0 0 0.25rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--rule);
		letter-spacing: -0.005em;
		text-wrap: balance;
	}

	.subhead {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		margin: 0.75rem 0 0.4rem;
	}

	.prose {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--ink);
		line-height: 1.6;
		margin: 0;
		max-width: 72ch;
	}

	.kv {
		display: grid;
		gap: 0.4rem;
		margin: 0;
	}

	.kv-row {
		display: grid;
		grid-template-columns: minmax(0, 7rem) 1fr;
		gap: 0.75rem;
		align-items: baseline;
	}

	.kv-row dt {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.kv-row dd {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--ink);
		margin: 0;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.sentiment {
		margin-top: 0.4rem;
	}

	.quote {
		font-family: var(--font-body);
		font-size: 1rem;
		line-height: 1.55;
		margin: 0.3rem 0 0;
		max-width: 72ch;
	}

	.positives {
		color: var(--ink);
	}

	.concerns {
		color: var(--ink-soft);
	}

	.assessment-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 1rem;
	}

	.assessment-table th,
	.assessment-table td {
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--rule-soft);
		text-align: left;
		vertical-align: top;
	}

	.assessment-table thead th {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		padding: 0 0 0.5rem;
	}

	.assessment-table tbody th {
		font-family: var(--font-body);
		font-weight: 500;
		color: var(--ink);
	}

	.assessment-table tbody th small {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: var(--ink-soft);
	}

	.weight-head {
		text-align: right;
	}

	.weight {
		text-align: right;
		color: var(--ink-soft);
		white-space: nowrap;
		font-feature-settings: 'tnum';
	}

	.grade-structure {
		display: grid;
		gap: 0.3rem;
	}

	.grade-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--rule-soft);
	}

	.grade-item {
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink);
	}

	.grade-weight {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.requirements {
		margin-top: 0.5rem;
	}

	.requirement-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--rule-soft);
		gap: 0.75rem;
	}

	.req-text {
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink);
	}

	.req-thresh {
		font-size: 0.85rem;
		color: var(--ink-soft);
		white-space: nowrap;
	}

	.hint {
		font-family: var(--font-body);
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--ink-soft);
		text-transform: none;
		letter-spacing: normal;
		margin: 0.25rem 0 0;
		max-width: 70ch;
	}

	.assessments-text {
		margin-top: 0.5rem;
	}

	.disclosure summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 2.5rem;
		cursor: pointer;
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--ink-soft);
		list-style: none;
	}

	.disclosure summary::-webkit-details-marker {
		display: none;
	}

	.disclosure summary::after {
		content: '+';
		margin-left: 0.6rem;
		font-family: var(--font-mono);
		color: var(--ink-faint);
	}

	.disclosure[open] summary::after {
		content: '−';
	}

	.summary-text {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.3rem;
		color: var(--ink);
		letter-spacing: -0.005em;
	}

	.summary-count {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin-left: auto;
		margin-right: 0.5rem;
	}

	.evidence-grid {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		padding: 0.5rem 0 0.5rem;
		border-top: 1px dashed var(--rule-soft);
		margin-top: 0.5rem;
	}

	.evidence-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: 0.4rem;
	}

	.evidence-grid ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.4rem;
	}

	.evidence-grid li {
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink-soft);
		line-height: 1.5;
		max-width: 72ch;
	}

	.glyph {
		display: inline-block;
		margin-right: 0.3rem;
		font-family: var(--font-mono);
	}

	.glyph-warn {
		color: var(--warn);
	}

	.glyph-faint {
		color: var(--ink-faint);
	}

	.source-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		border-top: 1px dashed var(--rule-soft);
		padding-top: 0.75rem;
	}

	.source-item {
		display: grid;
		gap: 0.15rem;
		padding: 0.25rem 0;
	}

	.source-head {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}

	.source-num {
		color: var(--ink-faint);
		font-size: 0.85rem;
		min-width: 1.5rem;
	}

	.source-label {
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink);
		text-decoration-color: var(--rule);
	}

	a.source-label:hover {
		text-decoration-color: var(--ink);
	}

	.source-meta {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding-left: 2rem;
	}
</style>
