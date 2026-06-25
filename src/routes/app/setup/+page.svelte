<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SetupWizard from '$lib/components/setup/SetupWizard.svelte';

	let { data }: { data: { semesters: { id: string }[] } } = $props();

	$effect(() => {
		if (data.semesters.length > 0) {
			goto(resolveRoute('/app'), { replaceState: true });
		}
	});
</script>

<svelte:head><title>Synapse · Setup</title></svelte:head>

<CatalogHeader term="Setup" />

<div class="page">
	{#if data.semesters.length === 0}
		<SetupWizard />
	{/if}
</div>

<style>
	.page {
		max-width: 1100px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}
</style>
