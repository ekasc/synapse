<script lang="ts">
	import type { NextUp } from '$lib/dashboard/weekly-view-model';
	let { item, onnavigate }: { item: NextUp; onnavigate: (href: string) => void } = $props();
</script>

<section class="next" aria-labelledby="next-up-title">
	<div class="next-label">Next up</div>
	{#if item.kind === 'deadline'}
		<div class="body">
			<div class="meta">
				<span class:danger={item.deadline.overdue}>{item.status}</span><span
					>{item.deadline.courseCode}</span
				>
			</div>
			<h2 id="next-up-title">{item.deadline.title}</h2>
			<p>
				{item.deadline.typeLabel}{item.deadline.gradeWeight != null
					? ` · ${item.deadline.gradeWeight}% of grade`
					: ''}{item.deadline.time ? ` · ${item.deadline.time}` : ''}
			</p>
			<button class="btn btn-primary btn-sm" onclick={() => onnavigate(item.deadline.link.href)}
				>{item.deadline.link.label} →</button
			>
		</div>
	{:else}
		<div class="body">
			<div class="meta">
				<span>{item.priority.kind}</span>{#if item.priority.courseCode}<span
						>{item.priority.courseCode}</span
					>{/if}
			</div>
			<h2 id="next-up-title">{item.priority.title}</h2>
			<p>{item.status}</p>
			<button class="btn btn-primary btn-sm" onclick={() => onnavigate(item.priority.link.href)}
				>{item.priority.link.label} →</button
			>
		</div>
	{/if}
</section>

<style>
	.next {
		display: grid;
		grid-template-columns: 6rem 1fr;
		border: 1px solid var(--ink);
		background: var(--paper);
	}
	.next-label {
		padding: 0.9rem;
		background: var(--highlight);
		border-right: 1px solid var(--ink);
		font-family: var(--font-hand);
		font-weight: 700;
		color: var(--ink);
	}
	.body {
		padding: 0.85rem 1rem;
		display: grid;
		gap: 0.35rem;
		justify-items: start;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		font-family: var(--font-mono);
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--ink-soft);
	}
	.meta span {
		padding: 0.06rem 0.35rem;
		background: var(--paper-shelf);
	}
	.meta .danger {
		color: var(--pen-red);
	}
	h2 {
		margin: 0;
		font-family: var(--font-hand);
		font-size: 1.35rem;
		line-height: 1.15;
		color: var(--ink);
	}
	p {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.85rem;
	}
	button {
		margin-top: 0.2rem;
	}
	@media (max-width: 38rem) {
		.next {
			grid-template-columns: 1fr;
		}
		.next-label {
			border-right: 0;
			border-bottom: 1px solid var(--ink);
			padding: 0.45rem 0.75rem;
		}
	}
</style>
