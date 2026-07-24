<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import MaterialSelector from '$lib/components/practice/MaterialSelector.svelte';
	import SessionList from '$lib/components/practice/SessionList.svelte';
	import QuizResult from '$lib/components/practice/QuizResult.svelte';
	import QuestionCard from '$lib/components/practice/QuestionCard.svelte';
	import FlashcardViewer from '$lib/components/practice/FlashcardViewer.svelte';
	import LoadingDots from '$lib/components/ui/LoadingDots.svelte';

	type MaterialSource = {
		materialId: string;
		fileName: string;
		pageStart?: number;
		pageEnd?: number;
	};

	type SessionSummary = {
		id: string;
		courseId: string;
		courseCode: string;
		status: 'in_progress' | 'completed' | 'paused';
		score: number;
		questionCount: number;
		flashcardCount: number;
		topics: string[];
		sourceMaterials: MaterialSource[];
		createdAt: string;
		updatedAt: string;
	};

	type Question = {
		id: string;
		course: string;
		topic: string;
		question: string;
		options: string[];
		correctIndex: number;
		explanation: string;
		source: MaterialSource;
	};

	type Flashcard = {
		id: string;
		course: string;
		topic: string;
		front: string;
		back: string;
		source: MaterialSource;
	};

	type SavedSession = {
		id: string;
		questions: Record<string, unknown>[];
		flashcards: Record<string, unknown>[];
		score: number;
		currentQuestionIndex: number;
		missedQuestionIds: string[];
		currentCardIndex: number;
		cardSide: 'front' | 'back';
	};

	type GenerateApiResponse = {
		ok?: boolean;
		error?: string;
		reason?: string;
		questions?: Record<string, unknown>[];
		flashcards?: Record<string, unknown>[];
	};

	type CourseRef = {
		id: string;
		code: string;
		name: string;
		materialCount: number;
		readyMaterialCount: number;
		indexingMaterialCount: number;
		readyMaterials: { id: string; fileName: string }[];
	};

	let {
		data
	}: {
		data: {
			courses?: CourseRef[];
			course?: { id: string; semesterId: string };
		};
	} = $props();

	const serverCourses = $derived(data.courses ?? []);

	let questions = $state<Question[]>([]);
	let flashcards = $state<Flashcard[]>([]);

	let selectedCourse = $state('');
	let loadedCourseId = '';
	let generating = $state(false);
	let generateError = $state<string | null>(null);
	let practiceTopic = $state('');
	let selectedMaterialIds = $state<string[]>([]);
	let materialSelectionCourseId = '';

	let sessions = $state<SessionSummary[]>([]);
	let sessionsLoading = $state(false);
	let sessionsError = $state<string | null>(null);
	let activeSessionId = $state<string | null>(null);
	let savingSession = $state(false);
	let sessionSaveError = $state<string | null>(null);

	let mode = $state<'quiz' | 'flashcards'>('quiz');

	const selectedCourseInfo = $derived(serverCourses.find((c) => c.id === selectedCourse));
	const materialsHref = $derived(
		data.course
			? resolveRoute('/app/semesters/[semesterId]/courses/[courseId]/materials', {
					semesterId: data.course.semesterId,
					courseId: data.course.id
				})
			: null
	);
	const selectedCourseCode = $derived(selectedCourseInfo?.code ?? '');

	$effect(() => {
		const info = selectedCourseInfo;
		if (!info || materialSelectionCourseId === info.id) return;
		materialSelectionCourseId = info.id;
		selectedMaterialIds = info.readyMaterials.map((material) => material.id);
	});

	const courseSessions = $derived(
		selectedCourse ? sessions.filter((s) => s.courseId === selectedCourse) : []
	);

	const baseFilteredQuestions = $derived(
		selectedCourse ? questions.filter((q) => q.course === selectedCourseCode) : []
	);
	let activeQuestions = $state<Question[]>([]);
	let filteredFlashcards = $derived(
		selectedCourse ? flashcards.filter((f) => f.course === selectedCourseCode) : []
	);

	function toggleMaterial(materialId: string) {
		selectedMaterialIds = selectedMaterialIds.includes(materialId)
			? selectedMaterialIds.filter((id) => id !== materialId)
			: [...selectedMaterialIds, materialId];
	}

	function resetSession(nextQuestions: Question[] = []) {
		activeQuestions = nextQuestions;
		missedQuestions = [];
		currentIdx = 0;
		selectedAnswer = null;
		showResult = false;
		score = 0;
		cardIdx = 0;
		cardSide = 'front';
	}

	function selectCourse(courseId: string) {
		selectedCourse = courseId;
		questions = [];
		flashcards = [];
		generateError = null;
		resetSession();
		activeSessionId = null;
		void loadSessions(courseId);
	}

	$effect(() => {
		const courseId = serverCourses[0]?.id;
		if (!courseId || loadedCourseId === courseId) return;
		loadedCourseId = courseId;
		selectCourse(courseId);
	});

	let currentIdx = $state(0);
	let selectedAnswer = $state<number | null>(null);
	let showResult = $state(false);
	let score = $state(0);
	let missedQuestions = $state<Question[]>([]);

	let currentQuestion = $derived(activeQuestions[currentIdx]);
	let quizDone = $derived(currentIdx >= activeQuestions.length && activeQuestions.length > 0);

	function submitAnswer() {
		if (selectedAnswer === null) return;
		if (currentQuestion) {
			if (selectedAnswer === currentQuestion.correctIndex) {
				score++;
			} else {
				missedQuestions = [...missedQuestions, currentQuestion];
			}
		}
		showResult = true;
		void saveProgress();
	}

	function nextQuestion() {
		selectedAnswer = null;
		showResult = false;
		currentIdx++;
		void saveProgress();
	}

	function restartQuiz() {
		activeQuestions = baseFilteredQuestions;
		missedQuestions = [];
		currentIdx = 0;
		selectedAnswer = null;
		showResult = false;
		score = 0;
		void saveProgress('in_progress');
	}

	function restartMissedOnly() {
		activeQuestions = missedQuestions;
		missedQuestions = [];
		currentIdx = 0;
		selectedAnswer = null;
		showResult = false;
		score = 0;
		void saveProgress('in_progress');
	}

	let cardSide = $state<'front' | 'back'>('front');
	let cardIdx = $state(0);
	let currentCard = $derived(filteredFlashcards[cardIdx]);

	function flipCard() {
		cardSide = cardSide === 'front' ? 'back' : 'front';
	}

	function nextCard() {
		if (cardIdx < filteredFlashcards.length - 1) {
			cardIdx++;
			cardSide = 'front';
		}
	}

	function prevCard() {
		if (cardIdx > 0) {
			cardIdx--;
			cardSide = 'front';
		}
	}

	// Autosave when quiz completes
	$effect(() => {
		if (quizDone && activeQuestions.length > 0 && activeSessionId) {
			void saveProgress('completed');
		}
	});

	async function loadSessions(courseId: string) {
		sessionsLoading = true;
		sessionsError = null;
		try {
			const res = await fetch(`/api/practice/sessions?courseId=${encodeURIComponent(courseId)}`);
			if (res.ok) {
				const json = (await res.json()) as { sessions?: SessionSummary[] };
				sessions = json.sessions ?? [];
			} else {
				sessions = [];
			}
		} catch {
			sessionsError = 'Failed to load saved sessions';
			sessions = [];
		} finally {
			sessionsLoading = false;
		}
	}

	async function saveCurrentSession(questions: Question[], flashcards: Flashcard[]) {
		if (!selectedCourse || !selectedCourseInfo) return;
		savingSession = true;
		sessionSaveError = null;
		try {
			const sourceMaterials = [
				...new Map(
					[...questions, ...flashcards]
						.filter((item) => item.source.materialId)
						.map((item) => [item.source.materialId, item.source])
				).values()
			];

			const body = {
				courseId: selectedCourse,
				courseCode: selectedCourseInfo.code,
				sourceMaterials: sourceMaterials.map((s) => ({
					materialId: s.materialId,
					fileName: s.fileName,
					uploadedAt: new Date().toISOString()
				})),
				questions: questions.map((q) => ({
					id: q.id,
					courseCode: q.course,
					topic: q.topic,
					question: q.question,
					options: q.options,
					correctIndex: q.correctIndex,
					explanation: q.explanation,
					source: q.source
				})),
				flashcards: flashcards.map((f) => ({
					id: f.id,
					courseCode: f.course,
					topic: f.topic,
					front: f.front,
					back: f.back,
					source: f.source
				}))
			};

			const res = await fetch('/api/practice/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const json = (await res.json().catch(() => null)) as { error?: string } | null;
				sessionSaveError = json?.error ?? 'Failed to save session';
				return;
			}

			const json = (await res.json()) as { session: { id: string } };
			activeSessionId = json.session.id;
			await loadSessions(selectedCourse);
		} catch {
			sessionSaveError = 'Failed to save session. Is the server running?';
		} finally {
			savingSession = false;
		}
	}

	async function resumeSession(sessionId: string, requestedMode: 'quiz' | 'flashcards') {
		try {
			mode = requestedMode;
			const res = await fetch(`/api/practice/sessions/${sessionId}`);
			if (!res.ok) {
				sessionSaveError = 'Failed to load session';
				return;
			}
			const json = (await res.json()) as { session: SavedSession };
			const session = json.session;

			const restoredQuestions: Question[] = (session.questions ?? []).map(
				(q: Record<string, unknown>) => ({
					id: q.id as string,
					course: q.courseCode as string,
					topic: q.topic as string,
					question: q.question as string,
					options: q.options as string[],
					correctIndex: q.correctIndex as number,
					explanation: q.explanation as string,
					source: q.source as MaterialSource
				})
			);

			const restoredFlashcards: Flashcard[] = (session.flashcards ?? []).map(
				(f: Record<string, unknown>) => ({
					id: f.id as string,
					course: f.courseCode as string,
					topic: f.topic as string,
					front: f.front as string,
					back: f.back as string,
					source: f.source as MaterialSource
				})
			);

			questions = restoredQuestions;
			flashcards = restoredFlashcards;
			activeSessionId = session.id;
			score = session.score;
			currentIdx = session.currentQuestionIndex;
			missedQuestions = restoredQuestions.filter((q: Question) =>
				(session.missedQuestionIds ?? []).includes(q.id)
			);
			cardIdx = session.currentCardIndex;
			cardSide = session.cardSide;
			activeQuestions = restoredQuestions;
			selectedAnswer = null;
			showResult = false;
		} catch {
			sessionSaveError = 'Failed to load session. Is the server running?';
		}
	}

	async function deleteSession(sessionId: string) {
		try {
			const res = await fetch(`/api/practice/sessions/${sessionId}`, { method: 'DELETE' });
			if (!res.ok) return;
			if (activeSessionId === sessionId) {
				activeSessionId = null;
			}
			await loadSessions(selectedCourse);
		} catch {
			sessionSaveError = 'Failed to delete session';
		}
	}

	async function saveProgress(status: 'in_progress' | 'completed' | 'paused' = 'in_progress') {
		if (!activeSessionId) return;
		try {
			const body: Record<string, unknown> = {
				score,
				currentQuestionIndex: currentIdx,
				missedQuestionIds: missedQuestions.map((q) => q.id),
				currentCardIndex: cardIdx,
				cardSide,
				status
			};
			await fetch(`/api/practice/sessions/${activeSessionId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
		} catch {
			// silent — progress save is best-effort
		}
	}

	async function generatePractice() {
		if (!selectedCourse || generating) return;
		generating = true;
		generateError = null;
		activeSessionId = null;

		try {
			const res = await fetch('/api/practice/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					courseId: selectedCourse,
					materialIds: selectedMaterialIds,
					...(practiceTopic.trim() ? { topic: practiceTopic.trim() } : {})
				})
			});

			const json = (await res.json()) as GenerateApiResponse;

			if (!res.ok || !json.ok) {
				const message = json.error || 'Generation failed';
				throw new Error(json.reason ? `${message}: ${json.reason}` : message);
			}

			if (!json.questions || !json.flashcards) {
				throw new Error('Generation returned an incomplete practice set');
			}

			const newQuestions: Question[] = json.questions.map((q) => ({
				id: q.id as string,
				course: q.courseCode as string,
				topic: q.topic as string,
				question: q.question as string,
				options: q.options as string[],
				correctIndex: q.correctIndex as number,
				explanation: q.explanation as string,
				source: q.source as MaterialSource
			}));

			const newFlashcards: Flashcard[] = json.flashcards.map((f) => ({
				id: f.id as string,
				course: f.courseCode as string,
				topic: f.topic as string,
				front: f.front as string,
				back: f.back as string,
				source: f.source as MaterialSource
			}));

			questions = newQuestions;
			flashcards = newFlashcards;
			resetSession(newQuestions);

			await saveCurrentSession(newQuestions, newFlashcards);
		} catch (err) {
			generateError = err instanceof Error ? err.message : 'Generation failed';
		} finally {
			generating = false;
		}
	}
</script>

<svelte:head>
	<title
		>{selectedCourseInfo
			? `${selectedCourseInfo.code} · Practice · Synapse`
			: 'Practice · Synapse'}</title
	>
</svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title">Practice</h1>
		<p class="page-tagline">
			{#if questions.length > 0 || flashcards.length > 0}
				<span class="tagline-num">{questions.length}</span> question{questions.length !== 1
					? 's'
					: ''} ·
				<span class="tagline-num">{flashcards.length}</span> flashcard{flashcards.length !== 1
					? 's'
					: ''}
				for {selectedCourseInfo?.code ?? 'this course'}
			{:else}
				Quiz yourself or flip through flashcards
			{/if}
		</p>
	</div>

	<div class="control-bar">
		<div class="course-practice-context font-mono">
			{selectedCourseInfo?.code} · {selectedCourseInfo?.materialCount ?? 0} materials
		</div>
		<div class="mode-tabs">
			<button
				class="mode-tab font-mono"
				class:active={mode === 'quiz'}
				aria-pressed={mode === 'quiz'}
				onclick={() => (mode = 'quiz')}>quiz</button
			>
			<button
				class="mode-tab font-mono"
				class:active={mode === 'flashcards'}
				aria-pressed={mode === 'flashcards'}
				onclick={() => (mode = 'flashcards')}>flashcards</button
			>
		</div>
	</div>

	{#if selectedCourseInfo && selectedCourseInfo.readyMaterials.length > 0}
		<MaterialSelector
			materials={selectedCourseInfo.readyMaterials}
			selectedIds={selectedMaterialIds}
			ontoggle={toggleMaterial}
		/>
	{/if}

	<label class="practice-focus">
		<span class="practice-focus-label">Focus on a topic <small>optional</small></span>
		<input
			class="practice-focus-input"
			type="text"
			bind:value={practiceTopic}
			maxlength="200"
			placeholder="e.g. Linux event logging"
		/>
	</label>

	<div class="generate-bar">
		<button
			class="btn btn-primary btn-generate"
			disabled={generating || !selectedCourse || selectedMaterialIds.length === 0}
			onclick={generatePractice}
		>
			{generating ? 'Generating…' : 'Generate practice'}
		</button>
		{#if selectedCourseInfo}
			<span class="generate-hint font-mono">
				{selectedCourseInfo.readyMaterialCount} ready material{selectedCourseInfo.readyMaterialCount !==
				1
					? 's'
					: ''} · {selectedCourseInfo.name}
			</span>
			{#if selectedCourseInfo.materialCount === 0 && materialsHref}
				<a class="material-setup-link" href={materialsHref}>Upload materials →</a>
			{:else if selectedCourseInfo.readyMaterialCount === 0 && materialsHref}
				<a class="material-setup-link" href={materialsHref}>
					{selectedCourseInfo.indexingMaterialCount > 0
						? 'Finish indexing →'
						: 'Review materials →'}
				</a>
			{/if}
		{/if}
	</div>

	{#if sessionSaveError}
		<div class="error-banner surface-polaroid">
			<span class="error-text">{sessionSaveError}</span>
			{#if questions.length > 0 && flashcards.length > 0}
				<button
					class="btn btn-ghost btn-sm"
					disabled={savingSession}
					onclick={() => saveCurrentSession(questions, flashcards)}
				>
					{savingSession ? 'saving…' : 'save session'}
				</button>
			{/if}
		</div>
	{/if}

	{#if generateError}
		<div class="error-banner surface-polaroid">
			<span class="error-text">{generateError}</span>
			<button class="btn btn-ghost btn-sm" onclick={generatePractice}>retry</button>
		</div>
	{/if}

	{#if selectedCourse}
		<SessionList
			sessions={courseSessions}
			{activeSessionId}
			loading={sessionsLoading}
			onresume={resumeSession}
			ondelete={deleteSession}
		/>
	{/if}

	{#if mode === 'quiz'}
		{#if activeQuestions.length === 0 && !generating}
			<div class="empty-state surface-polaroid">
				<h2 class="empty-head font-hand">No questions yet</h2>
				<p class="empty-text">
					Upload materials for this course, then generate practice questions from them.
				</p>
			</div>
		{:else if generating && activeQuestions.length === 0}
			<div class="empty-state surface-polaroid">
				<LoadingDots label="Generating questions" />
				<p class="empty-text">Building questions from your course materials.</p>
			</div>
		{:else if quizDone}
			<QuizResult
				{score}
				total={activeQuestions.length}
				missedCount={missedQuestions.length}
				onrestartmissed={missedQuestions.length > 0 ? restartMissedOnly : undefined}
				ontryagain={restartQuiz}
			/>
		{:else}
			<QuestionCard
				question={currentQuestion}
				index={currentIdx}
				totalQuestions={activeQuestions.length}
				{selectedAnswer}
				{showResult}
				onselectanswer={(i) => {
					selectedAnswer = i;
				}}
				onsubmit={submitAnswer}
				onnext={nextQuestion}
			/>
		{/if}
	{:else if filteredFlashcards.length === 0 && !generating}
		<div class="empty-state surface-polaroid">
			<h2 class="empty-head font-hand">No flashcards yet</h2>
			<p class="empty-text">
				Upload materials for this course, then generate flashcards from them.
			</p>
		</div>
	{:else if generating && filteredFlashcards.length === 0}
		<div class="empty-state surface-polaroid">
			<LoadingDots label="Generating flashcards" />
			<p class="empty-text">Building flashcards from your course materials.</p>
		</div>
	{:else}
		<FlashcardViewer
			{currentCard}
			{cardIdx}
			totalCards={filteredFlashcards.length}
			{cardSide}
			onflip={flipCard}
			onprev={prevCard}
			onnext={nextCard}
		/>
	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
	}

	.control-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--ink);
	}

	.course-practice-context {
		padding-block: 0.45rem;
		color: var(--ink-soft);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.mode-tabs {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.mode-tab {
		padding: 0.55rem 0.95rem;
		min-height: 2.5rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-size: 0.72rem;
		color: var(--ink-soft);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		transition:
			background 0.12s var(--ease-out-quart),
			border-color 0.12s var(--ease-out-quart),
			color 0.12s var(--ease-out-quart);
	}

	@media (pointer: coarse) {
		.mode-tab {
			min-height: 2.75rem;
		}
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

	.practice-focus {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 0.85rem;
	}

	.practice-focus-label {
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.practice-focus-label small {
		color: var(--ink-faint);
		font-weight: 400;
	}

	.practice-focus-input {
		width: min(100%, 32rem);
		min-height: 2.65rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font: 0.9rem var(--font-body);
	}

	.generate-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.btn-generate {
		font-size: 0.78rem;
	}

	.generate-hint {
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.material-setup-link {
		margin-left: auto;
		color: var(--ink);
		font: 500 0.78rem var(--font-body);
		text-decoration-color: var(--accent);
		text-underline-offset: 0.2rem;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 1rem;
		margin-bottom: 0.75rem;
		border: 1px solid var(--accent);
	}

	.error-text {
		flex: 1;
		font-size: 0.85rem;
		color: var(--ink);
	}

	.empty-state {
		padding: 3rem 2rem;
		text-align: center;
		margin-top: 1rem;
	}

	.empty-head {
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.empty-text {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0;
	}
</style>
