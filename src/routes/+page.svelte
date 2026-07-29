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

<main class="paper bg-[var(--paper)]">
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
	<section
		class="section section--cta relative mx-auto max-w-[84rem] px-[clamp(1.5rem,4vw,4rem)] py-[clamp(4rem,8vw,7rem)] text-center"
		aria-labelledby="cta-heading"
	>
		<h2
			id="cta-heading"
			class="cta-title font-hand m-0 mb-8 text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.1] text-[var(--ink)]"
		>
			your degree is <span class="highlighter">one graph</span>, not four semesters
		</h2>
		<a
			href={resolveRoute('/app')}
			class="cta-button inline-flex items-center gap-2 rounded-[2px] border-[1.5px] border-[var(--ink)] bg-transparent px-8 py-[0.9rem] text-lg font-[var(--font-body)] font-medium text-[var(--ink)] no-underline transition-[background,transform] duration-150 ease-out hover:-translate-y-px hover:bg-[var(--highlight)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ink)] active:translate-y-0"
		>
			open your notebook →
		</a>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<!-- ==================== FOOTER ==================== -->
	<footer
		class="footer mx-auto max-w-[84rem] px-[clamp(1.5rem,4vw,4rem)] pt-12 pb-16"
		aria-label="Colophon"
	>
		<div
			class="footer-grid grid grid-cols-2 items-baseline gap-8 max-sm:grid-cols-1 max-sm:gap-3 max-sm:text-center"
		>
			<div class="footer-brand font-hand text-[1.6rem] text-[var(--ink)]">synapse · vol. 01</div>
			<p
				class="footer-copy font-body m-0 text-right text-[var(--ink-soft)] text-[var(--text-small)] max-sm:text-center"
			>
				© 2026 · built for students who take their education seriously
			</p>
		</div>
	</footer>
</main>
