<script lang="ts">
	import { resolveRoute } from '$app/paths';

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

	function sessionTitle(session: SessionSummary) {
		return session.topics.length > 0 ? session.topics.slice(0, 2).join(' · ') : 'Broad review';
	}

	function sessionSources(session: SessionSummary) {
		return session.sourceMaterials.map((source) => source.fileName).join(', ');
	}

	function citationLabel(source: MaterialSource) {
		if (source.pageStart == null) return source.fileName;
		if (source.pageEnd != null && source.pageEnd !== source.pageStart) {
			return `${source.fileName}, pages ${source.pageStart}–${source.pageEnd}`;
		}
		return `${source.fileName}, page ${source.pageStart}`;
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

	const missedOnlyAvailable = $derived(
		missedQuestions.length > 0 && currentIdx >= activeQuestions.length
	);

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

	const resultTone = $derived(
		score === activeQuestions.length && activeQuestions.length > 0
			? 'ok'
			: score >= activeQuestions.length / 2
				? 'warn'
				: 'crit'
	);

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

<svelte:head><title>Synapse · Practice</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-display">Practice</h1>
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
				onclick={() => (mode = 'quiz')}>quiz</button
			>
			<button
				class="mode-tab font-mono"
				class:active={mode === 'flashcards'}
				onclick={() => (mode = 'flashcards')}>flashcards</button
			>
		</div>
	</div>

	{#if selectedCourseInfo && selectedCourseInfo.readyMaterials.length > 0}
		<fieldset class="material-scope">
			<div class="material-scope-head">
				<legend>Use course materials</legend>
				{#if selectedCourseInfo.readyMaterials.length > 1}
					<button
						type="button"
						class="material-scope-toggle"
						onclick={() => {
							selectedMaterialIds =
								selectedMaterialIds.length === selectedCourseInfo.readyMaterials.length
									? []
									: selectedCourseInfo.readyMaterials.map((material) => material.id);
						}}
					>
						{selectedMaterialIds.length === selectedCourseInfo.readyMaterials.length
							? 'clear all'
							: 'select all'}
					</button>
				{/if}
			</div>
			<div class="material-options">
				{#each selectedCourseInfo.readyMaterials as material (material.id)}
					<label class="material-option">
						<input
							type="checkbox"
							checked={selectedMaterialIds.includes(material.id)}
							onchange={() => toggleMaterial(material.id)}
						/>
						<span>{material.fileName}</span>
					</label>
				{/each}
			</div>
			{#if selectedMaterialIds.length === 0}
				<p class="material-scope-error">Select at least one course material.</p>
			{/if}
		</fieldset>
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
		<section class="saved-practice" aria-labelledby="saved-practice-heading">
			<div class="saved-practice-head">
				<div>
					<div class="eyebrow font-mono">Course library</div>
					<h2 id="saved-practice-heading">Saved practice</h2>
				</div>
				{#if courseSessions.length > 0}
					<span class="saved-count font-mono">{courseSessions.length} saved</span>
				{/if}
			</div>

			{#if sessionsLoading}
				<p class="shelf-status font-mono">Loading saved practice…</p>
			{:else if courseSessions.length === 0}
				<p class="saved-empty">
					Generated quizzes and flashcards for this course will appear here.
				</p>
			{:else}
				<ul class="sessions-shelf">
					{#each courseSessions as session (session.id)}
						<li class="session-row" class:session-active={activeSessionId === session.id}>
							<div class="session-info">
								<div class="session-title">{sessionTitle(session)}</div>
								<div class="session-sources">{sessionSources(session)}</div>
								<div class="session-meta font-mono">
									<span>{session.questionCount} questions</span>
									<span>{session.flashcardCount} cards</span>
									<span>{session.score}/{session.questionCount} correct</span>
									<span>{session.status.replace('_', ' ')}</span>
									<time datetime={session.updatedAt}
										>{new Date(session.updatedAt).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}</time
									>
								</div>
							</div>
							<div class="session-actions">
								<button
									class="btn btn-secondary btn-sm"
									onclick={() => resumeSession(session.id, 'quiz')}>review quiz</button
								>
								<button
									class="btn btn-secondary btn-sm"
									onclick={() => resumeSession(session.id, 'flashcards')}>review cards</button
								>
								<button
									class="session-delete"
									onclick={() => deleteSession(session.id)}
									aria-label={`Delete ${sessionTitle(session)} practice set`}>delete</button
								>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if mode === 'quiz'}
		{#if activeQuestions.length === 0 && !generating}
			<div class="empty-state surface-polaroid">
				<h2 class="empty-head font-display">No questions yet</h2>
				<p class="empty-text">
					Upload materials for this course, then generate practice questions from them.
				</p>
			</div>
		{:else if generating && activeQuestions.length === 0}
			<div class="empty-state surface-polaroid">
				<h2 class="empty-head font-display">Generating…</h2>
				<p class="empty-text">Building questions from your course materials.</p>
			</div>
		{:else if quizDone}
			<div class="quiz-result surface-polaroid">
				<h2 class="result-head font-display">Quiz Complete</h2>
				<p class="result-score">{score} / {activeQuestions.length} correct</p>
				<div class="result-bar">
					<div
						class="result-fill"
						style="transform: scaleX({activeQuestions.length > 0
							? score / activeQuestions.length
							: 0});
							background: {resultTone === 'ok'
							? 'var(--ok)'
							: resultTone === 'warn'
								? 'var(--warn)'
								: 'var(--accent)'};"
					></div>
				</div>
				<p class="result-note font-mono">
					{resultTone === 'ok'
						? 'Perfect score. Strong topic mastery.'
						: resultTone === 'warn'
							? 'Good. Review the ones you missed.'
							: 'Needs work. Flagged topics for your next study session.'}
				</p>
				<div class="result-actions">
					{#if missedOnlyAvailable}
						<button class="btn btn-primary" onclick={restartMissedOnly}>
							redo missed ({missedQuestions.length})
						</button>
					{/if}
					<button class="btn btn-ghost" onclick={restartQuiz}>try again</button>
				</div>
			</div>
		{:else}
			<div class="quiz-progress font-mono">
				question {currentIdx + 1} of {activeQuestions.length}
			</div>

			<article class="question-card surface-polaroid">
				<div class="q-meta">
					<span class="q-course font-mono">{currentQuestion.course}</span>
					<span class="q-topic font-mono">{currentQuestion.topic}</span>
				</div>
				<p class="q-text">{currentQuestion.question}</p>

				<div class="q-options">
					{#each currentQuestion.options as opt, i (i)}
						<button
							class="q-option"
							class:selected={selectedAnswer === i}
							class:correct={showResult && i === currentQuestion.correctIndex}
							class:wrong={showResult && selectedAnswer === i && i !== currentQuestion.correctIndex}
							disabled={showResult}
							onclick={() => {
								if (!showResult) selectedAnswer = i;
							}}
						>
							<span class="q-opt-label font-mono">{String.fromCharCode(65 + i)}</span>
							<span class="q-opt-text">{opt}</span>
						</button>
					{/each}
				</div>

				<div class="q-actions">
					{#if !showResult}
						<button
							class="btn btn-primary"
							disabled={selectedAnswer === null}
							onclick={submitAnswer}>check answer</button
						>
					{:else}
						<div class="q-feedback">
							<span class="q-fb-icon"
								>{selectedAnswer === currentQuestion.correctIndex ? '✓' : '✕'}</span
							>
							<span class="q-fb-text">
								{#if selectedAnswer === currentQuestion.correctIndex}
									Correct!
								{:else}
									The correct answer was <strong
										>{currentQuestion.options[currentQuestion.correctIndex]}</strong
									>
								{/if}
							</span>
						</div>
						<div class="q-detail">
							<p class="q-explanation">{currentQuestion.explanation}</p>
							<p class="q-source font-mono">Source: {citationLabel(currentQuestion.source)}</p>
						</div>
						<button class="btn btn-primary" onclick={nextQuestion}>
							{currentIdx < activeQuestions.length - 1 ? 'next question' : 'see results'}
						</button>
					{/if}
				</div>
			</article>
		{/if}
	{:else if filteredFlashcards.length === 0 && !generating}
		<div class="empty-state surface-polaroid">
			<h2 class="empty-head font-display">No flashcards yet</h2>
			<p class="empty-text">
				Upload materials for this course, then generate flashcards from them.
			</p>
		</div>
	{:else if generating && filteredFlashcards.length === 0}
		<div class="empty-state surface-polaroid">
			<h2 class="empty-head font-display">Generating…</h2>
			<p class="empty-text">Building flashcards from your course materials.</p>
		</div>
	{:else}
		<div class="fc-progress font-mono">
			{cardIdx + 1} of {filteredFlashcards.length}
		</div>

		<div
			class="fc-stage"
			onclick={flipCard}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					flipCard();
				}
			}}
			role="button"
			tabindex="0"
			aria-label="Tap to flip card"
		>
			<div class="fc-flipper" class:fc-flipped={cardSide === 'back'}>
				<div class="fc-face fc-face-front">
					<div class="fc-meta">
						<span class="fc-course font-mono">{currentCard.course}</span>
						<span class="fc-topic font-mono">{currentCard.topic}</span>
					</div>
					<div class="fc-body">
						<span class="fc-front font-display">{currentCard.front}</span>
					</div>
					<span class="fc-hint font-mono">tap to flip</span>
				</div>
				<div class="fc-face fc-face-back">
					<div class="fc-meta">
						<span class="fc-course font-mono">{currentCard.course}</span>
						<span class="fc-topic font-mono">{currentCard.topic}</span>
					</div>
					<div class="fc-body">
						<span class="fc-back">{currentCard.back}</span>
					</div>
					<span class="fc-source font-mono">Source: {citationLabel(currentCard.source)}</span>
				</div>
			</div>
		</div>

		<div class="fc-nav">
			<button class="btn btn-secondary btn-sm" disabled={cardIdx === 0} onclick={prevCard}
				>← previous</button
			>
			<button
				class="btn btn-secondary btn-sm"
				disabled={cardIdx >= filteredFlashcards.length - 1}
				onclick={nextCard}>next →</button
			>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1;
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
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font-size: 0.72rem;
		color: var(--ink-soft);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
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

	.material-scope {
		padding: 0;
		margin: 0 0 1rem;
		border: 0;
	}

	.material-scope-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.45rem;
	}

	.material-scope legend {
		padding: 0;
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.material-scope-toggle {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		font: 0.72rem var(--font-mono);
		text-decoration: underline;
		text-underline-offset: 0.2rem;
		cursor: pointer;
	}

	.material-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
		gap: 0.4rem;
	}

	.material-option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.82rem;
		cursor: pointer;
	}

	.material-option input {
		accent-color: var(--ink);
	}

	.material-option span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.material-scope-error {
		margin: 0.45rem 0 0;
		color: var(--accent);
		font-size: 0.78rem;
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

	.practice-focus-input:focus {
		border-color: var(--ink);
		outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
		outline-offset: 1px;
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

	.quiz-progress,
	.fc-progress {
		font-size: 0.75rem;
		color: var(--ink-soft);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.question-card {
		padding: 1.5rem 1.5rem 1.75rem;
	}

	.q-meta {
		display: flex;
		gap: 0.85rem;
		margin-bottom: 1rem;
		padding-bottom: 0.65rem;
		border-bottom: 1px solid var(--rule);
	}

	.q-course,
	.q-topic {
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.q-text {
		font-family: var(--font-display);
		font-size: 1.15rem;
		color: var(--ink);
		line-height: 1.4;
		margin: 0 0 1.5rem;
		font-weight: 500;
	}

	.q-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.q-option {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.7rem 0.95rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
		text-align: left;
		font-family: var(--font-body);
		transition:
			border-color 0.12s,
			background 0.12s;
	}

	.q-option:hover:not(:disabled) {
		border-color: var(--ink);
	}

	.q-option.selected {
		border-color: var(--ink);
		background: var(--paper-shelf);
	}

	.q-option.correct {
		border-color: var(--ok);
		background: rgba(90, 122, 74, 0.12);
	}

	.q-option.wrong {
		border-color: var(--accent);
		background: rgba(176, 58, 46, 0.1);
	}

	.q-option:disabled {
		cursor: default;
	}

	.q-opt-label {
		font-size: 0.75rem;
		color: var(--ink-faint);
		width: 1.2rem;
		flex-shrink: 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.q-opt-text {
		font-size: 0.9rem;
		color: var(--ink);
	}

	.q-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.q-feedback {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.85rem;
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
	}

	.q-fb-icon {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--ink);
		animation: qFeedback 0.4s var(--ease-out-quart) both;
	}

	.q-fb-text {
		font-size: 0.88rem;
		color: var(--ink);
	}

	.q-detail {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.q-explanation {
		font-size: 0.88rem;
		color: var(--ink);
		margin: 0;
		line-height: 1.45;
	}

	.q-source {
		font-size: 0.72rem;
		color: var(--ink-faint);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	@keyframes qFeedback {
		from {
			transform: scale(0.7);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.quiz-result {
		padding: 2.5rem 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
	}

	.result-head {
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 600;
		color: var(--ink);
		margin: 0;
		line-height: 1;
		letter-spacing: -0.01em;
	}

	.result-score {
		font-size: 1.1rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.result-bar {
		width: 200px;
		height: 6px;
		background: var(--rule);
		overflow: hidden;
	}

	.result-fill {
		height: 100%;
		width: 100%;
		transform-origin: left;
		transition: transform 0.4s ease;
	}

	.result-note {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0;
	}

	.result-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.fc-stage {
		position: relative;
		width: 100%;
		min-height: 280px;
		perspective: 1200px;
		cursor: pointer;
		font-family: var(--font-body);
	}

	.fc-flipper {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 280px;
		transition: transform 0.55s cubic-bezier(0.2, 0.7, 0.3, 1);
		transform-style: preserve-3d;
	}

	.fc-flipper.fc-flipped {
		transform: rotateY(180deg);
	}

	.fc-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 2rem 1.5rem 1.5rem;
		background: var(--paper);
		border: 1px solid var(--rule);
		text-align: center;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.fc-face-back {
		transform: rotateY(180deg);
	}

	.fc-stage:hover .fc-face {
		border-color: var(--ink);
	}

	.fc-meta {
		display: flex;
		gap: 0.85rem;
	}

	.fc-course,
	.fc-topic {
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.fc-body {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.fc-front {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.fc-back {
		font-size: 1rem;
		color: var(--ink);
		line-height: 1.5;
		max-width: 500px;
	}

	.fc-source {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.fc-hint {
		font-size: 0.72rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.fc-nav {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
		gap: 0.75rem;
	}

	.shelf-status {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin: 0 0 0.75rem;
	}

	.saved-practice {
		padding: 1rem 0;
		margin: 1.1rem 0 1.25rem;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}

	.saved-practice-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.saved-practice-head h2 {
		margin: 0.15rem 0 0;
		font: 600 1.15rem var(--font-display);
	}

	.saved-practice-head .eyebrow,
	.saved-count {
		color: var(--ink-faint);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.saved-empty {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.86rem;
	}

	.sessions-shelf {
		display: grid;
		gap: 0.55rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.session-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}

	.session-row.session-active {
		border-color: var(--ink);
		background: var(--paper-shelf);
	}

	.session-info {
		min-width: 0;
	}

	.session-title {
		color: var(--ink);
		font-size: 0.92rem;
		font-weight: 600;
	}

	.session-sources {
		overflow: hidden;
		margin-top: 0.15rem;
		color: var(--ink-soft);
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.session-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.75rem;
		margin-top: 0.4rem;
		color: var(--ink-faint);
		font-size: 0.65rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.session-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.session-delete {
		padding: 0.35rem 0.45rem;
		border: 0;
		background: transparent;
		color: var(--accent);
		font: 0.65rem var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	@media (max-width: 700px) {
		.session-row {
			grid-template-columns: minmax(0, 1fr);
		}

		.session-actions {
			justify-content: flex-start;
		}
	}

	.empty-state {
		padding: 3rem 2rem;
		text-align: center;
		margin-top: 1rem;
	}

	.empty-head {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.empty-text {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0;
	}
</style>
