<script lang="ts">
	let { data } = $props();

	let { semesters, courses } = $derived(data);

	// Wizard state
	let step = $state(0); // 0=loading, 1=pick semesters, 2=add courses, 3=dashboard
	let selectedTerms = $state<{ id: string; label: string; term: string; year: number }[]>([]);
	let courseForms = $state<{ id: string; semesterId: string; code: string; name: string }[]>([]);
	let inputMode = $state<'manual' | 'import'>('manual');
	let importText = $state('');

	$effect(() => {
		if (semesters.length > 0) {
			step = 3; // has data, show dashboard
		} else {
			step = 1; // first time, show wizard
		}
	});

	// ── Semester options ──
	const termOptions = [
		{ id: 'f25', label: 'Fall 2025', term: 'Fall', year: 2025 },
		{ id: 's26', label: 'Spring 2026', term: 'Spring', year: 2026 },
		{ id: 'f26', label: 'Fall 2026', term: 'Fall', year: 2026 },
		{ id: 's27', label: 'Spring 2027', term: 'Spring', year: 2027 },
	];

	function toggleTerm(opt: (typeof termOptions)[0]) {
		if (selectedTerms.find((t) => t.id === opt.id)) {
			selectedTerms = selectedTerms.filter((t) => t.id !== opt.id);
		} else {
			selectedTerms = [...selectedTerms, opt];
		}
	}

	// ── Step 1 → Step 2 ──
	function confirmSemesters() {
		if (selectedTerms.length === 0) return;
		courseForms = selectedTerms.map((t) => ({
			id: crypto.randomUUID(),
			semesterId: t.id,
			code: '',
			name: '',
		}));
		// Save semesters to API
		for (const t of selectedTerms) {
			const order = t.year * 10 + (t.term === 'Spring' ? 2 : t.term === 'Summer' ? 3 : 1);
			fetch('/api/semesters', {
				method: 'POST',
				body: JSON.stringify({ id: t.id, term: t.term, year: t.year, order }),
			});
		}
		step = 2;
	}

	// ── Step 2: add course rows ──
	function addCourseRow(semesterId: string) {
		courseForms = [
			...courseForms,
			{ id: crypto.randomUUID(), semesterId, code: '', name: '' },
		];
	}

	function removeCourseRow(id: string) {
		courseForms = courseForms.filter((r) => r.id !== id);
	}

	async function saveCourses() {
		const valid = courseForms.filter((r) => r.code.trim() && r.name.trim());
		for (const c of valid) {
			await fetch('/api/courses', {
				method: 'POST',
				body: JSON.stringify({
					id: crypto.randomUUID(),
					semesterId: c.semesterId,
					code: c.code.trim(),
					name: c.name.trim(),
				}),
			});
		}
		// Reload page data
		window.location.href = '/app/courses';
	}

	function parseTranscript() {
		const lines = importText.split('\n').filter((l) => l.trim());
		const parsed: { code: string; name: string }[] = [];

		for (const line of lines) {
			// Match patterns like "COMP 1110 Intro to Programming" or "COMP1110 Intro to Programming"
			// Handles: course code (letters + numbers) followed by course name
			const match = line.match(/^([A-Za-z]+\s*\d+[A-Za-z]?\s*)\s+(.+?)(?:\s+\d+\.?\d*\s+[A-F][+-]?)?$/);
			if (match) {
				const code = match[1].trim().toUpperCase();
				const name = match[2].trim();
				parsed.push({ code, name });
			}
		}

		if (parsed.length === 0) return;

		// Distribute parsed courses across selected semesters round-robin
		const newForms = selectedTerms.flatMap((term, i) => {
			const coursesForTerm = parsed.filter((_, ci) => ci % selectedTerms.length === i);
			return coursesForTerm.map((c) => ({
				id: crypto.randomUUID(),
				semesterId: term.id,
				code: c.code,
				name: c.name,
			}));
		});

		courseForms = newForms;
		inputMode = 'manual'; // Switch to manual so they can tweak
	}
</script>

