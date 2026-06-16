<script lang="ts">
	let { data } = $props();
</script>

<div class="page">
	<div class="page-heading">
		<h1 class="page-title font-hand">Calendar</h1>
		<p class="page-subtitle">Every deadline across every course</p>
	</div>

	<div class="empty-state">
		<span class="empty-icon">◷</span>
		<p class="empty-text">Calendar integration — coming once you have courses with deadlines.</p>
		<p class="empty-hint font-mono">google calendar sync: planned</p>
	</div>
</div>

<style>
	.page { max-width: 720px; }
	.page-heading { margin-bottom: 2rem; }
	.page-title { font-size: 2rem; color: var(--ink); margin: 0 0 0.25rem; line-height: 1; }
	.page-subtitle { color: var(--ink-soft); font-size: 0.9rem; margin: 0; }
	.empty-state { border: 1.5px dashed var(--ink-faint); border-radius: 8px; padding: 3rem 2rem; text-align: center; }
	.empty-icon { font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.75rem; }
	.empty-text { color: var(--ink-soft); margin: 0 0 0.25rem; }
	.empty-hint { font-family: var(--font-hand); font-size: 0.95rem; color: var(--ink-soft); margin: 0; }
</style>
