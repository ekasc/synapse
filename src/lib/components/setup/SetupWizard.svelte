<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolveRoute } from '$app/paths';

	type TermOption = { id: string; label: string; term: string; year: number };
	type CourseForm = { id: string; semesterId: string; code: string; name: string };

	let step = $state(1);
	let selectedTerms = $state<TermOption[]>([]);
	let courseForms = $state<CourseForm[]>([]);
	let inputMode = $state<'manual' | 'import'>('manual');
	let importText = $state('');
	let wizardError = $state('');
	let parseFeedback = $state('');
	let saving = $state(false);

	function buildTermOptions(): TermOption[] {
		const now = new Date();
		const month = now.getMonth();
		const year = now.getFullYear();
		const current = month >= 7 ? { term: 'Spring', year: year + 1 } : { term: 'Fall', year };
		const options: TermOption[] = [];
		let { year: y } = current;
		let { term } = current;
		for (let i = 0; i < 6; i++) {
			const id = `${term[0].toLowerCase()}${String(y).slice(-2)}`;
			options.push({ id, label: `${term} ${y}`, term, year: y });
			if (term === 'Fall') {
				term = 'Spring';
				y += 1;
			} else {
				term = 'Fall';
			}
		}
		return options;
	}
	const termOptions = buildTermOptions();

	function toggleTerm(opt: TermOption) {
		if (selectedTerms.find((t) => t.id === opt.id)) {
			selectedTerms = selectedTerms.filter((t) => t.id !== opt.id);
		} else {
			selectedTerms = [...selectedTerms, opt];
		}
	}

	async function confirmSemesters() {
		if (selectedTerms.length === 0) return;
		saving = true;
		wizardError = '';
		courseForms = selectedTerms.map((t) => ({
			id: crypto.randomUUID(),
			semesterId: t.id,
			code: '',
			name: ''
		}));
		try {
			for (const t of selectedTerms) {
				const order = t.year * 10 + (t.term === 'Spring' ? 2 : t.term === 'Summer' ? 3 : 1);
				const res = await fetch('/api/semesters', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: t.id, term: t.term, year: t.year, order })
				});
				if (!res.ok) throw new Error('Failed to save semester');
			}
			step = 2;
		} catch {
			wizardError = 'Could not save semesters. Please try again.';
		} finally {
			saving = false;
		}
	}

	function addCourseRow(semesterId: string) {
		courseForms = [...courseForms, { id: crypto.randomUUID(), semesterId, code: '', name: '' }];
	}

	function removeCourseRow(id: string) {
		courseForms = courseForms.filter((r) => r.id !== id);
	}

	async function saveCourses() {
		saving = true;
		wizardError = '';
		const valid = courseForms.filter((r) => r.code.trim() && r.name.trim());
		if (valid.length === 0) {
			wizardError = 'Add at least one course with a code and name.';
			saving = false;
			return;
		}
		try {
			for (const c of valid) {
				const res = await fetch('/api/courses', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: crypto.randomUUID(),
						semesterId: c.semesterId,
						code: c.code.trim(),
						name: c.name.trim()
					})
				});
				if (!res.ok) throw new Error('Failed to save courses');
			}
			await invalidateAll();
			await goto(resolveRoute('/app'));
		} catch {
			wizardError = 'Could not save courses. Please try again.';
		} finally {
			saving = false;
		}
	}

	function parseTranscript() {
		const lines = importText.split('\n').filter((l) => l.trim());
		const parsed: { code: string; name: string }[] = [];

		for (const line of lines) {
			const match = line.match(
				/^([A-Za-z]+\s*\d+[A-Za-z]?\s*)\s+(.+?)(?:\s+\d+\.?\d*\s+[A-F][+-]?)?$/
			);
			if (match) {
				const code = match[1].trim().toUpperCase();
				const name = match[2].trim();
				parsed.push({ code, name });
			}
		}

		if (parsed.length === 0) {
			parseFeedback = 'No course codes found. Try formatting as: COMP 1110  Intro to Programming';
			return;
		}
		parseFeedback = `Parsed ${parsed.length} course${parsed.length !== 1 ? 's' : ''}.`;

		const termOrder = { Fall: 1, Summer: 2, Spring: 3 } as const;
		const sortedTerms = [...selectedTerms].sort((a, b) => {
			if (a.year !== b.year) return a.year - b.year;
			return (
				termOrder[a.term as keyof typeof termOrder] - termOrder[b.term as keyof typeof termOrder]
			);
		});
		const perTerm = Math.ceil(parsed.length / sortedTerms.length);
		const newForms: CourseForm[] = [];
		parsed.forEach((c, i) => {
			const term = sortedTerms[Math.min(Math.floor(i / perTerm), sortedTerms.length - 1)];
			if (!term) return;
			newForms.push({
				id: crypto.randomUUID(),
				semesterId: term.id,
				code: c.code,
				name: c.name
			});
		});

		courseForms = newForms;
		inputMode = 'manual';
	}

	function goBack() {
		step = 1;
		wizardError = '';
		parseFeedback = '';
		inputMode = 'manual';
	}
