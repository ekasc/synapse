<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		count,
		hint,
		children
	}: { title: string; count: number; hint?: string; children: Snippet } = $props();
</script>

<details class="section">
	<summary
		><span>{title}</span><span class="summary-meta"
			>{hint ?? `${count} item${count === 1 ? '' : 's'}`}<b aria-hidden="true">+</b></span
		></summary
	>
	<div class="content">{@render children()}</div>
</details>

<style>
	.section {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}
	summary {
		min-height: 3rem;
		padding: 0.65rem 0.2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
		color: var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.summary-meta {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 400;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.summary-meta b {
		font-family: var(--font-body);
		font-size: 1rem;
		font-weight: 400;
		transition: transform 0.18s ease;
	}
	.section[open] .summary-meta b {
		transform: rotate(45deg);
	}
	.content {
		padding: 0.2rem 0 0.8rem;
	}
</style>
