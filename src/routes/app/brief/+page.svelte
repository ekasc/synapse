<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
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
		goto(resolveRoute(`/app/brief/${encodeURIComponent(code)}`));
	}
</script>

<svelte:head><title>Briefs · Synapse</title></svelte:head>

<div class="page-enter mx-auto max-w-[var(--page-width)] pt-8 pb-16 max-[700px]:px-4">
	<header
		class="flex items-end justify-between gap-4 border-b border-[var(--rule)] pb-2 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-2"
	>
		<div>
			<h1
				class="m-0 font-[family-name:var(--font-body)] text-[1.75rem] leading-[1.1] font-bold tracking-[-0.01em] text-[var(--ink)]"
			>
				Course briefs
			</h1>
			<p
				class="mt-1 mb-0 font-[family-name:var(--font-body)] text-[var(--ink-soft)] text-[var(--text-small)]"
			>
				Research notes for courses you're considering
			</p>
		</div>
		<div class=" text-[var(--ink-faint)] text-[var(--text-caption)]">
			{briefs.length}
			{briefs.length === 1 ? 'brief' : 'briefs'}
		</div>
	</header>

	<div class="mt-4">
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
		<section class="mt-4 block" aria-label="Briefed courses">
			{#each briefs as brief (brief.courseCode)}
				<NotebookEntry {brief} />
			{/each}
		</section>
	{:else}
		<section class="mt-4 block" aria-label="Briefed courses">
			<EmptyState />
		</section>
	{/if}
</div>