</script>

<div class="wizard page-enter">
	{#if step === 1}
		<h1 class="page-title font-hand">Welcome to Synapse</h1>
		<p class="page-subtitle">Pick which semesters you've completed or are enrolled in.</p>
		{#if wizardError || parseFeedback}
			<p class="parse-feedback font-mono">{wizardError || parseFeedback}</p>
		{/if}

		<div class="term-grid">
			{#each termOptions as opt (opt.id)}
				<button
					class="term-chip"
					aria-pressed={selectedTerms.some((t) => t.id === opt.id)}
					class:selected={selectedTerms.some((t) => t.id === opt.id)}
					onclick={() => toggleTerm(opt)}
				>
					{opt.label}
				</button>
			{/each}
		</div>

		<div class="wizard-actions">
			<button
				class="btn btn-primary"
				disabled={selectedTerms.length === 0 || saving}
				onclick={confirmSemesters}
			>
				Next: add courses →
			</button>
		</div>
	{:else}
		<h1 class="page-title font-hand">Add your courses</h1>
		<p class="page-subtitle">Add them manually or paste from your transcript.</p>
		{#if wizardError || parseFeedback}
			<p class="parse-feedback font-mono">{wizardError || parseFeedback}</p>
		{/if}

		<div class="mode-tabs">
			<button
				class="mode-tab font-mono"
				aria-pressed={inputMode === 'manual'}
				class:active={inputMode === 'manual'}
				onclick={() => (inputMode = 'manual')}>add manually</button
			>
			<button
				class="mode-tab font-mono"
				aria-pressed={inputMode === 'import'}
				class:active={inputMode === 'import'}
				onclick={() => (inputMode = 'import')}>import from transcript</button
			>
		</div>

		{#if inputMode === 'import'}
			<div class="import-block">
				<p class="import-desc font-mono">
					Paste course lines from your transcript. Each line should have a course code followed by
					the course name.
				</p>
				<label class="sr-only" for="import-textarea">Paste transcript text</label>
				<textarea
					id="import-textarea"
					class="import-textarea"
					bind:value={importText}
					placeholder="COMP 1110  Intro to Programming
MATH 1120  Calculus I
ENGL 1101  Academic Writing
CSIS 1100  Foundations of IS
COMP 2110  Data Structures
MATH 1130  Calculus II
STAT 2160  Statistics
CSIS 2100  Systems Analysis"
					rows="10"
				></textarea>
				<div class="import-actions">
					<button class="btn btn-primary" onclick={parseTranscript} disabled={saving}>
						→ parse {importText.trim()
							? importText.split('\n').filter((l) => l.trim()).length + ' lines'
							: ''}
					</button>
				</div>
				{#if importText.trim()}
					<p class="import-hint font-mono">
						Tip: courses are distributed across your {selectedTerms.length} semester{selectedTerms.length >
						1
							? 's'
							: ''} in order. You can reorder them after parsing.
					</p>
				{/if}
			</div>
		{/if}

		{#if inputMode === 'manual' || courseForms.length > 0}
			{#each selectedTerms as term (term.id)}
				<div class="semester-block">
					<h2 class="semester-head font-mono">{term.label}</h2>

					{#each courseForms.filter((f) => f.semesterId === term.id) as form (form.id)}
						<div class="course-row">
							<input
								type="text"
								placeholder="e.g. CSIS 4495"
								class="course-input code-input"
								bind:value={form.code}
								aria-label="Course code for {term.label}"
							/>
							<input
								type="text"
								placeholder="e.g. Capstone Project"
								class="course-input name-input"
								bind:value={form.name}
								aria-label="Course name for {term.label}"
							/>
							<button
								class="row-remove"
								onclick={() => removeCourseRow(form.id)}
								aria-label="Remove course">✕</button
							>
						</div>
					{/each}

					<button class="add-row-btn font-mono" onclick={() => addCourseRow(term.id)}>
						+ add course
					</button>
				</div>
			{/each}

			<div class="wizard-actions wizard-actions-between">
				<button class="btn btn-ghost" onclick={goBack} disabled={saving}>← back</button>
				<button class="btn btn-primary" onclick={saveCourses} disabled={saving}>
					{saving ? 'Saving…' : 'Save courses →'}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.4rem 0 0.25rem;
		line-height: 1;
	}

	.page-subtitle {
		color: var(--ink-soft);
		font-size: 0.95rem;
		margin: 0 0 1.5rem;
	}

	.wizard-actions {
		margin-top: 2rem;
		display: flex;
		justify-content: center;
	}

	.wizard-actions-between {
		justify-content: space-between;
	}

	.term-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 0.6rem;
		margin-bottom: 1rem;
	}

	.term-chip {
		padding: 0.75rem 1rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--ink);
		cursor: pointer;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transition:
			background 0.12s,
			border-color 0.12s;
	}

	.term-chip:hover {
		border-color: var(--ink);
		background: var(--paper-shelf);
	}

	.term-chip.selected {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}

	.mode-tabs {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1.5rem;
	}

	.mode-tab {
		padding: 0.5rem 1rem;
		border: 1px solid var(--rule);
		background: transparent;
		font-size: 0.72rem;
		color: var(--ink-soft);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		transition:
			background 0.12s,
			color 0.12s,
			border-color 0.12s;
	}

	.mode-tab:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.mode-tab.active {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}

	.import-block {
		margin-bottom: 1.5rem;
	}

	.import-desc {
		font-size: 0.8rem;
		color: var(--ink-soft);
		margin: 0 0 0.75rem;
		line-height: 1.5;
	}

	.import-textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink);
		resize: vertical;
		box-sizing: border-box;
		transition: border-color 0.12s var(--ease-out-quart);
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
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin: 0.5rem 0 0;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.semester-block {
		margin-bottom: 1.5rem;
		padding: 1.25rem;
		border: 1px solid var(--rule);
		background: var(--paper-shelf);
	}

	.semester-head {
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		margin: 0 0 0.75rem;
		font-weight: 500;
	}

	.course-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		align-items: center;
	}

	.course-input {
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--ink);
		transition: border-color 0.12s var(--ease-out-quart);
	}

	.course-input:focus {
		border-color: var(--ink);
	}

	.code-input {
		width: 130px;
		flex-shrink: 0;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.name-input {
		flex: 1;
	}

	.row-remove {
		background: none;
		border: none;
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 1rem;
		padding: 0.25rem;
		line-height: 1;
	}

	.row-remove:hover {
		color: var(--accent);
	}

	.add-row-btn {
		background: none;
		border: 1px dashed var(--ink-soft);
		padding: 0.4rem 0.75rem;
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		transition:
			color 0.12s,
			border-color 0.12s;
	}

	.add-row-btn:hover {
		color: var(--ink);
		border-color: var(--ink);
	}

	.parse-feedback {
		font-size: 0.85rem;
		color: var(--accent);
		margin: -0.75rem 0 1.5rem;
		min-height: 1.2em;
	}

	@media (max-width: 640px) {
		.term-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.semester-block .course-row {
			flex-wrap: wrap;
		}
		.semester-block .code-input {
			width: 100%;
		}
		.semester-block .name-input {
			width: 100%;
		}
	}
</style>
