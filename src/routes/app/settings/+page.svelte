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

	<div class="empty-state surface">
		<h2 class="empty-head font-hand">No settings yet</h2>
		<p class="empty-text">Account and preference controls will appear here.</p>
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

	.empty-state {
		padding: 3rem 2rem;
		text-align: center;
	}

	.empty-head {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem;
		color: var(--ink);
	}

	.empty-text {
		font-size: 0.92rem;
		color: var(--ink-soft);
		margin: 0;
	}
</style>
