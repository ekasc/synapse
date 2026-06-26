<script lang="ts">
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
</script>

<svelte:head><title>Synapse · Settings</title></svelte:head>

<CatalogHeader term="Account" />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Settings</h1>
		<p class="page-tagline">Account and preferences</p>
	</div>
</div>

<style>
	.page {
		max-width: 900px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
	}
</style>
