<script lang="ts">
	import { resolveRoute } from '$app/paths';
</script>

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
					One workspace for your courses, deadlines, materials, study sessions, and semester plans.
				</p>
				<a href={resolveRoute('/app')} class="cover-cta">
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
						<g class="nodes" style="font-family: var(--font-body)" font-size="10" fill="var(--ink)">
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

<style>
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

	@media (max-width: 1024px) {
		.cover-grid {
			grid-template-columns: 1fr;
		}

		.cover-right {
			align-items: flex-start;
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
	}
</style>