<div class="page">
	{#if step === 1}
		<!-- ═══════════ STEP 1: PICK SEMESTERS ═══════════ -->
		<div class="wizard">
			<h1 class="page-title font-hand">Welcome to Synapse</h1>
			<p class="page-subtitle">Pick which semesters you've completed or are enrolled in.</p>

			<div class="term-grid">
				{#each termOptions as opt}
					<button
						class="term-chip"
						class:selected={selectedTerms.some((t) => t.id === opt.id)}
						onclick={() => toggleTerm(opt)}
					>
						{opt.label}
					</button>
				{/each}
			</div>

			<div class="wizard-actions">
				<button
					class="wizard-btn"
					disabled={selectedTerms.length === 0}
					onclick={confirmSemesters}
				>
					→ add courses
				</button>
			</div>
		</div>

	{:else if step === 2}
		<!-- ═══════════ STEP 2: ADD COURSES ═══════════ -->
		<div class="wizard">
			<h1 class="page-title font-hand">Add your courses</h1>
			<p class="page-subtitle">Add them manually or paste from your transcript.</p>

			<div class="mode-tabs">
				<button
					class="mode-tab font-mono"
					class:active={inputMode === 'manual'}
					onclick={() => inputMode = 'manual'}
				>add manually</button>
				<button
					class="mode-tab font-mono"
					class:active={inputMode === 'import'}
					onclick={() => inputMode = 'import'}
				>import from transcript</button>
			</div>

			{#if inputMode === 'import'}
				<div class="import-block">
					<p class="import-desc font-mono">
						Paste course lines from your transcript. Each line should have a course code followed by the course name.
					</p>
					<textarea
						class="import-textarea"
						bind:value={importText}
						placeholder={"COMP 1110  Intro to Programming\nMATH 1120  Calculus I\nENGL 1101  Academic Writing\nCSIS 1100  Foundations of IS\nCOMP 2110  Data Structures\nMATH 1130  Calculus II\nSTAT 2160  Statistics\nCSIS 2100  Systems Analysis"}
						rows="10"
					></textarea>
					<div class="import-actions">
						<button class="wizard-btn" onclick={parseTranscript}>
							→ parse {importText.trim() ? (importText.split('\n').filter(l => l.trim()).length + ' lines' ) : ''}
						</button>
					</div>
					{#if importText.trim()}
						<p class="import-hint font-mono">
							Tip: courses are distributed across your {selectedTerms.length} semester{selectedTerms.length > 1 ? 's' : ''} round-robin. You can reorder them after parsing.
						</p>
					{/if}
				</div>
			{/if}

			{#if inputMode === 'manual' || courseForms.length > 0}
				{#each selectedTerms as term}
					<div class="semester-block">
						<h2 class="semester-head font-mono">{term.label}</h2>

						{#each courseForms.filter((f) => f.semesterId === term.id) as form, i}
							<div class="course-row">
								<input
									type="text"
									placeholder="e.g. CSIS 4495"
									class="course-input code-input"
									bind:value={form.code}
								/>
								<input
									type="text"
									placeholder="e.g. Capstone Project"
									class="course-input name-input"
									bind:value={form.name}
								/>
								<button
									class="row-remove"
									onclick={() => removeCourseRow(form.id)}
									aria-label="Remove course"
								>✕</button>
							</div>
						{/each}

						<button class="add-row-btn font-mono" onclick={() => addCourseRow(term.id)}>
							+ add course
						</button>
					</div>
				{/each}

				<div class="wizard-actions">
					<button class="wizard-btn" onclick={saveCourses}>
						→ see my graph
					</button>
				</div>
			{/if}
		</div>

	{:else if step === 3}
		<!-- ═══════════ DASHBOARD ═══════════ -->
		<div class="dash-head">
			<h1 class="page-title font-hand">Dashboard</h1>
			<p class="page-subtitle">{semesters.length} semester{semesters.length !== 1 ? 's' : ''} · {courses.length} course{courses.length !== 1 ? 's' : ''}</p>
		</div>

		<div class="dash-grid">
			{#each semesters as sem}
				<article class="dash-card">
					<div class="dash-card-head">
						<span class="font-mono dash-term">{sem.term} {sem.year}</span>
						<span class="dash-count font-mono">{courses.filter((c: { semesterId: string }) => c.semesterId === sem.id).length} courses</span>
					</div>
					<ul class="dash-course-list">
						{#each courses.filter((c: { semesterId: string }) => c.semesterId === sem.id) as course}
							<li class="dash-course-item">
								<span class="dash-code font-mono">{course.code}</span>
								<span class="dash-name">{course.name}</span>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>

		<div class="dash-actions">
			<a href="/app/courses" class="wizard-btn">→ view knowledge graph</a>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 680px;
	}

	/* ── Shared ── */
	.page-title {
		font-size: 2rem;
		color: var(--ink);
		margin: 0 0 0.25rem;
		line-height: 1;
	}

	.page-subtitle {
		color: var(--ink-soft);
		font-size: 0.9rem;
		margin: 0 0 2rem;
	}

	.wizard-btn {
		display: inline-block;
		padding: 0.7rem 1.6rem;
		background: var(--ink);
		color: var(--paper);
		border: none;
		border-radius: 6px;
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, transform 0.15s;
	}

	.wizard-btn:hover:not(:disabled) {
		background: #2a2a27;
		transform: translateY(-1px);
	}

	.wizard-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.wizard-actions {
		margin-top: 2rem;
		display: flex;
		justify-content: center;
	}

	/* ── Step 1: Term picker ── */
	.term-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.term-chip {
		padding: 0.75rem 1rem;
		border: 1.5px dashed var(--ink-faint);
		border-radius: 6px;
		background: transparent;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--ink-soft);
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.term-chip:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.term-chip.selected {
		background: var(--highlight);
		border-color: var(--ink);
		color: var(--ink);
		mix-blend-mode: multiply;
	}

	/* ── Step 2: Course forms ── */
	.mode-tabs {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1.5rem;
	}

	.mode-tab {
		padding: 0.5rem 1rem;
		border: 1px solid rgba(26, 26, 23, 0.12);
		border-radius: 4px;
		background: transparent;
		font-size: 0.7rem;
		color: var(--ink-soft);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transition: background 0.12s, color 0.12s;
	}

	.mode-tab:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.mode-tab.active {
		background: var(--highlight);
		border-color: var(--ink);
		color: var(--ink);
		mix-blend-mode: multiply;
	}

	.import-block {
		margin-bottom: 1.5rem;
	}

	.import-desc {
		font-size: 0.75rem;
		color: var(--ink-soft);
		margin: 0 0 0.75rem;
		line-height: 1.5;
	}

	.import-textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid rgba(26, 26, 23, 0.15);
		border-radius: 4px;
		background: #fbf8f0;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink);
		resize: vertical;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.12s;
	}

	.import-textarea:focus {
		border-color: var(--ink);
	}

	.import-textarea::placeholder {
		color: var(--ink-faint);
	}

	.import-actions {
		margin-top: 0.75rem;
		display: flex;
		justify-content: flex-start;
	}

	.import-hint {
		font-size: 0.65rem;
		color: var(--ink-faint);
		margin: 0.5rem 0 0;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.semester-block {
		margin-bottom: 1.5rem;
		padding: 1.25rem;
		border: 1px solid rgba(26, 26, 23, 0.1);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.3);
	}

	.semester-head {
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0 0 0.75rem;
	}

	.course-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		align-items: center;
	}

	.course-input {
		padding: 0.5rem 0.65rem;
		border: 1px solid rgba(26, 26, 23, 0.15);
		border-radius: 4px;
		background: #fbf8f0;
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--ink);
		outline: none;
		transition: border-color 0.12s;
	}

	.course-input:focus {
		border-color: var(--ink);
	}

	.code-input {
		width: 130px;
		flex-shrink: 0;
		font-family: var(--font-mono);
		text-transform: uppercase;
	}

	.name-input {
		flex: 1;
	}

	.row-remove {
		background: none;
		border: none;
		color: var(--ink-faint);
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.25rem;
		line-height: 1;
	}

	.row-remove:hover {
		color: var(--pen-red);
	}

	.add-row-btn {
		background: none;
		border: 1px dashed var(--ink-faint);
		border-radius: 4px;
		padding: 0.4rem 0.75rem;
		color: var(--ink-faint);
		cursor: pointer;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transition: color 0.12s, border-color 0.12s;
	}

	.add-row-btn:hover {
		color: var(--ink);
		border-color: var(--ink);
	}

	/* ── Step 3: Dashboard ── */
	.dash-head {
		margin-bottom: 1.5rem;
	}

	.dash-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dash-card {
		border: 1px solid rgba(26, 26, 23, 0.1);
		border-radius: 6px;
		padding: 1.25rem;
		background: rgba(255, 255, 255, 0.3);
	}

	.dash-card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px dashed var(--ink-faint);
	}

	.dash-term {
		font-size: 0.8rem;
		color: var(--ink);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.dash-count {
		font-size: 0.65rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.dash-course-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.dash-course-item {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
	}

	.dash-code {
		font-size: 0.8rem;
		color: var(--ink-soft);
		width: 110px;
		flex-shrink: 0;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dash-name {
		font-size: 0.9rem;
		color: var(--ink);
	}

	.dash-actions {
		margin-top: 2rem;
		display: flex;
		justify-content: center;
	}

	@media (max-width: 640px) {
		.term-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.course-row {
			flex-wrap: wrap;
		}
		.code-input {
			width: 100%;
		}
		.name-input {
			width: 100%;
		}
	}
</style>
