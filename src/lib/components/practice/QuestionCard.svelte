<script lang="ts">
	type MaterialSource = {
		materialId: string;
		fileName: string;
		pageStart?: number;
		pageEnd?: number;
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

	let {
		question,
		index = 0,
		totalQuestions,
		selectedAnswer = null,
		showResult = false,
		onselectanswer,
		onsubmit,
		onnext
	}: {
		question: Question;
		index?: number;
		totalQuestions: number;
		selectedAnswer?: number | null;
		showResult?: boolean;
		onselectanswer: (i: number) => void;
		onsubmit: () => void;
		onnext: () => void;
	} = $props();

	function citationLabel(source: MaterialSource) {
		if (source.pageStart == null) return source.fileName;
		if (source.pageEnd != null && source.pageEnd !== source.pageStart) {
			return `${source.fileName}, pages ${source.pageStart}–${source.pageEnd}`;
		}
		return `${source.fileName}, page ${source.pageStart}`;
	}
</script>

<div class="quiz-progress font-mono">
	question {index + 1} of {totalQuestions}
</div>

<article class="question-card surface-polaroid">
	<div class="q-meta">
		<span class="q-course font-mono">{question.course}</span>
		<span class="q-topic font-mono">{question.topic}</span>
	</div>
	<p class="q-text">{question.question}</p>

	<div class="q-options">
		{#each question.options as opt, i (i)}
			<button
				class="q-option"
				class:selected={selectedAnswer === i}
				class:correct={showResult && i === question.correctIndex}
				class:wrong={showResult && selectedAnswer === i && i !== question.correctIndex}
				aria-pressed={selectedAnswer === i}
				disabled={showResult}
				onclick={() => {
					if (!showResult) onselectanswer(i);
				}}
			>
				<span class="q-opt-label font-mono">{String.fromCharCode(65 + i)}</span>
				<span class="q-opt-text">{opt}</span>
			</button>
		{/each}
	</div>

	<div class="q-actions">
		{#if !showResult}
			<button class="btn btn-primary" disabled={selectedAnswer === null} onclick={onsubmit}
				>check answer</button
			>
		{:else}
			<div class="q-feedback" role="status">
				<span class="q-fb-icon">{selectedAnswer === question.correctIndex ? '✓' : '✕'}</span>
				<span class="q-fb-text">
					{#if selectedAnswer === question.correctIndex}
						Correct!
					{:else}
						The correct answer was <strong>{question.options[question.correctIndex]}</strong>
					{/if}
				</span>
			</div>
			<div class="q-detail">
				<p class="q-explanation">{question.explanation}</p>
				<p class="q-source font-mono">Source: {citationLabel(question.source)}</p>
			</div>
			<button class="btn btn-primary" onclick={onnext}>
				{index < totalQuestions - 1 ? 'next question' : 'see results'}
			</button>
		{/if}
	</div>
</article>

<style>
	.quiz-progress {
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
		font-family: var(--font-body);
		font-size: 1.15rem;
		color: var(--ink);
		line-height: 1.4;
		margin: 0 0 1.5rem;
		font-weight: 600;
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
			border-color 0.12s var(--ease-out-quart),
			background 0.12s var(--ease-out-quart);
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
		border-color: var(--pen-red);
		background: rgba(194, 54, 42, 0.1);
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
</style>
