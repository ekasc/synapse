<section class="section section--problem" aria-labelledby="problem-heading">
	<div class="problem-top">
		<header class="problem-head">
			<span class="stamp" style="transform: rotate(-0.6deg);">the mess</span>
			<h2 id="problem-heading" class="problem-title font-hand">
				your data lives here. and here. and here.
			</h2>

			<div class="problem-body">
				<p>
					Each week looks like this on paper. Fragments in five different places, none of them
					talking to each other.
				</p>
				<p>The data exists. The connection doesn't.</p>
			</div>
		</header>
		<figure
			class="messy-page-wrap"
			aria-label="A torn notebook page showing the chaos of a typical week"
		>
			<div class="messy-page" style="transform: rotate(1.4deg);">
				<div class="coffee-ring" aria-hidden="true"></div>
				<div class="messy-grid">
					<div class="cal-block">
						<span class="cal-head font-hand">week 03</span>
						<div class="cal-grid">
							<span class="d">S</span><span class="d">M</span><span class="d">T</span><span
								class="d">W</span
							><span class="d">T</span><span class="d">F</span><span class="d">S</span>
							<span class="cell"></span><span class="cell"></span><span class="cell cross"
							></span><span class="cell"></span><span class="cell red"></span><span class="cell"
							></span><span class="cell"></span>
							<span class="cell"></span><span class="cell"></span><span class="cell"></span><span
								class="cell cross"
							></span><span class="cell red"></span><span class="cell"></span><span class="cell"
							></span>
							<span class="cell"></span><span class="cell"></span><span class="cell cross"
							></span><span class="cell"></span><span class="cell"></span><span class="cell"
							></span><span class="cell"></span>
						</div>
					</div>
					<div class="cal-legend font-mono" aria-hidden="true">
						<span><i class="dot red"></i> deadline</span>
						<span><i class="dot cross"></i> class</span>
					</div>
					<div class="scribble scribble-1" aria-hidden="true">math 1120</div>
					<div class="scribble scribble-2" aria-hidden="true">mar 24</div>
					<div
						class="sticky"
						style="transform: rotate(-3.4deg);"
						aria-label="A sticky note with a handwritten question"
					>
						<p>what's the<br />prereq for<br />CSIS 4495?</p>
					</div>
					<div
						class="todo font-mono"
						aria-label="A to-do list with three items crossed off and one circled in red"
					>
						<span class="todo-label font-hand">to-do</span>
						<span class="done">☐ read ch.4</span>
						<span class="done">☐ lab report</span>
						<span class="done">☐ email prof</span>
						<span class="red-circle">◯ study for midterm</span>
					</div>
				</div>
			</div>

			<svg
				class="margin-annotation margin-annotation--problem"
				viewBox="0 0 110 36"
				aria-hidden="true"
			>
				<g class="hand-arrow">
					<path d="M 2 18 C 30 14 70 14 100 18" />
					<path d="M 92 11 L 104 18 L 92 25" fill="none" />
				</g>
			</svg>
			<span class="margin-note margin-note--problem" aria-hidden="true">this. every week.</span>
		</figure>
	</div>
</section>

