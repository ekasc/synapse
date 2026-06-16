<script lang="ts">
	let { data } = $props();
</script>

<div class="page">
	<div class="page-heading">
		<h1 class="page-title font-hand">Settings</h1>
		<p class="page-subtitle">Manage your account and preferences</p>
	</div>

	<div class="settings-list">
		<div class="setting-item">
			<div class="setting-info">
				<span class="setting-label">Semesters</span>
				<span class="setting-desc font-mono">manage your academic terms</span>
			</div>
			<span class="setting-status font-mono">coming soon</span>
		</div>
		<div class="setting-item">
			<div class="setting-info">
				<span class="setting-label">Data</span>
				<span class="setting-desc font-mono">import/export your course data</span>
			</div>
			<span class="setting-status font-mono">coming soon</span>
		</div>
		<div class="setting-item">
			<div class="setting-info">
				<span class="setting-label">Notifications</span>
				<span class="setting-desc font-mono">digest and deadline alerts</span>
			</div>
			<span class="setting-status font-mono">coming soon</span>
		</div>
	</div>
</div>

<style>
	.page { max-width: 520px; }
	.page-heading { margin-bottom: 2rem; }
	.page-title { font-size: 2rem; color: var(--ink); margin: 0 0 0.25rem; line-height: 1; }
	.page-subtitle { color: var(--ink-soft); font-size: 0.9rem; margin: 0; }

	.settings-list {
		display: flex;
		flex-direction: column;
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 0;
		border-bottom: 1px solid rgba(26, 26, 23, 0.08);
	}

	.setting-label {
		font-size: 0.95rem;
		color: var(--ink);
	}

	.setting-desc {
		font-size: 0.85rem;
		color: var(--ink-soft);
		display: block;
		margin-top: 2px;
	}

	.setting-status {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink-soft);
	}
</style>
