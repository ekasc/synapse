<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
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
		goto(resolveRoute('/app/brief'));
	}
</script>

<svelte:head><title>Synapse · {data.code}</title></svelte:head>

<div class="page-enter mx-auto max-w-[var(--page-width)] pt-8 pb-16 max-[700px]:px-4">
	<a
		class="mb-5 inline-block border border-transparent px-[0.7rem] py-[0.35rem] text-[var(--ink-soft)] text-[var(--text-caption)] no-underline hover:bg-[var(--paper-shelf)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
		href={resolveRoute('/app/brief')}>← back to all briefs</a
	>

	{#if data.state === 'found' && data.detail}
		{@const d = data.detail}
		<article class="grid gap-6">
			<DetailHero brief={d} />
			<div class="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-8 max-[900px]:grid-cols-1">
				<div class="grid min-w-0 gap-0">
					<DetailNarrative brief={d} />
					<ActionRow
						courseCode={d.courseCode}
						courseTitle={d.title}
						professorName={d.professor.requestedName}
						institution={d.institution}
						{onDeleted}
					/>
				</div>
				<div class="sticky top-20 max-[900px]:static">
					<DetailSidebar brief={d} />
				</div>
			</div>
		</article>
	{:else if data.state === 'not_found'}
		<div
			class="grid place-items-center gap-2 border border-dashed border-[var(--rule-soft)] bg-[var(--paper)] px-6 py-16 text-center"
		>
			<h1
				class="m-0 font-[family-name:var(--font-body)] text-[1.85rem] font-bold tracking-[-0.005em] text-[var(--ink)]"
			>
				Brief not found
			</h1>
			<p class="mt-0 mb-3 font-[family-name:var(--font-body)] text-base text-[var(--ink-soft)]">
				This brief may have been deleted or the link may be invalid.
			</p>
			<a class="btn btn-sm" href={resolveRoute('/app/brief')}>Return to all briefs</a>
		</div>
	{:else}
		<div
			class="grid place-items-center gap-2 border border-dashed border-[var(--rule-soft)] bg-[var(--paper)] px-6 py-16 text-center"
		>
			<h1
				class="m-0 font-[family-name:var(--font-body)] text-[1.85rem] font-bold tracking-[-0.005em] text-[var(--ink)]"
			>
				Could not load this brief
			</h1>
			<p class="mt-0 mb-3 font-[family-name:var(--font-body)] text-base text-[var(--ink-soft)]">
				An error occurred while loading the brief. Please try again.
			</p>
			<a class="btn btn-sm" href={resolveRoute('/app/brief')}>Return to the brief list</a>
		</div>
	{/if}
</div>
