<script lang="ts">
	type MaterialSource = {
		materialId: string;
		fileName: string;
		pageStart?: number;
		pageEnd?: number;
	};

	type Flashcard = {
		id: string;
		course: string;
		topic: string;
		front: string;
		back: string;
		source: MaterialSource;
	};

	let {
		currentCard,
		cardIdx = 0,
		totalCards,
		cardSide = 'front',
		onflip,
		onprev,
		onnext
	}: {
		currentCard: Flashcard;
		cardIdx?: number;
		totalCards: number;
		cardSide?: 'front' | 'back';
		onflip: () => void;
		onprev: () => void;
		onnext: () => void;
	} = $props();

	function citationLabel(source: MaterialSource) {
		if (source.pageStart == null) return source.fileName;
		if (source.pageEnd != null && source.pageEnd !== source.pageStart) {
			return `${source.fileName}, pages ${source.pageStart}–${source.pageEnd}`;
		}
		return `${source.fileName}, page ${source.pageStart}`;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onflip();
		}
	}
</script>

<div class="mb-3 text-xs text-[var(--ink-soft)]">
	{cardIdx + 1} of {totalCards}
</div>

<div
	class="fc-stage"
	onclick={onflip}
	onkeydown={handleKeydown}
	role="button"
	tabindex="0"
	aria-label={cardSide === 'front'
		? 'Question side — flip to reveal the answer'
		: 'Answer side — flip to show the question'}
>
	<div class="fc-flipper" class:fc-flipped={cardSide === 'back'}>
		<div class="fc-face" aria-hidden={cardSide === 'back'}>
			<div class="flex gap-[0.85rem]">
				<span class=" text-xs text-[var(--ink-soft)]">{currentCard.course}</span>
				<span class=" text-xs text-[var(--ink-soft)]">{currentCard.topic}</span>
			</div>
			<div class="flex flex-1 items-center justify-center">
				<span
					class="[font-family:var(--font-body)] text-[2rem] leading-[1.1] font-semibold tracking-[-0.01em] text-[var(--ink)]"
					>{currentCard.front}</span
				>
			</div>
			<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">tap to flip</span>
		</div>
		<div class="fc-face fc-face-back" aria-hidden={cardSide === 'front'}>
			<div class="flex gap-[0.85rem]">
				<span class=" text-xs text-[var(--ink-soft)]">{currentCard.course}</span>
				<span class=" text-xs text-[var(--ink-soft)]">{currentCard.topic}</span>
			</div>
			<div class="flex flex-1 items-center justify-center">
				<span class="max-w-[500px] text-base leading-6 text-[var(--ink)]">{currentCard.back}</span>
			</div>
			<span class=" tracking-[0.1em] text-[var(--ink-faint)] text-[var(--text-caption)]"
				>Source: {citationLabel(currentCard.source)}</span
			>
		</div>
	</div>
</div>

<span class="sr-only" role="status">
	{cardSide === 'back' ? 'Answer revealed' : ''}
</span>

<div class="mt-4 flex justify-between gap-3">
	<button class="btn btn-secondary btn-sm" disabled={cardIdx === 0} onclick={onprev}
		>← previous</button
	>
	<button class="btn btn-secondary btn-sm" disabled={cardIdx >= totalCards - 1} onclick={onnext}
		>next →</button
	>
</div>

<style>
	.fc-stage {
		width: 100%;
		perspective: 1200px;
		cursor: pointer;
		font-family: var(--font-body);
	}

	.fc-flipper {
		display: grid;
		width: 100%;
		transition: transform 0.55s var(--ease-out-quart);
		transform-style: preserve-3d;
	}

	.fc-flipper.fc-flipped {
		transform: rotateY(180deg);
	}

	/* The grid stack lets the stage grow with its tallest face. */
	.fc-face {
		grid-area: 1 / 1;
		display: flex;
		min-height: 280px;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 2rem 1.5rem 1.5rem;
		border: 1px solid var(--rule);
		background: var(--paper);
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
</style>