<style>
	.section--problem {
		padding-top: clamp(4rem, 7vw, 6rem);
	}

	.problem-top {
		display: grid;
		grid-template-columns: minmax(0, 42rem) minmax(18rem, 28rem);
		gap: clamp(2rem, 5vw, 5rem);
		align-items: end;
		max-width: 78rem;
		margin: 0 auto 3rem;
	}

	.problem-head {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		height: 100%;
		max-width: 44rem;
	}

	.problem-title {
		font-size: clamp(2rem, 3.4vw, 2.8rem);
		line-height: 1.1;
		margin: 0;
		color: var(--ink);
	}

	.messy-page-wrap {
		position: relative;
		width: min(100%, 40rem);
		margin: 0 auto;
	}

	.problem-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 28rem;
		flex-shrink: 0;
	}

	.problem-body p {
		font-size: clamp(1.2rem, 1.5vw, 1.4rem);
		line-height: 1.6;
		color: var(--ink);
		margin: 0;
	}

	.messy-page {
		position: relative;
		background: var(--surface-paper);
		border: 1px solid var(--border-faint);
		padding: 28px 32px 36px;
		min-height: 36rem;
		box-shadow:
			0 1px 0 var(--surface-paper) inset,
			0 6px 14px var(--shadow-ink);
	}

	.coffee-ring {
		position: absolute;
		top: 24px;
		left: 60px;
		width: 46px;
		height: 46px;
		border: 2px solid rgba(115, 70, 30, 0.16); /* decorative */
		border-radius: 50%;
		opacity: 0.5;
	}

	.messy-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 22px;
	}

	.cal-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.cal-head {
		font-family: var(--font-hand);
		font-size: 1.15rem;
		color: var(--ink);
		font-weight: 400;
	}

	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 5px;
		font-size: 0.72rem;
		color: var(--ink-soft);
	}

	.d {
		text-align: center;
		font-weight: 600;
		padding: 2px 0;
	}

	.cell {
		aspect-ratio: 1;
		border: 1px solid var(--border-faint);
		border-radius: 1px;
	}

	.cell.cross {
		background: rgba(26, 26, 23, 0.18);
	}

	.cell.red {
		background: var(--pen-red);
	}

	.cal-legend {
		display: flex;
		gap: 18px;
		font-size: 0.72rem;
		color: var(--ink-soft);
		margin-top: 4px;
	}

	.cal-legend i {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 6px;
		vertical-align: middle;
	}

	.dot.red {
		background: var(--pen-red);
	}

	.dot.cross {
		background: rgba(26, 26, 23, 0.4);
	}

	.scribble {
		position: absolute;
		font-family: var(--font-hand);
		font-size: 1.3rem;
		color: var(--ink);
		opacity: 0.4;
	}

	.scribble-1 {
		top: 250px;
		right: 24px;
		transform: rotate(-4deg);
	}

	.scribble-2 {
		top: 300px;
		left: 32px;
		transform: rotate(2deg);
	}

	.sticky {
		position: absolute;
		top: 50px;
		right: 32px;
		background: var(--highlight-soft);
		padding: 12px 14px;
		font-family: var(--font-hand);
		font-size: 1.1rem;
		line-height: 1.2;
		box-shadow:
			0 1px 0 var(--surface-paper) inset,
			0 2px 6px var(--shadow-ink);
		color: var(--ink);
		max-width: 8rem;
	}

	.todo {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 0.92rem;
		margin-top: 32px;
		padding-left: 4px;
	}

	.todo .todo-label {
		font-family: var(--font-hand);
		font-size: 1.15rem;
		color: var(--ink);
		margin-bottom: 8px;
		display: block;
	}

	.todo span:not(.todo-label) {
		color: var(--ink);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.todo .done {
		text-decoration: line-through;
		color: var(--ink-soft);
		opacity: 0.55;
	}

	.todo .red-circle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1.5px solid var(--pen-red);
		border-radius: 999px; /* decorative */
		padding: 3px 14px 3px 10px;
		color: var(--pen-red);
		width: fit-content;
		font-weight: 500;
	}

	.margin-annotation--problem {
		position: absolute;
		left: 7.25rem;
		top: 5.4rem;
		width: 110px;
		height: 36px;
	}

	.margin-note--problem {
		position: absolute;
		left: 1rem;
		top: 4.5rem;
		font-size: 1.4rem;
		transform: rotate(-6deg);
		color: var(--pen-red);
		max-width: 7rem;
		line-height: 1.15;
	}

	@media (max-width: 768px) {
		.problem-top {
			grid-template-columns: 1fr;
			gap: 2rem;
			align-items: start;
		}

		.problem-body {
			max-width: none;
		}
	}

	@media (max-width: 640px) {
		.margin-note--problem {
			position: static;
			transform: rotate(-3deg);
			font-size: 1.2rem;
			margin-top: 1rem;
			max-width: none;
		}

		.margin-annotation--problem {
			display: none;
		}

		.messy-page {
			padding: 20px 18px 28px;
		}
	}
</style>
