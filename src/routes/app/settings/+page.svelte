<script lang="ts">
</script>

<svelte:head><title>Synapse · Settings</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-display">Settings</h1>
		<p class="page-tagline">Account and preferences</p>
	</div>
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2.5rem 4rem;
	}

	.page-cover {
		margin-bottom: 2.5rem;
		padding-bottom: 1.5rem;
	}

	.page-title {
		font-size: clamp(2rem, 4vw, 3.25rem);
		font-weight: 600;
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1.05;
		letter-spacing: -0.025em;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
		line-height: 1.5;
	}
</style>
