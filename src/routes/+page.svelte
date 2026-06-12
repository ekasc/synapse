<script lang="ts">
	import { resolve } from '$app/paths';

	type Week = {
		stamp: string;
		entry: string;
		data: string;
		viz: 'bar' | 'spark' | 'num' | 'dot' | 'check' | 'graph';
		value: number;
	};

	const weeks: Week[] = [
		{
			stamp: 'WEEK 01',
			entry: 'uploaded syllabus: CSIS 4495',
			data: 'deadlines: 14 · weights: 4',
			viz: 'bar',
			value: 0.18
		},
		{
			stamp: 'WEEK 02',
			entry: 'first grade: 88/100',
			data: 'linked to COMP 1110',
			viz: 'dot',
			value: 0.88
		},
		{
			stamp: 'WEEK 03',
			entry: 'study sessions: 4.5h',
			data: 'digest: midterm in 3 weeks, at 84%',
			viz: 'spark',
			value: 0.62
		},
		{
			stamp: 'WEEK 04',
			entry: 'midterm: 76/100',
			data: 'running: 81.2% · what-if: 85% on project → 50% on final',
			viz: 'num',
			value: 0.76
		},
		{
			stamp: 'WEEK 05',
			entry: 'study sessions: 7h · note: heap sort vs merge sort',
			data: 'linked to COMP 1110',
			viz: 'check',
			value: 1
		},
		{
			stamp: 'WEEK 06',
			entry: 'graph: 3 courses, 2 prereqs, 14 deadlines, 24 study hours',
			data: 'semester closed · spring ' + "'" + '26 open',
			viz: 'graph',
			value: 1
		}
	];
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
				<span class="tape" style="transform: rotate(-3deg);">vol. 01</span>
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
				</div>

				<div class="cover-right">
					<figure class="mini-graph polaroid" style="transform: rotate(-1.6deg);">
						<svg
							class="mini-graph-svg"
							viewBox="0 0 320 200"
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
									d="M 220 100 Q 260 100 290 60"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.6"
									stroke-linecap="round"
								/>
							</g>
							<g class="nodes font-mono" font-size="9" fill="var(--ink)">
								<g transform="translate(40 88)">
									<rect
										x="0"
										y="0"
										width="44"
										height="24"
										fill="#fbf8f0"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="22" y="14" text-anchor="middle">CS 101</text>
								</g>
								<g transform="translate(122 58)">
									<rect
										x="0"
										y="0"
										width="44"
										height="24"
										fill="#fbf8f0"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="22" y="14" text-anchor="middle">MATH 110</text>
								</g>
								<g transform="translate(122 118)">
									<rect
										x="0"
										y="0"
										width="44"
										height="24"
										fill="#fbf8f0"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="22" y="14" text-anchor="middle">CS 201</text>
								</g>
								<g transform="translate(204 58)">
									<rect
										x="0"
										y="0"
										width="44"
										height="24"
										fill="#fbf8f0"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="22" y="14" text-anchor="middle">CS 301</text>
								</g>
								<g transform="translate(204 118)">
									<rect
										x="0"
										y="0"
										width="44"
										height="24"
										fill="#fbf8f0"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="22" y="14" text-anchor="middle">CS 302</text>
								</g>
								<g transform="translate(276 46)">
									<rect
										x="0"
										y="0"
										width="44"
										height="24"
										fill="#fbf8f0"
										stroke="var(--ink)"
										stroke-width="1.2"
										rx="2"
									/>
									<text x="22" y="14" text-anchor="middle">CAP</text>
								</g>
							</g>
						</svg>
						<figcaption class="font-mono">fig. 1 · your first 3 semesters, traced</figcaption>
					</figure>

					<div class="cover-spark font-mono" aria-hidden="true">
						<span class="stamp" style="transform: rotate(-1deg);">live · 12 courses</span>
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
		<h2 id="problem-heading" class="sr-only">The problem: fragmented academic data</h2>

		<figure
			class="messy-page-wrap"
			aria-label="A torn notebook page showing the chaos of a typical week"
		>
			<div class="messy-page" style="transform: rotate(1.4deg);">
				<div class="coffee-ring" aria-hidden="true"></div>
				<div class="messy-grid">
					<div class="cal-block">
						<span class="cal-head font-mono">week 03</span>
						<div class="cal-grid">
							<span class="d">M</span><span class="d">T</span><span class="d">W</span><span
								class="d">T</span
							><span class="d">F</span><span class="d">S</span><span class="d">S</span>
							<span class="cell"></span><span class="cell cross"></span><span class="cell"
							></span><span class="cell red"></span><span class="cell"></span><span class="cell"
							></span><span class="cell"></span>
							<span class="cell"></span><span class="cell"></span><span class="cell"></span><span
								class="cell cross"
							></span><span class="cell red"></span><span class="cell"></span><span class="cell"
							></span>
							<span class="cell"></span><span class="cell cross"></span><span class="cell"
							></span><span class="cell"></span><span class="cell"></span><span class="cell"
							></span><span class="cell"></span>
						</div>
					</div>
					<div class="cal-legend font-mono" aria-hidden="true">
						<span><i class="dot red"></i> deadline</span>
						<span><i class="dot cross"></i> class</span>
					</div>
					<div class="scribble scribble-1" aria-hidden="true">math 1120</div>
					<div class="scribble scribble-2" aria-hidden="true">csis 4495</div>
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
						<span class="done">☐ read ch.4</span>
						<span class="done">☐ lab report</span>
						<span class="done">☐ email prof</span>
						<span class="red-circle">◯ study for midterm</span>
					</div>
				</div>
			</div>

			<svg
				class="margin-annotation margin-annotation--problem"
				viewBox="0 0 180 60"
				aria-hidden="true"
			>
				<g class="hand-arrow">
					<path d="M 8 8 Q 30 18 56 24" />
					<circle class="head" cx="56" cy="24" r="2.4" />
				</g>
			</svg>
			<span class="margin-note margin-note--problem" aria-hidden="true">this. every week.</span>
		</figure>

		<p class="problem-body">
			Each week looks like this on paper — fragments in five different places, none of them talking
			to each other. The data exists. The connection doesn't.
		</p>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 3 · THE TRANSFORMATION ==================== -->
	<section class="section section--transform" aria-labelledby="transform-heading">
		<header class="transform-head">
			<span class="stamp" style="transform: rotate(-1deg);">field 03 · the mechanism</span>
			<h2 id="transform-heading" class="transform-title font-hand">
				<span class="highlighter-soft">upload</span> a syllabus. every deadline, weight, and date
				<span class="highlighter">extracts</span> on its own.
			</h2>
		</header>

		<div class="transform-spread">
			<figure class="syllabus-doc polaroid" style="transform: rotate(-1deg);">
				<div class="doc-stamp font-mono">CSIS 4495 · spring '26 · syllabus</div>
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
					y="48"
					text-anchor="middle"
					font-family="Caveat, cursive"
					font-size="18"
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
			answer questions across semesters. What you don't see is the same thing you couldn't see
			before.
		</p>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 4 · THE GRAPH ==================== -->
	<section class="section section--graph" aria-labelledby="graph-heading">
		<header class="graph-head">
			<span class="stamp" style="transform: rotate(-0.6deg);"
				>the graph · fall '25 — spring '27</span
			>
		</header>

		<div class="graph-spread">
			<aside class="graph-margin" aria-label="Margin annotations">
				<span class="margin-note" style="top: 14%; left: 4%; transform: rotate(-3deg);">
					you bombed this midterm<br />(see week 4)
				</span>
				<span class="margin-note" style="top: 36%; right: -1rem; transform: rotate(2deg);">
					this one's optional
				</span>
				<span class="margin-note" style="top: 60%; left: 6%; transform: rotate(-1deg);">
					move this up a semester →
				</span>
				<span class="margin-note" style="top: 82%; right: 0; transform: rotate(2.4deg);">
					networks → capstone path
				</span>
			</aside>

			<div class="graph-stage">
				<svg
					class="degree-graph"
					viewBox="0 0 1100 600"
					role="img"
					aria-labelledby="degree-graph-title degree-graph-desc"
				>
					<title id="degree-graph-title">Degree graph across four semesters</title>
					<desc id="degree-graph-desc">
						A hand-traced course dependency graph for Fall 2025 through Spring 2027. Twelve courses,
						prereq edges, and a highlighted path from Foundations of Information Systems to the
						Capstone Project.
					</desc>

					<g class="term-labels font-mono" font-size="14" fill="var(--ink-faint)">
						<text x="160" y="36" text-anchor="middle">FALL '25</text>
						<text x="450" y="36" text-anchor="middle">SPRING '26</text>
						<text x="740" y="36" text-anchor="middle">FALL '26</text>
						<text x="980" y="36" text-anchor="middle">SPRING '27</text>
					</g>

					<g class="edges" stroke-linecap="round" fill="none">
						<!-- FALL 25 -> SPRING 26 -->
						<path d="M 160 130 Q 280 110 360 130" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 160 200 Q 280 250 360 250" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 160 280 Q 280 290 360 290" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 160 380 Q 300 380 360 320" stroke="var(--ink)" stroke-width="1.8" />
						<!-- SPRING 26 -> FALL 26 -->
						<path d="M 460 130 Q 600 130 660 130" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 460 250 Q 600 220 660 180" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 460 320 Q 600 320 660 280" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 460 380 Q 600 380 660 380" stroke="var(--ink)" stroke-width="1.8" />
						<!-- HIGHLIGHTED PATH -->
						<path
							d="M 460 380 Q 580 380 660 380 L 660 280 L 770 280 L 770 200 L 870 200"
							stroke="var(--highlight)"
							stroke-width="6"
							opacity="0.85"
						/>
						<!-- FALL 26 -> SPRING 27 -->
						<path d="M 770 130 Q 870 130 880 160" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 770 280 Q 870 250 880 200" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 770 380 Q 870 380 880 320" stroke="var(--ink)" stroke-width="1.8" />
						<path d="M 770 460 Q 880 460 880 380" stroke="var(--ink)" stroke-width="1.8" />
					</g>

					<g class="nodes" font-family="Special Elite, monospace" font-size="11">
						<!-- FALL 25 -->
						<g transform="translate(80 100)">
							<rect
								width="160"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="80" y="24" text-anchor="middle" fill="var(--ink)">COMP 1110</text>
							<text x="80" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>intro to programming</text
							>
						</g>
						<g transform="translate(80 170)">
							<rect
								width="160"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="80" y="24" text-anchor="middle" fill="var(--ink)">MATH 1120</text>
							<text x="80" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>calculus I</text
							>
						</g>
						<g transform="translate(80 250)">
							<rect
								width="160"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="80" y="24" text-anchor="middle" fill="var(--ink)">ENGL 1101</text>
							<text x="80" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>academic writing</text
							>
						</g>
						<g transform="translate(80 350)">
							<rect
								width="160"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="80" y="24" text-anchor="middle" fill="var(--ink)">CSIS 1100</text>
							<text x="80" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>foundations of IS</text
							>
						</g>

						<!-- SPRING 26 -->
						<g transform="translate(360 100)">
							<rect
								width="200"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="100" y="24" text-anchor="middle" fill="var(--ink)">COMP 2110</text>
							<text x="100" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>data structures</text
							>
						</g>
						<g transform="translate(360 220)">
							<rect
								width="200"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="100" y="24" text-anchor="middle" fill="var(--ink)">MATH 1130</text>
							<text x="100" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>calculus II</text
							>
						</g>
						<g transform="translate(360 290)">
							<rect
								width="200"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="100" y="24" text-anchor="middle" fill="var(--ink)">STAT 2160</text>
							<text x="100" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>statistics</text
							>
						</g>
						<g transform="translate(360 350)">
							<rect
								width="200"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="100" y="24" text-anchor="middle" fill="var(--ink)">CSIS 2100</text>
							<text
								x="100"
								y="24"
								dy="18"
								text-anchor="middle"
								fill="var(--ink-soft)"
								font-size="9.5">systems analysis</text
							>
						</g>

						<!-- FALL 26 -->
						<g transform="translate(660 100)">
							<rect
								width="220"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="110" y="24" text-anchor="middle" fill="var(--ink)">COMP 2120</text>
							<text x="110" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>discrete structures</text
							>
						</g>
						<g transform="translate(660 250)">
							<rect
								width="220"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="110" y="24" text-anchor="middle" fill="var(--ink)">CSIS 3100</text>
							<text x="110" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>algorithms</text
							>
						</g>
						<g transform="translate(660 350)">
							<rect
								width="220"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="110" y="24" text-anchor="middle" fill="var(--ink)">ECON 2200</text>
							<text x="110" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>principles of econ</text
							>
						</g>
						<g transform="translate(660 430)">
							<rect
								width="220"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="110" y="24" text-anchor="middle" fill="var(--ink)">ISYS 3300</text>
							<text x="110" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>it project mgmt</text
							>
						</g>

						<!-- SPRING 27 -->
						<g transform="translate(880 130)">
							<rect
								width="180"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="90" y="24" text-anchor="middle" fill="var(--ink)">CSIS 4495</text>
							<text x="90" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>capstone</text
							>
						</g>
						<g transform="translate(880 280)">
							<rect
								width="180"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="90" y="24" text-anchor="middle" fill="var(--ink)">CSIS 4500</text>
							<text x="90" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>cybersecurity</text
							>
						</g>
						<g transform="translate(880 380)">
							<rect
								width="180"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="90" y="24" text-anchor="middle" fill="var(--ink)">CSIS 4400</text>
							<text x="90" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>machine learning</text
							>
						</g>
						<g transform="translate(880 480)">
							<rect
								width="180"
								height="60"
								fill="#fbf8f0"
								stroke="var(--ink)"
								stroke-width="1.4"
								rx="2"
							/>
							<text x="90" y="24" text-anchor="middle" fill="var(--ink)">FREE ELEC</text>
							<text x="90" y="42" text-anchor="middle" fill="var(--ink-soft)" font-size="9.5"
								>humanities</text
							>
						</g>
					</g>
				</svg>
			</div>
		</div>

		<div class="graph-question">
			<p class="graph-q font-body">
				<em>What happens to your capstone if you take Algorithms a semester early?</em>
			</p>
			<p class="graph-a font-body">
				Two prereq edges reroute. Your final semester loses <b>6 hours/week</b>.
			</p>
		</div>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== SECTION 5 · THE TIMELINE ==================== -->
	<section class="section section--timeline" aria-labelledby="timeline-heading">
		<header class="timeline-head">
			<span class="stamp" style="transform: rotate(-0.8deg);">the log · week by week</span>
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
						<p class="week-data font-mono">{w.data}</p>
						<div class="week-viz" aria-hidden="true">
							{#if w.viz === 'bar'}
								<div class="viz-bar">
									<div class="viz-bar-fill" style="width: {w.value * 100}%"></div>
								</div>
							{:else if w.viz === 'dot'}
								<svg viewBox="0 0 100 30" class="viz-dot">
									<line x1="4" y1="20" x2="96" y2="20" stroke="var(--ink-faint)" stroke-width="1" />
									<line x1="4" y1="14" x2="4" y2="26" stroke="var(--ink-faint)" stroke-width="1" />
									<line
										x1="96"
										y1="14"
										x2="96"
										y2="26"
										stroke="var(--ink-faint)"
										stroke-width="1"
									/>
									<circle cx={4 + w.value * 92} cy="20" r="5" fill="var(--ink)" />
									<text
										x="50"
										y="12"
										text-anchor="middle"
										font-family="Special Elite, monospace"
										font-size="8"
										fill="var(--ink-soft)">{Math.round(w.value * 100)}/100</text
									>
								</svg>
							{:else if w.viz === 'spark'}
								<svg viewBox="0 0 120 30" class="viz-spark">
									<polyline
										points="4,22 24,18 44,20 64,12 84,16 104,8 116,4"
										fill="none"
										stroke="var(--ink)"
										stroke-width="1.4"
										stroke-linecap="round"
									/>
									<circle cx="116" cy="4" r="2.4" fill="var(--ink)" />
								</svg>
							{:else if w.viz === 'num'}
								<div class="viz-num">
									<span class="font-mono">{Math.round(w.value * 100)}/100</span>
									<span class="margin-note">a what-if</span>
								</div>
							{:else if w.viz === 'check'}
								<svg viewBox="0 0 60 30" class="viz-check">
									<path
										d="M 8 18 L 22 26 L 52 6"
										fill="none"
										stroke="var(--ink)"
										stroke-width="2.2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							{:else if w.viz === 'graph'}
								<svg viewBox="0 0 200 60" class="viz-graph">
									<g stroke="var(--ink)" stroke-width="1.2" fill="none">
										<line x1="20" y1="30" x2="60" y2="30" />
										<line x1="60" y1="30" x2="100" y2="20" />
										<line x1="60" y1="30" x2="100" y2="40" />
										<line x1="100" y1="20" x2="140" y2="30" />
										<line x1="100" y1="40" x2="140" y2="30" />
										<line
											x1="140"
											y1="30"
											x2="180"
											y2="30"
											stroke="var(--highlight)"
											stroke-width="3"
										/>
									</g>
									<g fill="#fbf8f0" stroke="var(--ink)" stroke-width="1">
										<rect x="10" y="22" width="20" height="16" rx="1.5" />
										<rect x="50" y="22" width="20" height="16" rx="1.5" />
										<rect x="90" y="12" width="20" height="16" rx="1.5" />
										<rect x="90" y="32" width="20" height="16" rx="1.5" />
										<rect x="130" y="22" width="20" height="16" rx="1.5" />
										<rect x="170" y="22" width="20" height="16" rx="1.5" />
									</g>
								</svg>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== FOOTER ==================== -->
	<footer class="footer" aria-label="Colophon">
		<div class="footer-grid">
			<div class="footer-brand font-hand">synapse · vol. 01</div>
			<p class="footer-copy font-body">
				© 2026 · built for students who take their education seriously
			</p>
			<nav class="footer-nav font-body" aria-label="Footer">
				<a href={resolve('/')}>privacy</a>
				<a href={resolve('/')}>terms</a>
				<a href={resolve('/')}>contact</a>
			</nav>
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* ============================================================
	   SECTION SCAFFOLD
	   ============================================================ */
	.section {
		position: relative;
		max-width: 72rem;
		margin: 0 auto;
		padding: clamp(3.5rem, 7vw, 6rem) clamp(1.5rem, 4vw, 4rem);
	}

	/* ============================================================
	   SECTION 1 · COVER
	   ============================================================ */
	.cover-page {
		position: relative;
		padding-top: 2rem;
	}

	.cover-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: clamp(3rem, 6vw, 5rem);
	}

	.cover-grid {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: clamp(2rem, 5vw, 4rem);
		align-items: center;
	}

	.cover-title {
		font-size: clamp(3.6rem, 8vw, 7.5rem);
		margin: 0 0 1.5rem;
		color: var(--ink);
		letter-spacing: -0.01em;
	}

	.cover-sub {
		font-size: clamp(1.05rem, 1.4vw, 1.25rem);
		line-height: 1.55;
		color: var(--ink-soft);
		max-width: 32ch;
		margin: 0;
	}

	.cover-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1.25rem;
	}

	.mini-graph {
		padding: 14px 14px 18px;
		max-width: 26rem;
	}

	.mini-graph-svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.mini-graph figcaption {
		margin-top: 8px;
		text-align: center;
		font-size: 0.7rem;
		color: var(--ink-soft);
		letter-spacing: 0.06em;
	}

	.cover-spark {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}

	.sparkline {
		width: 200px;
		height: 40px;
		display: block;
	}

	.sparkline-caption {
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--ink-soft);
	}

	.cover-arrow {
		position: absolute;
		left: 4rem;
		bottom: -2rem;
		width: 36px;
		height: 56px;
	}

	/* ============================================================
	   SECTION 2 · THE PROBLEM
	   ============================================================ */
	.section--problem {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.5rem;
		padding-top: clamp(4rem, 7vw, 6rem);
	}

	.messy-page-wrap {
		position: relative;
		max-width: 36rem;
		width: 100%;
	}

	.messy-page {
		position: relative;
		background: #fbf8f0;
		border: 1px solid rgba(26, 26, 23, 0.18);
		padding: 28px 32px 36px;
		min-height: 30rem;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.6) inset,
			0 6px 14px rgba(26, 26, 23, 0.1);
	}

	.coffee-ring {
		position: absolute;
		top: 18px;
		right: 32px;
		width: 64px;
		height: 64px;
		border: 2px solid rgba(115, 70, 30, 0.18);
		border-radius: 50%;
		opacity: 0.7;
	}

	.messy-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 22px;
	}

	.cal-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cal-head {
		font-size: 0.78rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}

	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		font-size: 0.7rem;
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
		font-size: 1.4rem;
		color: var(--ink);
		opacity: 0.6;
	}

	.scribble-1 {
		top: 200px;
		right: 24px;
		transform: rotate(-4deg);
	}

	.scribble-2 {
		top: 280px;
		left: 32px;
		transform: rotate(2deg);
	}

	.sticky {
		position: absolute;
		bottom: 100px;
		left: 24px;
		background: #fff4b0;
		padding: 14px 18px;
		font-family: var(--font-hand);
		font-size: 1.25rem;
		line-height: 1.2;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.5) inset,
			0 3px 8px rgba(26, 26, 23, 0.15);
		color: var(--ink);
		max-width: 9rem;
	}

	.todo {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.85rem;
		margin-top: 12px;
	}

	.todo span {
		color: var(--ink);
	}

	.todo .done {
		text-decoration: line-through;
		color: var(--ink-faint);
	}

	.todo .red-circle {
		display: inline-block;
		border: 1.5px solid var(--pen-red);
		border-radius: 999px;
		padding: 2px 12px;
		color: var(--pen-red);
		width: fit-content;
	}

	.margin-annotation--problem {
		position: absolute;
		left: -3rem;
		top: 4rem;
		width: 56px;
		height: 60px;
	}

	.margin-note--problem {
		position: absolute;
		left: -7.5rem;
		top: 5.5rem;
		font-size: 1.5rem;
		transform: rotate(-6deg);
		color: var(--pen-red);
		max-width: 7rem;
	}

	.problem-body {
		font-size: clamp(1.1rem, 1.5vw, 1.35rem);
		line-height: 1.55;
		color: var(--ink);
		max-width: 36rem;
		margin: 0;
		text-align: center;
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
		font-size: clamp(2.2rem, 4vw, 3.4rem);
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
		padding: 18px 22px 24px;
		max-width: 28rem;
		justify-self: end;
		width: 100%;
	}

	.doc-stamp {
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
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
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}

	.doc-value {
		font-size: 0.95rem;
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
		background: #fbf8f0;
		border: 1px solid var(--ink);
		padding: 18px 22px 24px;
		max-width: 28rem;
		width: 100%;
		justify-self: start;
		box-shadow: 2px 2px 0 var(--ink);
	}

	.ext-head {
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
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
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}

	.ext-row dd {
		margin: 0;
		font-size: 0.92rem;
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
		font-size: 0.9rem;
	}

	.ext-list li span {
		color: var(--ink-faint);
		min-width: 5rem;
	}

	.ext-list li.hl {
		background: var(--highlight);
		mix-blend-mode: multiply;
		padding: 1px 4px;
		margin: 0 -4px;
	}

	.transform-body {
		font-size: clamp(1.05rem, 1.4vw, 1.2rem);
		line-height: 1.6;
		color: var(--ink);
		max-width: 36rem;
		margin: 0;
	}

	/* ============================================================
	   SECTION 4 · THE GRAPH
	   ============================================================ */
	.section--graph {
		padding-top: clamp(4rem, 7vw, 6rem);
	}

	.graph-head {
		margin-bottom: 2.5rem;
	}

	.graph-spread {
		position: relative;
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: 1rem;
		margin-bottom: 3rem;
	}

	.graph-margin {
		position: relative;
		min-height: 24rem;
	}

	.graph-margin .margin-note {
		position: absolute;
		font-size: 1.1rem;
		color: var(--ink-soft);
		max-width: 7rem;
	}

	.graph-stage {
		background: #fbf8f0;
		border: 1px solid rgba(26, 26, 23, 0.18);
		padding: 1.25rem 1rem 1.5rem;
		overflow-x: auto;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.6) inset,
			0 3px 10px rgba(26, 26, 23, 0.08);
	}

	.degree-graph {
		width: 100%;
		min-width: 56rem;
		height: auto;
		display: block;
	}

	.graph-question {
		max-width: 36rem;
	}

	.graph-q {
		font-size: clamp(1.1rem, 1.4vw, 1.25rem);
		margin: 0 0 0.75rem;
		color: var(--ink);
	}

	.graph-q em {
		font-style: italic;
	}

	.graph-a {
		font-size: clamp(1.05rem, 1.3vw, 1.2rem);
		line-height: 1.55;
		margin: 0;
		color: var(--ink-soft);
	}

	.graph-a b {
		color: var(--ink);
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
		font-size: clamp(2rem, 3.6vw, 3rem);
		margin: 0;
		line-height: 1.05;
		color: var(--ink);
	}

	.timeline-spread {
		max-width: 44rem;
		margin: 0 auto;
	}

	.weeks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.week {
		display: grid;
		grid-template-columns: 9rem 1fr;
		gap: 1.5rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px dashed rgba(26, 26, 23, 0.18);
	}

	.week:last-child {
		border-bottom: none;
	}

	.week-meta {
		display: flex;
		align-items: flex-start;
	}

	.week-entry {
		font-size: clamp(1.4rem, 2.2vw, 1.75rem);
		line-height: 1.1;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.week-data {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0 0 1rem;
		line-height: 1.4;
	}

	.week-viz {
		max-width: 18rem;
	}

	.viz-bar {
		height: 8px;
		background: rgba(26, 26, 23, 0.08);
		border-radius: 999px;
		overflow: hidden;
	}

	.viz-bar-fill {
		height: 100%;
		background: var(--ink);
	}

	.viz-dot,
	.viz-spark,
	.viz-check,
	.viz-graph {
		width: 100%;
		height: auto;
		display: block;
	}

	.viz-num {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}

	.viz-num .font-mono {
		font-size: 1.5rem;
		color: var(--ink);
	}

	.viz-num .margin-note {
		font-size: 1rem;
		color: var(--pen-red);
	}

	/* ============================================================
	   FOOTER
	   ============================================================ */
	.footer {
		max-width: 72rem;
		margin: 0 auto;
		padding: 3rem clamp(1.5rem, 4vw, 4rem) 4rem;
	}

	.footer-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 2rem;
		align-items: baseline;
	}

	.footer-brand {
		font-size: 1.5rem;
		color: var(--ink);
	}

	.footer-copy {
		font-size: 0.9rem;
		color: var(--ink-soft);
		text-align: center;
		margin: 0;
	}

	.footer-nav {
		display: flex;
		gap: 1.5rem;
		justify-content: flex-end;
	}

	.footer-nav a {
		color: var(--ink-soft);
		text-decoration: none;
		font-size: 0.9rem;
		border-bottom: 1px solid transparent;
		padding-bottom: 1px;
		transition:
			border-color 200ms ease,
			color 200ms ease;
	}

	.footer-nav a:hover {
		color: var(--ink);
		border-bottom-color: var(--highlight);
	}

	/* ============================================================
	   RESPONSIVE
	   ============================================================ */
	@media (max-width: 1023px) {
		.cover-grid {
			grid-template-columns: 1fr;
		}

		.cover-right {
			align-items: flex-start;
		}

		.graph-spread {
			grid-template-columns: 1fr;
		}

		.graph-margin {
			display: none;
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
		}

		.footer-copy,
		.footer-nav {
			justify-content: center;
			text-align: center;
		}

		.footer-nav {
			justify-content: center;
		}
	}
</style>
