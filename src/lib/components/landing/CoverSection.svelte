<script lang="ts">
	import { resolveRoute } from '$app/paths';
</script>

<section
	class="section section--cover relative mx-auto max-w-[84rem] px-[clamp(1.5rem,4vw,4rem)] py-[clamp(3.5rem,7vw,6rem)]"
	aria-labelledby="cover-heading"
>
	<div class="cover-page relative pt-2">
		<div
			class="cover-top mb-[clamp(1.5rem,3vw,2.5rem)] flex items-start justify-between max-sm:flex-col max-sm:gap-4"
		>
			<span class="stamp" style="transform: rotate(2.4deg);">fall '25 → spring '27</span>
		</div>

		<div
			class="cover-grid grid grid-cols-[0.9fr_1.1fr] items-start gap-[clamp(2rem,5vw,4rem)] max-lg:grid-cols-1"
		>
			<div class="cover-left">
				<h1
					id="cover-heading"
					class="cover-title font-hand m-0 mb-6 text-[clamp(3.6rem,8vw,6rem)] tracking-[-0.01em] text-[var(--ink)]"
				>
					<span class="highlighter">synapse</span>
				</h1>
				<p
					class="cover-sub m-0 max-w-[32ch] text-[clamp(1.2rem,1.4vw,1.5rem)] leading-[1.55] text-[var(--ink-soft)]"
				>
					One workspace for your courses, deadlines, materials, study sessions, and semester plans.
				</p>
				<a
					href={resolveRoute('/app')}
					class="cover-cta mt-10 inline-flex items-center gap-[0.6rem] rounded-[2px] border-[1.5px] border-[var(--ink)] bg-transparent py-[0.9rem] pr-[1.8rem] pl-8 text-[1.15rem] font-[var(--font-body)] font-medium text-[var(--ink)] no-underline transition-[background,transform] duration-150 ease-out hover:-translate-y-px hover:bg-[var(--highlight)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ink)] active:translate-y-0"
				>
					<span class="cta-label">open your notebook</span>
					<svg class="cta-arrow h-3.5 w-7" viewBox="0 0 40 20" aria-hidden="true">
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

			<div class="cover-right flex flex-col items-end gap-3 max-lg:items-start">
				<figure
					class="mini-graph polaroid w-full max-w-full !p-[14px_14px_18px]"
					style="transform: rotate(-1.6deg);"
				>
					<svg
						class="mini-graph-svg block h-auto w-full"
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

				<div class="cover-spark flex w-full flex-col items-start gap-1.5" aria-hidden="true">
					<svg viewBox="0 0 200 40" class="sparkline block h-auto w-full">
						<path
							d="M 4 30 L 24 26 L 44 28 L 64 18 L 84 22 L 104 14 L 124 16 L 144 10 L 164 12 L 184 6"
							fill="none"
							stroke="var(--ink)"
							stroke-width="1.4"
							stroke-linecap="round"
						/>
						<circle cx="184" cy="6" r="3" fill="var(--ink)" />
					</svg>
					<span class="sparkline-caption self-end text-[var(--ink-soft)] text-[var(--text-small)]"
						>gpa 3.7 · prereqs 8/9</span
					>
				</div>
			</div>
		</div>

		<svg
			class="cover-arrow absolute bottom-[-2rem] left-16 h-14 w-9 max-sm:bottom-[-1rem] max-sm:left-4"
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
