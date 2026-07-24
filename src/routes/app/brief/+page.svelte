<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import ResearchSlip from '$lib/components/brief/ResearchSlip.svelte';
	import NotebookEntry from '$lib/components/brief/NotebookEntry.svelte';
	import EmptyState from '$lib/components/brief/EmptyState.svelte';
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

	let {
		data
	}: {
		data: {
			briefs: BriefingDetailViewModel[];
		};
	} = $props();

	const briefs = $derived(data.briefs ?? []);

	const refreshParams = $derived.by(() => {
		if (!browser) return null;
		const params = new URLSearchParams(window.location.search);
		const code = params.get('code');
		if (!code) return null;
		return {
			code,
			name: params.get('name') ?? '',
			prof: params.get('prof') ?? '',
			inst: params.get('inst') ?? ''
		};
	});

	const slipKey = $derived(refreshParams?.code ?? 'fresh');

	$effect(() => {
		if (refreshParams && browser) {
			window.history.replaceState({}, '', '/app/brief');
		}
	});

	function handleSlipSuccess(code: string) {
		goto(`/app/brief/${encodeURIComponent(code)}`);
	}
</script>

<svelte:head><title>Synapse · Course briefs</title></svelte:head>

<div class="page page-enter">
	<div class="slip-slot">
		{#key slipKey}
			<ResearchSlip
				onSuccess={handleSlipSuccess}
				initialCode={refreshParams?.code ?? ''}
				initialName={refreshParams?.name ?? ''}
				initialProfessor={refreshParams?.prof ?? ''}
				initialInstitution={refreshParams?.inst ?? ''}
				autoStart={refreshParams != null}
			/>
		{/key}
	</div>

	{#if briefs.length > 0}
		<header class="page-head">
			<div>
				<h1 class="page-title">Course briefs</h1>
				<p class="page-tagline">Syllabus intelligence for courses you're considering</p>
			</div>
			<div class="count font-mono">{briefs.length} {briefs.length === 1 ? 'entry' : 'entries'}</div>
		</header>

		<section class="library" aria-label="Briefed courses">
			{#each briefs as brief (brief.courseCode)}
				<NotebookEntry {brief} />
			{/each}
		</section>
	{:else}
		<section class="library" aria-label="Briefed courses">
			<EmptyState />
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.slip-slot {
		position: sticky;
		top: 0;
		z-index: 50;
		background: var(--paper);
		padding: 0.5rem 0 1rem;
		margin: -0.5rem 0 0;
	}

	.page-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		padding: 0 0 0.5rem;
		border-bottom: 1px solid var(--rule);
		margin-top: 0.5rem;
	}

	.page-title {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.75rem;
		line-height: 1.1;
		color: var(--ink);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.page-tagline {
		font-family: var(--font-body);
		font-size: 0.95rem;
		color: var(--ink-soft);
		margin: 0.25rem 0 0;
	}

	.count {
		font-size: 0.78rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.library {
		display: block;
		margin-top: 0;
	}

	@media (max-width: 700px) {
		.page {
			padding-inline: 1rem;
		}
		.page-head {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
	}
</style>
