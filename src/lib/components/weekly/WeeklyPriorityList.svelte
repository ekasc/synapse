<script lang="ts">
	import type { CompactPriority } from '$lib/dashboard/weekly-view-model';
	let {
		priorities,
		onnavigate
	}: { priorities: CompactPriority[]; onnavigate: (href: string) => void } = $props();
</script>

<section class="priorities" aria-labelledby="priorities-title">
	<div class="section-title">
		<span>Focus</span>
		<h2 id="priorities-title">Top priorities</h2>
	</div>
	<ol>
		{#each priorities as item (item.id)}
			<li>
				<span class="rank">{item.rank}</span>
				<div class="body">
					<div class="meta">
						<span>{item.kindLabel}</span>{#if item.courseCode}<span>{item.courseCode}</span>{/if}
					</div>
					<strong>{item.title}</strong>
					<small>{item.meta}</small>
					<details>
						<summary>Why this?</summary>
						<p>{item.reason}</p>
						{#if item.factors.length}<p class="factors">{item.factors.join(' · ')}</p>{/if}
					</details>
				</div>
				<button class="btn btn-ghost btn-sm" onclick={() => onnavigate(item.link.href)}
					>{item.link.label} →</button
				>
			</li>
		{/each}
	</ol>
</section>

<style>
	.priorities {
		display: grid;
		gap: 0.75rem;
	}
	.section-title {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
	}
	.section-title > span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}
	h2 {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.35rem;
		color: var(--ink);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: start;
		padding: 0.7rem 0.2rem;
		border-bottom: 1px solid var(--rule-soft);
	}
	.rank {
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
	}
	.body {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}
	.meta {
		display: flex;
		gap: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.meta span {
		background: var(--paper-shelf);
		padding: 0.05rem 0.3rem;
	}
	.body > strong {
		color: var(--ink);
		font-size: 0.9rem;
	}
	.body > small {
		color: var(--ink-soft);
		font-size: 0.72rem;
	}
	details {
		margin-top: 0.15rem;
		font-size: 0.72rem;
		color: var(--ink-soft);
	}
	summary {
		width: fit-content;
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-faint);
	}
	p {
		margin: 0.35rem 0 0;
		line-height: 1.45;
	}
	.factors {
		font-family: var(--font-mono);
		font-size: 0.6rem;
	}
	@media (max-width: 40rem) {
		li {
			grid-template-columns: 2rem 1fr;
		}
		li > button {
			grid-column: 2;
			justify-self: start;
		}
	}
</style>
