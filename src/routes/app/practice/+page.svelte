<script lang="ts">
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';

	type Question = {
		id: string;
		course: string;
		topic: string;
		question: string;
		options: string[];
		correctIndex: number;
	};

	type Flashcard = {
		id: string;
		course: string;
		topic: string;
		front: string;
		back: string;
	};

	type CourseRef = { code: string };

	let {
		data
	}: {
		data: { courses?: CourseRef[]; questions?: Question[]; flashcards?: Flashcard[] };
	} = $props();

	const courses = $derived(data.courses ?? []);
	const questions = $derived(data.questions ?? []);
	const flashcards = $derived(data.flashcards ?? []);

	let selectedCourse = $state<string>('all');
	let mode = $state<'quiz' | 'flashcards'>('quiz');

	const currentTermLabel = 'Practice';

	const baseFilteredQuestions = $derived(
		selectedCourse === 'all' ? questions : questions.filter((q) => q.course === selectedCourse)
	);
	let activeQuestions = $state<Question[]>([]);
	let filteredFlashcards = $derived(
		selectedCourse === 'all' ? flashcards : flashcards.filter((f) => f.course === selectedCourse)
	);

	$effect(() => {
		activeQuestions = baseFilteredQuestions;
		missedQuestions = [];
		currentIdx = 0;
		selectedAnswer = null;
		showResult = false;
		score = 0;
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
	}

	function nextQuestion() {
		selectedAnswer = null;
		showResult = false;
		currentIdx++;
	}

	function restartQuiz() {
		activeQuestions = baseFilteredQuestions;
		missedQuestions = [];
		currentIdx = 0;
		selectedAnswer = null;
		showResult = false;
		score = 0;
	}

	function restartMissedOnly() {
		activeQuestions = missedQuestions;
		missedQuestions = [];
		currentIdx = 0;
		selectedAnswer = null;
		showResult = false;
		score = 0;
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
</script>

<svelte:head><title>Synapse · Practice</title></svelte:head>

<CatalogHeader term={currentTermLabel} />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Practice</h1>
		<p class="page-tagline">
			{#if questions.length > 0 || flashcards.length > 0}
				<span class="tagline-num">{questions.length}</span> question{questions.length !== 1
					? 's'
					: ''} ·
				<span class="tagline-num">{flashcards.length}</span> flashcard{flashcards.length !== 1
					? 's'
					: ''}
				across
				<span class="tagline-num">{courses.length}</span> course{courses.length !== 1 ? 's' : ''}
			{:else}
				Quiz yourself or flip through flashcards
			{/if}
		</p>
	</div>

	<div class="control-bar">
		<div class="course-tabs">
			<button
				class="course-tab font-mono"
				class:active={selectedCourse === 'all'}
				onclick={() => {
					selectedCourse = 'all';
					currentIdx = 0;
					cardIdx = 0;
				}}>all courses</button
			>
			{#each courses as c (c.code)}
				<button
					class="course-tab font-mono"
					class:active={selectedCourse === c.code}
					onclick={() => {
						selectedCourse = c.code;
						currentIdx = 0;
						cardIdx = 0;
					}}>{c.code}</button
				>
			{/each}
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

	{#if mode === 'quiz'}
		{#if activeQuestions.length === 0}
			<div class="empty-state surface-polaroid">
				<h2 class="empty-head font-hand">No questions yet</h2>
				<p class="empty-text">
					No practice questions yet for
					{selectedCourse === 'all' ? 'any course' : selectedCourse}. Upload course materials to
					generate them.
				</p>
			</div>
		{:else if quizDone}
			<div class="quiz-result surface-polaroid">
				<h2 class="result-head font-hand">Quiz Complete</h2>
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
						<button class="btn btn-primary" onclick={nextQuestion}>
							{currentIdx < activeQuestions.length - 1 ? 'next question' : 'see results'}
						</button>
					{/if}
				</div>
			</article>
		{/if}
	{:else if filteredFlashcards.length === 0}
		<div class="empty-state surface-polaroid">
			<h2 class="empty-head font-hand">No flashcards yet</h2>
			<p class="empty-text">
				Upload course materials to generate flashcards for
				{selectedCourse === 'all' ? 'your courses' : selectedCourse}.
			</p>
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
						<span class="fc-front font-hand">{currentCard.front}</span>
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
					<span class="fc-hint font-mono">tap to flip back</span>
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
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--ink);
	}

	.course-tabs,
	.mode-tabs {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.course-tab,
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

	.course-tab:hover,
	.mode-tab:hover {
		border-color: var(--ink);
		color: var(--ink);
	}

	.course-tab.active,
	.mode-tab.active {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
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
		max-width: 400px;
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
