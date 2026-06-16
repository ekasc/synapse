<script lang="ts">
	let { data } = $props();
</script>

<div class="page">
	<div class="page-heading">
		<h1 class="page-title font-hand">Weekly Digest</h1>
		<p class="page-subtitle">Your week in the graph</p>
	</div>

	<div class="empty-state">
		<span class="empty-icon">◶</span>
		<p class="empty-text">No digests yet. They generate automatically once you have active courses with grades and deadlines.</p>
		<p class="empty-hint font-mono">ai-generated · changes each week</p>
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
