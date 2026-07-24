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

<div class="fc-progress font-mono">
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
		<div class="fc-face fc-face-front" aria-hidden={cardSide === 'back'}>
			<div class="fc-meta">
				<span class="fc-course font-mono">{currentCard.course}</span>
				<span class="fc-topic font-mono">{currentCard.topic}</span>
			</div>
			<div class="fc-body">
				<span class="fc-front">{currentCard.front}</span>
			</div>
			<span class="fc-hint font-mono">tap to flip</span>
		</div>
		<div class="fc-face fc-face-back" aria-hidden={cardSide === 'front'}>
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

<span class="fc-flip-status" role="status">
	{cardSide === 'back' ? 'Answer revealed' : ''}
</span>

<div class="fc-nav">
	<button class="btn btn-secondary btn-sm" disabled={cardIdx === 0} onclick={onprev}
		>← previous</button
	>
	<button class="btn btn-secondary btn-sm" disabled={cardIdx >= totalCards - 1} onclick={onnext}
		>next →</button
	>
</div>

<style>
	.fc-progress {
		font-size: 0.75rem;
		color: var(--ink-soft);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

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

	/* Grid stack (both faces in 1/1) instead of absolute inset:0 — the stage
	   grows with the tallest face, so long answers can no longer spill out. */
	.fc-face {
		grid-area: 1 / 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		min-height: 280px;
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
		font-family: var(--font-body);
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

	.fc-flip-status {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
