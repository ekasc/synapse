<script lang="ts">
	type MaterialSource = {
		materialId: string;
		fileName: string;
		pageStart?: number;
		pageEnd?: number;
	};

	type Question = {
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

<div class="mb-3 text-xs text-[var(--ink-soft)]">
	question {index + 1} of {totalQuestions}
</div>

<article class="surface-polaroid px-6 pt-6 pb-7">
	<div class="mb-4 flex gap-[0.85rem] border-b border-[var(--rule)] pb-[0.65rem]">
		<span class=" text-xs text-[var(--ink-soft)]">{question.course}</span>
		<span class=" text-xs text-[var(--ink-soft)]">{question.topic}</span>
	</div>
	<p
		class="mt-0 mb-6 [font-family:var(--font-body)] text-[1.15rem] leading-[1.4] font-semibold text-[var(--ink)]"
	>
		{question.question}
	</p>

	<div class="mb-6 flex flex-col gap-2">
		{#each question.options as opt, i (i)}
			<button
				class="flex cursor-pointer items-center gap-[0.85rem] border border-[var(--rule)] bg-[var(--paper)] px-[0.95rem] py-[0.7rem] text-left [font-family:var(--font-body)] transition-[border-color,background] duration-[120ms] hover:not-disabled:border-[var(--ink)] disabled:cursor-default {selectedAnswer ===
				i
					? 'border-[var(--ink)] bg-[var(--paper-shelf)]'
					: ''} {showResult && i === question.correctIndex
					? 'border-[var(--ok)] bg-[rgba(90,122,74,0.12)]'
					: ''} {showResult && selectedAnswer === i && i !== question.correctIndex
					? 'border-[var(--pen-red)] bg-[rgba(194,54,42,0.1)]'
					: ''}"
				aria-pressed={selectedAnswer === i}
				disabled={showResult}
				onclick={() => {
					if (!showResult) onselectanswer(i);
				}}
			>
				<span class="w-[1.2rem] shrink-0 text-xs tracking-[0.1em] text-[var(--ink-faint)]"
					>{String.fromCharCode(65 + i)}</span
				>
				<span class="text-[var(--ink)] text-[var(--text-small)]">{opt}</span>
			</button>
		{/each}
	</div>

	<div class="flex flex-col items-start gap-3">
		{#if !showResult}
			<button class="btn btn-primary" disabled={selectedAnswer === null} onclick={onsubmit}
				>check answer</button
			>
		{:else}
			<div
				class="flex items-center gap-2 border border-[var(--rule)] bg-[var(--paper-shelf)] px-[0.85rem] py-[0.6rem]"
				role="status"
			>
				<span class="q-feedback text-[1.1rem] font-semibold text-[var(--ink)]"
					>{selectedAnswer === question.correctIndex ? '✓' : '✕'}</span
				>
				<span class="text-[var(--ink)] text-[var(--text-small)]">
					{#if selectedAnswer === question.correctIndex}
						Correct!
					{:else}
						The correct answer was <strong>{question.options[question.correctIndex]}</strong>
					{/if}
				</span>
			</div>
			<div class="flex flex-col gap-[0.35rem]">
				<p class="m-0 leading-[1.45] text-[var(--ink)] text-[var(--text-small)]">
					{question.explanation}
				</p>
				<p class="m-0 tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]">
					Source: {citationLabel(question.source)}
				</p>
			</div>
			<button class="btn btn-primary" onclick={onnext}>
				{index < totalQuestions - 1 ? 'next question' : 'see results'}
			</button>
		{/if}
	</div>
</article>

<style>
	.q-feedback {
		animation: q-feedback 0.4s var(--ease-out-quart) both;
	}

	@keyframes q-feedback {
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
