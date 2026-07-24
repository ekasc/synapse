<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Semesters · Synapse</title></svelte:head>
<div class="page page-enter">
	<h1 class="page-title">Semesters</h1>
	<p class="body-copy">
		No semesters yet. The setup wizard walks you through picking your terms and adding your first
		courses.
	</p>
	<a class="btn setup-action" href={resolve('/app/setup')}>Set up semesters</a>
</div>

<style>
	.page {
		max-width: var(--page-width);
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}
	.page-title {
		margin: 0 0 0.75rem;
	}
	.body-copy {
		color: var(--ink-soft);
		margin: 0 0 1.25rem;
		max-width: 34rem;
	}
</style>
