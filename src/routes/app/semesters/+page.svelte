<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Semesters · Synapse</title></svelte:head>
<div class="page-enter mx-auto max-w-[var(--page-width)] pt-8 pb-16">
	<h1 class="page-title mb-3">Semesters</h1>
	<p class="m-0 mb-5 max-w-[34rem] text-[var(--ink-soft)]">
		No semesters yet. The setup wizard walks you through picking your terms and adding your first
		courses.
	</p>
	<a class="btn setup-action" href={resolve('/app/setup')}>Set up semesters</a>
</div>
