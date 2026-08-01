<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import CoverSection from '$lib/components/landing/CoverSection.svelte';
	import ProblemSection from '$lib/components/landing/ProblemSection.svelte';
	import TransformSection from '$lib/components/landing/TransformSection.svelte';
	import QuerySection from '$lib/components/landing/QuerySection.svelte';
	import TimelineSection from '$lib/components/landing/TimelineSection.svelte';
</script>

<svelte:head>
	<title>synapse</title>
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

	<section
		class="section section--cta relative mx-auto max-w-[84rem] px-[clamp(1.5rem,4vw,4rem)] py-[clamp(3.5rem,6vw,5rem)] text-center"
		aria-labelledby="cta-heading"
	>
		<h2
			id="cta-heading"
			class="cta-title font-hand m-0 mb-4 text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.1] text-[var(--ink)]"
		>
			your degree is <span class="highlighter">one graph</span>, not four separate semesters
		</h2>
		<p
			class="mx-auto mb-7 max-w-[38ch] text-[clamp(1.05rem,1.4vw,1.25rem)] leading-[1.55] text-[var(--ink-soft)]"
		>
			Start with the courses you have. Build a clearer path through the ones that come next.
		</p>
		<a
			href={resolveRoute('/app')}
			class="cta-button inline-flex items-center gap-2 rounded-[2px] border-[1.5px] border-[var(--ink)] bg-[var(--highlight)] px-8 py-[0.9rem] text-lg font-[var(--font-body)] font-medium text-[var(--ink)] no-underline transition-[background,transform] duration-150 ease-out hover:-translate-y-px hover:bg-[var(--highlight-soft)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ink)] active:translate-y-0"
		>
			build your degree workspace →
		</a>
	</section>

	<div class="rough-divider" aria-hidden="true"></div>

	<footer
		class="footer mx-auto max-w-[84rem] px-[clamp(1.5rem,4vw,4rem)] pt-12 pb-16"
		aria-label="Footer"
	>
		<div
			class="footer-grid grid grid-cols-2 items-baseline gap-8 max-sm:grid-cols-1 max-sm:gap-3 max-sm:text-center"
		>
			<div class="footer-brand font-hand text-[1.6rem] text-[var(--ink)]">synapse</div>
			<p
				class="footer-copy font-body m-0 text-right text-[var(--ink-soft)] text-[var(--text-small)] max-sm:text-center"
			>
				© 2026 · built for students who take their education seriously
			</p>
		</div>
	</footer>
</main>
