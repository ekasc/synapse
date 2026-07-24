<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import CoverSection from '$lib/components/landing/CoverSection.svelte';
	import ProblemSection from '$lib/components/landing/ProblemSection.svelte';
	import TransformSection from '$lib/components/landing/TransformSection.svelte';
	import QuerySection from '$lib/components/landing/QuerySection.svelte';
	import TimelineSection from '$lib/components/landing/TimelineSection.svelte';
</script>

<svelte:head>
	<title>synapse · vol. 01</title>
	<meta
		name="description"
		content="A notebook for your degree. Every course, grade, and deadline on one connected page."
	/>
</svelte:head>

<main class="paper">
	<CoverSection />

	<div class="rough-divider" aria-hidden="true"></div>

	<ProblemSection />

	<div class="rough-divider" aria-hidden="true"></div>

	<TransformSection />

	<div class="rough-divider" aria-hidden="true"></div>

	<QuerySection />

	<div class="rough-divider" aria-hidden="true"></div>

	<TimelineSection />

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== CLOSING CTA ==================== -->
	<section class="section section--cta" aria-labelledby="cta-heading">
		<h2 id="cta-heading" class="cta-title font-hand">
			your degree is <span class="highlighter">one graph</span>, not four semesters
		</h2>
		<a href={resolveRoute('/app')} class="cta-button"> open your notebook → </a>
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
	   GLOBAL LANDING OVERRIDES
	   ============================================================ */
	:global(body) {
		background: var(--paper);
	}

	/* ============================================================
	   SHARED SECTION SCAFFOLD
	   ============================================================ */
	:global(.section) {
		position: relative;
		max-width: 84rem;
		margin: 0 auto;
		padding: clamp(3.5rem, 7vw, 6rem) clamp(1.5rem, 4vw, 4rem);
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
	   RESPONSIVE (CTA + FOOTER)
	   ============================================================ */
	@media (max-width: 640px) {
		.footer-grid {
			grid-template-columns: 1fr;
			text-align: center;
			gap: 0.75rem;
		}

		.footer-copy {
			text-align: center;
		}
	}
</style>
