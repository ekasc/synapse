<script lang="ts">
	type Query = {
		q: string;
		a: string;
		detail: string;
	};

	const queries: Query[] = [
		{
			q: "what's the earliest i can take the capstone?",
			a: 'check the course map for its prerequisite path.',
			detail:
				'See which courses unlock it, then compare possible semester plans before you move anything.'
		},
		{
			q: 'what do i need on the final?',
			a: 'use grade analytics to model the outcome.',
			detail: 'Enter the current marks and grade weights to explore final-grade scenarios.'
		},
		{
			q: "when's my next deadline?",
			a: 'open the calendar or weekly plan.',
			detail: 'Both bring deadlines from your active courses into one place.'
		}
	];

	let queryIndex = $state(0);
	let showAnswer = $state(false);

	$effect(() => {
		const t = setTimeout(() => (showAnswer = true), 1400);
		return () => clearTimeout(t);
	});

	function tryAnother() {
		showAnswer = false;
		setTimeout(() => {
			queryIndex = (queryIndex + 1) % queries.length;
			showAnswer = true;
		}, 900);
	}
</script>

<section class="section section--query" aria-labelledby="query-heading">
	<header class="query-head">
		<span class="stamp" style="transform: rotate(-0.6deg);">ask</span>
		<h2 id="query-heading" class="query-title font-hand">
			your degree, <span class="highlighter">queryable</span>.
		</h2>
		<p class="query-sub font-body">
			Ask the academic assistant, or jump straight into the course map, calendar, and grade tools.
		</p>
	</header>

	<div class="query-spread">
		<div class="query-card">
			<div class="query-input">
				<span class="query-prefix" aria-hidden="true">→</span>
				<p class="query-text font-body" aria-live="polite">{queries[queryIndex].q}</p>
			</div>

			{#if !showAnswer}
				<div class="query-thinking" aria-live="polite">
					<span class="query-dot"></span>
					<span class="query-dot"></span>
					<span class="query-dot"></span>
					<span class="query-thinking-text font-hand">querying the graph…</span>
				</div>
			{:else}
				<div class="query-answer">
					<p class="query-result font-hand">{queries[queryIndex].a}</p>
					<p class="query-detail font-body">{queries[queryIndex].detail}</p>
				</div>
			{/if}

			<button type="button" class="query-try-again font-hand" onclick={tryAnother}>
				try another question →
			</button>
		</div>
	</div>

	<aside class="query-graphics" aria-label="available Synapse tools">
		<div class="query-mini query-mini-deadline">
			<div class="query-mini-header font-hand">calendar</div>
			<p class="query-mini-main font-hand">one deadline view</p>
			<p class="query-mini-detail font-body">see due work across active courses</p>
		</div>

		<div class="query-mini query-mini-grade">
			<div class="query-mini-header font-hand">grade analytics</div>
			<p class="query-mini-main font-hand">model outcomes</p>
			<p class="query-mini-detail font-body">see how assessments affect a course grade</p>
			<div class="query-mini-bar" aria-hidden="true">
				<div class="query-mini-bar-fill" style="width: 72%"></div>
			</div>
		</div>

		<div class="query-mini query-mini-hours">
			<div class="query-mini-header font-hand">practice + timer</div>
			<p class="query-mini-main font-hand">build momentum</p>
			<p class="query-mini-detail font-body">study from course materials and track the time</p>
		</div>
	</aside>
</section>

<style>
	.section--query {
		padding-top: clamp(4rem, 7vw, 6rem);
		position: relative;
	}

	.query-head {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2.5rem;
		max-width: 38rem;
	}

	.query-title {
		font-size: clamp(2rem, 3.4vw, 2.8rem);
		line-height: 1.1;
		margin: 0;
		color: var(--ink);
	}

	.query-sub {
		font-size: clamp(1.05rem, 1.3vw, 1.2rem);
		line-height: 1.5;
		margin: 0;
		color: var(--ink-soft);
	}

	.query-card {
		max-width: 38rem;
		background: var(--surface-paper);
		border: 1.5px solid var(--ink);
		border-radius: 4px;
		padding: 1.75rem 2rem 1.25rem;
		box-shadow:
			0 1px 0 var(--surface-paper) inset,
			0 3px 14px var(--shadow-ink);
	}

	.query-spread {
		display: block;
	}

	.query-graphics {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		position: absolute;
		right: clamp(1.5rem, 4vw, 3.5rem);
		top: 50%;
		transform: translateY(-50%);
		width: 16rem;
	}

	.query-mini {
		background: var(--surface-paper);
		border: 1.5px solid var(--ink);
		border-radius: 4px;
		padding: 1rem 1.25rem;
		box-shadow: 0 3px 10px var(--shadow-ink);
	}

	.query-mini-deadline {
		transform: rotate(-1.1deg);
	}

	.query-mini-grade {
		transform: rotate(0.6deg);
		margin-left: 0.5rem;
	}

	.query-mini-hours {
		transform: rotate(-0.4deg);
	}

	.query-mini-header {
		font-size: 0.92rem;
		color: var(--ink-soft);
		margin-bottom: 0.4rem;
	}

	.query-mini-main {
		font-size: 1.5rem;
		line-height: 1.15;
		margin: 0 0 0.35rem;
		color: var(--ink);
	}

	.query-mini-detail {
		font-size: 0.92rem;
		line-height: 1.4;
		margin: 0;
		color: var(--ink-soft);
	}

	.query-mini-bar {
		height: 5px;
		background: rgba(26, 26, 23, 0.08);
		border-radius: 999px; /* decorative */
		overflow: hidden;
		margin-top: 0.6rem;
	}

	.query-mini-bar-fill {
		height: 100%;
		background: var(--ink);
		border-radius: 999px; /* decorative */
	}

	@media (max-width: 1024px) {
		.query-spread {
			grid-template-columns: 1fr;
		}

		.query-graphics {
			flex-direction: row;
			flex-wrap: wrap;
			padding-top: 0;
		}

		.query-mini {
			flex: 1 1 12rem;
		}
	}

	.query-input {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding-bottom: 1.25rem;
	}

	.query-prefix {
		font-family: var(--font-body);
		font-size: 1.15rem;
		font-weight: 500;
		color: var(--ink-soft);
		line-height: 1.5;
		flex-shrink: 0;
	}

	.query-text {
		font-size: clamp(1.1rem, 1.35vw, 1.3rem);
		line-height: 1.5;
		margin: 0;
		color: var(--ink);
	}

	.query-thinking {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 1rem 0 1.25rem;
		border-top: 1px dashed var(--border-faint);
	}

	.query-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ink-soft);
		animation: query-pulse 1.2s ease-in-out infinite;
	}

	.query-dot:nth-child(2) {
		animation-delay: 0.18s;
	}

	.query-dot:nth-child(3) {
		animation-delay: 0.36s;
	}

	@keyframes query-pulse {
		0%,
		100% {
			opacity: 0.25;
			transform: scale(0.85);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}

	.query-thinking-text {
		margin-left: 0.5rem;
		font-size: 1rem;
		color: var(--ink-soft);
	}

	.query-answer {
		padding: 1.1rem 0 1.25rem;
		border-top: 1px dashed var(--border-faint);
		animation: query-fade 0.5s ease;
	}

	@keyframes query-fade {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.query-result {
		font-size: clamp(1.4rem, 1.8vw, 1.65rem);
		line-height: 1.3;
		margin: 0 0 0.6rem;
		color: var(--ink);
	}

	.query-detail {
		font-size: clamp(0.98rem, 1.15vw, 1.08rem);
		line-height: 1.55;
		margin: 0;
		color: var(--ink-soft);
	}

	.query-try-again {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.85rem 0 0;
		margin-top: 0.25rem;
		background: transparent;
		border: none;
		border-top: 1px dashed var(--border-faint);
		font-size: 1rem;
		color: var(--ink);
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.query-try-again:hover {
		color: var(--ink-soft);
	}
</style>
