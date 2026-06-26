<script lang="ts">
	type Week = {
		stamp: string;
		entry: string;
		data: string;
	};

	const weeks: Week[] = [
		{
			stamp: 'week 01',
			entry: 'syllabus uploaded: CSIS 4495',
			data: 'extracted: 14 deadlines, 4 weights'
		},
		{
			stamp: 'week 02',
			entry: 'first grade: 88/100',
			data: 'tagged: COMP 1110 · quiz 1'
		},
		{
			stamp: 'week 03',
			entry: 'studied 4.5h',
			data: 'synapse flagged: midterm in 3 weeks, 84% ready'
		},
		{
			stamp: 'week 04',
			entry: 'midterm: 76/100',
			data: 'running 81.2% · if project = 85%, final needs 50% for an A'
		},
		{
			stamp: 'week 05',
			entry: 'studied 7h · reviewed: heap sort vs merge sort',
			data: 'tagged: COMP 1110'
		},
		{
			stamp: 'week 06',
			entry: 'graph: 3 courses, 2 prereqs, 14 deadlines, 24h studied',
			data: "fall '25 closed · spring '26 starts"
		}
	];

	let whatIf = $state(false);

	type Query = {
		q: string;
		a: string;
		detail: string;
	};

	const queries: Query[] = [
		{
			q: "what's the earliest i can take the capstone?",
			a: "spring '27. you finish every prereq by fall '26.",
			detail: "algorithms and discrete structures both unlock it. you take those in fall '26."
		},
		{
			q: 'which course has the most homework?',
			a: 'world history. four assignments due this month.',
			detail: 'mostly reading responses. the median across your courses is two.'
		},
		{
			q: "when's my next deadline?",
			a: 'tuesday. econ 2200 problem set, 11:59 pm.',
			detail: 'three more this week: stats homework thursday, capstone draft friday.'
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

<svelte:head>
	<title>synapse · vol. 01</title>
	<meta
		name="description"
		content="A notebook for your degree. Every course, grade, and deadline on one connected page."
	/>
</svelte:head>

<main class="paper">
	<!-- ==================== SECTION 1 · COVER ==================== -->
	<section class="section section--cover" aria-labelledby="cover-heading">
		<div class="cover-page">
			<div class="cover-top">
				<span class="stamp" style="transform: rotate(2.4deg);">fall '25 → spring '27</span>
			</div>

			<div class="cover-grid">
				<div class="cover-left">
					<h1 id="cover-heading" class="cover-title font-hand">
						<span class="highlighter">synapse</span>
					</h1>
					<p class="cover-sub">
						A notebook for your degree — every course, grade, and deadline, on one connected page.
					</p>
					<a href="/app" class="cover-cta">
						<span class="cta-label">open your notebook</span>
						<svg class="cta-arrow" viewBox="0 0 40 20" aria-hidden="true">
							<path
								d="M 4 10 L 34 10"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linecap="round"
							/>
							<path
								d="M 26 4 L 34 10 L 26 16"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</a>
				</div>

				<div class="cover-right">
					<figure class="mini-graph polaroid" style="transform: rotate(-1.6deg);">
						<svg
							class="mini-graph-svg"
							viewBox="0 35 330 115"
							role="img"
							aria-labelledby="mini-graph-title mini-graph-desc"
						>
							<title id="mini-graph-title">Mini degree graph</title>
							<desc id="mini-graph-desc">
								A small hand-traced course graph with five nodes and six edges.
							</desc>
							<g class="edges">
								<path
									d="M 60 100 Q 100 60 140 70"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									stroke-linecap="round"
								/>
								<path
									d="M 140 70 L 220 70"
									stroke="var(--highlight)"
									stroke-width="4"
									stroke-linecap="round"
									fill="none"
									opacity="0.85"
								/>
								<path
									d="M 60 100 L 140 130"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									stroke-linecap="round"
								/>
								<path
									d="M 140 130 L 220 130"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									stroke-linecap="round"
								/>
								<path
									d="M 220 70 L 220 130"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									stroke-linecap="round"
								/>
								<path
									d="M 220 100 Q 270 100 300 60"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									stroke-linecap="round"
								/>
							</g>
							<g class="nodes" font-family="Inter, sans-serif" font-size="10" fill="var(--ink)">
								<g transform="translate(34 88)">
									<rect
										x="0"
										y="0"
										width="52"
										height="24"
										fill="var(--surface-paper)"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="26" y="15" text-anchor="middle">CS 101</text>
								</g>
								<g transform="translate(114 58)">
									<rect
										x="0"
										y="0"
										width="52"
										height="24"
										fill="var(--surface-paper)"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="26" y="15" text-anchor="middle">MATH 110</text>
								</g>
								<g transform="translate(114 118)">
									<rect
										x="0"
										y="0"
										width="52"
										height="24"
										fill="var(--surface-paper)"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="26" y="15" text-anchor="middle">CS 201</text>
								</g>
								<g transform="translate(198 58)">
									<rect
										x="0"
										y="0"
										width="52"
										height="24"
										fill="var(--surface-paper)"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="26" y="15" text-anchor="middle">CS 301</text>
								</g>
								<g transform="translate(198 118)">
									<rect
										x="0"
										y="0"
										width="52"
										height="24"
										fill="var(--surface-paper)"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="26" y="15" text-anchor="middle">CS 302</text>
								</g>
								<g transform="translate(272 46)">
									<rect
										x="0"
										y="0"
										width="52"
										height="24"
										fill="var(--surface-paper)"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="26" y="15" text-anchor="middle">CAP</text>
								</g>
							</g>
						</svg>
					</figure>

					<div class="cover-spark font-mono" aria-hidden="true">
						<svg viewBox="0 0 200 40" class="sparkline">
							<path
								d="M 4 30 L 24 26 L 44 28 L 64 18 L 84 22 L 104 14 L 124 16 L 144 10 L 164 12 L 184 6"
								fill="none"
								stroke="var(--ink)"
								stroke-width="1.4"
								stroke-linecap="round"
							/>
							<circle cx="184" cy="6" r="3" fill="var(--ink)" />
						</svg>
						<span class="sparkline-caption">gpa 3.7 · prereqs 8/9</span>
					</div>
				</div>
			</div>

			<svg
				class="cover-arrow"
				viewBox="0 0 60 80"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g class="hand-arrow" transform="rotate(-4 30 40)">
					<path d="M 30 4 Q 36 30 30 60" />
					<path d="M 24 54 L 30 64 L 36 54" fill="none" />
					<circle class="head" cx="30" cy="64" r="2.6" />
				</g>
			</svg>
		</div>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 2 · THE PROBLEM ==================== -->
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

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 3 · THE TRANSFORMATION ==================== -->
	<section class="section section--transform" aria-labelledby="transform-heading">
		<header class="transform-head">
			<span class="stamp" style="transform: rotate(-1deg);">field note · the mechanism</span>
			<h2 id="transform-heading" class="transform-title font-hand">
				<span class="highlighter-soft">upload</span> a syllabus. every deadline, weight, and date
				<span class="highlighter">extracts</span> on its own.
			</h2>
		</header>

		<div class="transform-spread">
			<figure class="syllabus-doc polaroid" style="transform: rotate(-1deg);">
				<div class="doc-stamp font-mono">syllabus</div>
				<div class="doc-body">
					<div class="doc-row">
						<span class="doc-label font-mono">course</span>
						<span class="doc-value font-body">Capstone Project</span>
					</div>
					<div class="doc-row">
						<span class="doc-label font-mono">meetings</span>
						<span class="doc-value font-body">TR 2:00–3:30 · Rm 304</span>
					</div>
					<div class="doc-row">
						<span class="doc-label font-mono">grading</span>
						<span class="doc-value font-body">proposal 40% · midterm 30% · final 30%</span>
					</div>
					<div class="doc-row">
						<span class="doc-label font-mono">deadlines</span>
						<span class="doc-value font-body">
							jan 28 proposal · feb 18 draft · mar 24 midterm · apr 30 final
						</span>
					</div>
					<div class="doc-row">
						<span class="doc-label font-mono">prereq</span>
						<span class="doc-value font-body">CSIS 3100 with C or better</span>
					</div>
					<div class="doc-row scribbled">
						<span class="doc-label font-mono">notes</span>
						<span class="doc-value font-hand">teams of 3 — ok by prof</span>
					</div>
				</div>
			</figure>

			<svg class="extract-arrow" viewBox="0 0 120 60" aria-hidden="true">
				<g class="hand-arrow" transform="translate(0 30)">
					<path d="M 4 0 Q 50 -6 96 0" />
					<circle class="head" cx="98" cy="0" r="2.6" />
				</g>
				<text
					x="60"
					y="50"
					text-anchor="middle"
					font-family="var(--font-hand)"
					font-size="28"
					fill="var(--ink-soft)">extract</text
				>
			</svg>

			<figure class="extracted-card" style="transform: rotate(0.8deg);">
				<div class="ext-head font-mono">csis 4495 · structured</div>
				<dl class="ext-data font-mono">
					<div class="ext-row">
						<dt>code</dt>
						<dd>CSIS 4495</dd>
					</div>
					<div class="ext-row">
						<dt>title</dt>
						<dd>Capstone Project</dd>
					</div>
					<div class="ext-row">
						<dt>term</dt>
						<dd>spring '26</dd>
					</div>
					<div class="ext-row">
						<dt>weights</dt>
						<dd>
							proposal <b>40%</b> · midterm <b>30%</b> · final <b>30%</b>
						</dd>
					</div>
					<div class="ext-row">
						<dt>deadlines</dt>
						<dd>
							<ul class="ext-list">
								<li><span>jan 28</span> proposal</li>
								<li><span>feb 18</span> draft</li>
								<li class="hl"><span>mar 24</span> midterm</li>
								<li><span>apr 30</span> final</li>
							</ul>
						</dd>
					</div>
					<div class="ext-row">
						<dt>prereq</dt>
						<dd>CSIS 3100 (C+)</dd>
					</div>
				</dl>
			</figure>
		</div>

		<p class="transform-body">
			The structure is the point. Once the data has shape — course, date, weight, prereq — it can
			answer questions across semesters. What was scattered across five places is now queryable in
			one.
		</p>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 4 · THE QUERY ==================== -->
	<section class="section section--query" aria-labelledby="query-heading">
		<header class="query-head">
			<span class="stamp" style="transform: rotate(-0.6deg);">ask</span>
			<h2 id="query-heading" class="query-title font-hand">
				your degree, <span class="highlighter">queryable</span>.
			</h2>
			<p class="query-sub font-body">ask in plain english. synapse answers from your graph.</p>
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

		<aside class="query-graphics" aria-label="what synapse knows">
			<div class="query-mini query-mini-deadline">
				<div class="query-mini-header font-hand">next deadline</div>
				<p class="query-mini-main font-hand">tuesday</p>
				<p class="query-mini-detail font-body">econ 2200 problem set · 11:59 pm</p>
			</div>

			<div class="query-mini query-mini-grade">
				<div class="query-mini-header font-hand">latest grade</div>
				<p class="query-mini-main font-hand">88 / 100</p>
				<p class="query-mini-detail font-body">statistics · quiz 4</p>
				<div class="query-mini-bar" aria-hidden="true">
					<div class="query-mini-bar-fill" style="width: 88%"></div>
				</div>
			</div>

			<div class="query-mini query-mini-hours">
				<div class="query-mini-header font-hand">this week</div>
				<p class="query-mini-main font-hand">14 hrs studied</p>
				<p class="query-mini-detail font-body">up from 9 last week</p>
			</div>
		</aside>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 5 · THE TIMELINE ==================== -->
	<section class="section section--timeline" aria-labelledby="timeline-heading">
		<header class="timeline-head">
			<span class="stamp" style="transform: rotate(-0.8deg);">the log</span>
			<h2 id="timeline-heading" class="timeline-title font-hand">
				data enters <span class="highlighter">week by week</span>. the graph builds itself.
			</h2>
		</header>

		<div class="timeline-spread">
			<ol class="weeks">
				{#each weeks as w (w.stamp)}
					<li class="week">
						<div class="week-meta">
							<span class="stamp" style="transform: rotate(-1.2deg);">{w.stamp}</span>
						</div>
						<p class="week-entry font-hand">{w.entry}</p>
						<p class="week-data font-body">{w.data}</p>
					</li>
				{/each}
			</ol>
			<aside class="timeline-index" aria-label="Week index">
				<span class="stamp" style="transform: rotate(-2.4deg);">the log</span>
				<ol class="week-index font-mono">
					<li>week 01</li>
					<li>week 02</li>
					<li>week 03</li>
					<li>week 04</li>
					<li>week 05</li>
					<li>week 06</li>
				</ol>
				<p class="timeline-note font-hand">six weeks.<br />one graph.</p>
			</aside>
		</div>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== CLOSING CTA ==================== -->
	<section class="section section--cta" aria-labelledby="cta-heading">
		<h2 id="cta-heading" class="cta-title font-hand">
			your degree is <span class="highlighter">one graph</span>, not four semesters
		</h2>
		<a href="/app" class="cta-button"> open your notebook → </a>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== FOOTER ==================== -->
	<footer class="footer" aria-label="Colophon">
		<div class="footer-grid">
			<div class="footer-brand font-hand">synapse · vol. 01</div>
			<p class="footer-copy font-body">
				© 2026 · built for students who take their education seriously
			</p>
		</div>
	</footer>
</main>

<style>
	/* ============================================================
	   GLOBAL / RESET
	   ============================================================ */
	:global(body) {
		background: var(--paper);
	}

	

	/* ============================================================
	   SECTION SCAFFOLD
	   ============================================================ */
	.section {
		position: relative;
		max-width: 84rem;
		margin: 0 auto;
		padding: clamp(3.5rem, 7vw, 6rem) clamp(1.5rem, 4vw, 4rem);
	}

	/* ============================================================
	   SECTION 1 · COVER
	   ============================================================ */
	.cover-page {
		position: relative;
		padding-top: 0.5rem;
	}

	.cover-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
	}

	.cover-grid {
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: clamp(2rem, 5vw, 4rem);
		align-items: start;
	}

	.cover-title {
		font-size: clamp(3.6rem, 8vw, 6rem);
		margin: 0 0 1.5rem;
		color: var(--ink);
		letter-spacing: -0.01em;
	}

	.cover-sub {
		font-size: clamp(1.2rem, 1.4vw, 1.5rem);
		line-height: 1.55;
		color: var(--ink-soft);
		max-width: 32ch;
		margin: 0;
	}

	.cover-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.mini-graph {
		padding: 14px 14px 18px;
		max-width: 100%;
		width: 100%;
	}

	.mini-graph-svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.mini-graph figcaption {
		margin-top: 10px;
		text-align: center;
		font-size: 0.9rem;
		color: var(--ink-soft);
		letter-spacing: 0.04em;
	}

	.cover-spark {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		width: 100%;
	}

	.sparkline {
		width: 100%;
		height: auto;
		display: block;
	}

	.sparkline-caption {
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		color: var(--ink-soft);
		align-self: flex-end;
	}

	.cover-arrow {
		position: absolute;
		left: 4rem;
		bottom: -2rem;
		width: 36px;
		height: 56px;
	}

	.cover-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 2.5rem;
		padding: 0.9rem 1.8rem 0.9rem 2rem;
		background: transparent;
		color: var(--ink);
		text-decoration: none;
		border: 1.5px solid var(--ink);
		border-radius: 2px;
		font-family: var(--font-body);
		font-size: 1.15rem;
		font-weight: 500;
		transition:
			background 150ms ease-out,
			transform 150ms ease-out;
	}

	.cover-cta:hover {
		background: var(--highlight);
		transform: translateY(-1px);
	}

	.cover-cta:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.cover-cta:active {
		transform: translateY(0);
	}

	.cta-arrow {
		width: 28px;
		height: 14px;
	}

	/* ============================================================
	   SECTION 2 · THE PROBLEM
	   ============================================================ */
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

	.messy-page {
		position: relative;
		background: var(--surface-paper);
		border: 1px solid rgba(26, 26, 23, 0.18);
		padding: 28px 32px 36px;
		min-height: 36rem;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.6) inset,
			0 6px 14px rgba(26, 26, 23, 0.1);
	}

	.coffee-ring {
		position: absolute;
		top: 24px;
		left: 60px;
		width: 46px;
		height: 46px;
		border: 2px solid rgba(115, 70, 30, 0.16);
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
		border: 1px solid rgba(26, 26, 23, 0.1);
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
			0 1px 0 rgba(255, 255, 255, 0.5) inset,
			0 2px 6px rgba(26, 26, 23, 0.12);
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
		border-radius: 999px;
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

	/* ============================================================
	   SECTION 3 · THE TRANSFORMATION
	   ============================================================ */
	.section--transform {
		padding-top: clamp(4rem, 7vw, 6rem);
	}

	.transform-head {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 3rem;
		max-width: 48rem;
	}

	.transform-title {
		font-size: clamp(2.4rem, 4.4vw, 3.6rem);
		margin: 0;
		line-height: 1.05;
		color: var(--ink);
		letter-spacing: -0.005em;
	}

	.transform-spread {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: clamp(1.5rem, 3vw, 2.5rem);
		align-items: center;
		margin-bottom: 3rem;
	}

	.syllabus-doc {
		padding: 22px 26px 28px;
		max-width: 36rem;
		justify-self: end;
		width: 100%;
	}

	.doc-stamp {
		font-family: var(--font-hand);
		font-size: 1.05rem;
		color: var(--ink-soft);
		margin-bottom: 14px;
		padding-bottom: 8px;
		border-bottom: 1px dashed var(--ink-faint);
	}

	.doc-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.doc-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 12px;
		align-items: baseline;
	}

	.doc-label {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink-soft);
	}

	.doc-value {
		font-size: 1.0625rem;
		color: var(--ink);
	}

	.doc-row.scribbled .doc-value {
		color: var(--ink-soft);
	}

	.extract-arrow {
		width: 80px;
		height: 60px;
		justify-self: center;
	}

	.extracted-card {
		background: var(--surface-paper);
		border: 1px solid var(--ink);
		padding: 22px 26px 28px;
		max-width: 36rem;
		width: 100%;
		justify-self: start;
		box-shadow: 2px 2px 0 var(--ink);
	}

	.ext-head {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink);
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--ink);
	}

	.ext-data {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
	}

	.ext-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 12px;
		align-items: baseline;
	}

	.ext-row dt {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink-soft);
	}

	.ext-row dd {
		margin: 0;
		font-size: 1rem;
		color: var(--ink);
	}

	.ext-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ext-list li {
		display: flex;
		gap: 10px;
		font-size: 1rem;
	}

	.ext-list li span {
		color: var(--ink-soft);
		min-width: 5rem;
	}

	.ext-list li.hl {
		background: var(--highlight);
		mix-blend-mode: multiply;
		padding: 3px 6px;
		margin: 0 -6px;
	}

	.transform-body {
		font-size: clamp(1.2rem, 1.5vw, 1.4rem);
		line-height: 1.6;
		color: var(--ink);
		max-width: 42rem;
		margin: 0;
	}

	/* ============================================================
	   SECTION 4 · THE QUERY
	   ============================================================ */
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
			0 1px 0 rgba(255, 255, 255, 0.6) inset,
			0 3px 14px rgba(26, 26, 23, 0.08);
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
		box-shadow: 0 3px 10px rgba(26, 26, 23, 0.06);
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
		border-radius: 999px;
		overflow: hidden;
		margin-top: 0.6rem;
	}

	.query-mini-bar-fill {
		height: 100%;
		background: var(--ink);
		border-radius: 999px;
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
		border-top: 1px dashed rgba(26, 26, 23, 0.2);
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
		border-top: 1px dashed rgba(26, 26, 23, 0.2);
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
		border-top: 1px dashed rgba(26, 26, 23, 0.2);
		font-size: 1rem;
		color: var(--ink);
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.query-try-again:hover {
		color: var(--ink-soft);
	}

	/* ============================================================
	   SECTION 5 · THE TIMELINE
	   ============================================================ */
	.section--timeline {
		padding-top: clamp(4rem, 7vw, 6rem);
	}

	.timeline-head {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 3rem;
		max-width: 44rem;
	}

	.timeline-title {
		font-size: clamp(2.2rem, 3.8vw, 3.2rem);
		margin: 0;
		line-height: 1.05;
		color: var(--ink);
	}

	.timeline-spread {
		max-width: 84rem;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 56rem) 1fr;
		gap: 3rem;
		align-items: start;
	}

	.timeline-index {
		position: sticky;
		top: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-top: 0.5rem;
		max-width: 12rem;
	}

	.week-index {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.week-index li {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink-soft);
		padding: 8px 0;
		border-bottom: 1px dashed rgba(26, 26, 23, 0.18);
	}

	.week-index li:last-child {
		border-bottom: none;
	}

	.timeline-note {
		font-size: 1.2rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.15;
	}

	.weeks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.week {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: 2.5rem;
		padding: 1.5rem 0;
		border-bottom: 1px dashed rgba(26, 26, 23, 0.18);
		align-items: start;
	}

	.week:first-child {
		padding-top: 0;
	}

	.week:last-child {
		border-bottom: none;
	}

	.week-meta {
		display: flex;
		align-items: flex-start;
		padding-top: 0.55rem;
		grid-column: 1;
	}

	.week-entry,
	.week-data {
		grid-column: 2;
	}

	.week-entry {
		font-size: clamp(1.5rem, 2.4vw, 1.875rem);
		line-height: 1.3;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.week-data {
		font-size: 1.05rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.55;
	}

	/* ============================================================
	   FOOTER
	   ============================================================ */
	.footer {
		max-width: 84rem;
		margin: 0 auto;
		padding: 3rem clamp(1.5rem, 4vw, 4rem) 4rem;
	}

	.footer-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		align-items: baseline;
	}

	.footer-brand {
		font-size: 1.6rem;
		color: var(--ink);
	}

	.footer-copy {
		font-size: 0.95rem;
		color: var(--ink-soft);
		text-align: right;
		margin: 0;
	}

	/* ============================================================
	   RESPONSIVE
	   ============================================================ */
	@media (max-width: 1024px) {
		.cover-grid {
			grid-template-columns: 1fr;
		}

		.cover-right {
			align-items: flex-start;
		}

		.transform-spread {
			grid-template-columns: 1fr;
		}

		.syllabus-doc,
		.extracted-card {
			justify-self: stretch;
			max-width: none;
		}

		.extract-arrow {
			transform: rotate(90deg);
			justify-self: center;
		}

		.timeline-spread {
			grid-template-columns: 1fr;
		}

		.timeline-index {
			position: static;
			max-width: none;
		}
	}

	@media (max-width: 640px) {
		.cover-top {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}

		.cover-arrow {
			left: 1rem;
			bottom: -1rem;
		}

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

		.week {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.footer-grid {
			grid-template-columns: 1fr;
			text-align: center;
			gap: 0.75rem;
		}

		.footer-copy {
			text-align: center;
		}
	}

	/* ============================================================
	   CLOSING CTA
	   ============================================================ */
	.section--cta {
		text-align: center;
		padding: clamp(4rem, 8vw, 7rem) clamp(1.5rem, 4vw, 4rem);
	}

	.cta-title {
		font-size: clamp(2rem, 4.2vw, 3.2rem);
		color: var(--ink);
		margin: 0 0 2rem;
		line-height: 1.1;
	}

	.cta-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.9rem 2rem;
		background: transparent;
		color: var(--ink);
		text-decoration: none;
		border: 1.5px solid var(--ink);
		border-radius: 2px;
		font-family: var(--font-body);
		font-size: 1.125rem;
		font-weight: 500;
		transition:
			background 150ms ease-out,
			transform 150ms ease-out;
	}

	.cta-button:hover {
		background: var(--highlight);
		transform: translateY(-1px);
	}

	.cta-button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	.cta-button:active {
		transform: translateY(0);
	}
</style>
