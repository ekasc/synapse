<section class="section section--transform" aria-labelledby="transform-heading">
	<header class="transform-head">
		<span class="stamp" style="transform: rotate(-1deg);">field note · the mechanism</span>
		<h2 id="transform-heading" class="transform-title font-hand">
			<span class="highlighter-soft">add</span> a syllabus. turn course details, deadlines, and weights
			into a <span class="highlighter">usable plan</span>.
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
		The structure is the point. Course details, dates, grade weights, and prerequisites feed the
		calendar, weekly plan, grade tools, and course map — instead of living in separate tabs.
	</p>
</section>

<style>
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

	@media (max-width: 1024px) {
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
</style>
