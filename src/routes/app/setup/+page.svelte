<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import SetupWizard from '$lib/components/setup/SetupWizard.svelte';

	let { data }: { data: { semesters: { id: string }[] } } = $props();

	$effect(() => {
		if (data.semesters.length > 0) {
			goto(resolveRoute('/app'), { replaceState: true });
		}
	});
</script>

<svelte:head><title>Synapse · Setup</title></svelte:head>

<div class="page">
	{#if data.semesters.length === 0}
		<SetupWizard />
	{/if}
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2.5rem 4rem;
	}
</style>
