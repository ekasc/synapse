<script lang="ts">
	import { goto } from '$app/navigation';
	import DetailHero from '$lib/components/brief/DetailHero.svelte';
	import DetailSidebar from '$lib/components/brief/DetailSidebar.svelte';
	import DetailNarrative from '$lib/components/brief/DetailNarrative.svelte';
	import ActionRow from '$lib/components/brief/ActionRow.svelte';
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';
	import type { DetailState } from './+page.server';

	let {
		data
	}: {
		data: {
			code: string;
			detail: BriefingDetailViewModel | null;
			state: DetailState;
		};
	} = $props();

	function onDeleted() {
		goto('/app/brief');
	}
</script>

<svelte:head><title>Synapse · {data.code}</title></svelte:head>

<div class="page page-enter">
	<a class="back font-mono" href="/app/brief">← back to all briefs</a>

	{#if data.state === 'found' && data.detail}
		{@const d = data.detail}
		<article class="detail">
			<DetailHero brief={d} />
			<div class="layout">
				<div class="main">
					<DetailNarrative brief={d} />
					<ActionRow
						courseCode={d.courseCode}
						courseTitle={d.title}
						professorName={d.professor.requestedName}
						institution={d.institution}
						{onDeleted}
					/>
				</div>
				<div class="side">
					<DetailSidebar brief={d} />
				</div>
			</div>
		</article>
	{:else if data.state === 'not_found'}
		<div class="empty">
			<h1 class="empty-head">Brief not found</h1>
			<p class="empty-text">This brief may have been deleted or the link may be invalid.</p>
			<a class="btn btn-sm font-mono" href="/app/brief">Return to all briefs</a>
		</div>
	{:else}
		<div class="empty">
			<h1 class="empty-head">Could not load this brief</h1>
			<p class="empty-text">An error occurred while loading the brief. Please try again.</p>
			<a class="btn btn-sm font-mono" href="/app/brief">Return to the brief list</a>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.back {
		display: inline-block;
		font-size: 0.78rem;
		color: var(--ink-soft);
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		padding: 0.35rem 0.7rem;
		border: 1px solid transparent;
		margin-bottom: 1.25rem;
	}

	.back:hover {
		color: var(--ink);
		background: var(--paper-shelf);
	}

	.back:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.detail {
		display: grid;
		gap: 1.5rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: 2rem;
		align-items: start;
	}

	.main {
		display: grid;
		gap: 0;
		min-width: 0;
	}

	.side {
		position: sticky;
		top: 5rem;
	}

	.empty {
		display: grid;
		place-items: center;
		gap: 0.5rem;
		padding: 4rem 1.5rem;
		text-align: center;
		border: 1px dashed var(--rule-soft);
		background: var(--paper);
	}

	.empty-head {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.85rem;
		color: var(--ink);
		margin: 0;
		letter-spacing: -0.005em;
	}

	.empty-text {
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--ink-soft);
		margin: 0 0 0.75rem;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.side {
			position: static;
		}
	}

	@media (max-width: 700px) {
		.page {
			padding-inline: 1rem;
		}
	}
</style>
