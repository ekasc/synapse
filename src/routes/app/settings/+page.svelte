<script lang="ts">
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';

	type GoogleStatus = { connected?: boolean; syncedCount?: number };

	let googleStatus = $state<'loading' | 'connected' | 'disconnected'>('loading');
	let syncedCount = $state(0);
	let connecting = $state(false);

	async function checkStatus() {
		try {
			const resp = await fetch('/api/calendar/google/status');
			const data: GoogleStatus = await resp.json();
			if (data.connected) {
				googleStatus = 'connected';
				syncedCount = data.syncedCount ?? 0;
			} else {
				googleStatus = 'disconnected';
			}
		} catch {
			googleStatus = 'disconnected';
		}
	}

	$effect(() => {
		checkStatus();
	});

	async function handleConnect() {
		connecting = true;
		window.location.href = '/api/calendar/google/authorize';
	}

	async function handleDisconnect() {
		if (!confirm('Disconnect Google Calendar? Synced events will remain in your Google Calendar.'))
			return;
		try {
			const resp = await fetch('/api/calendar/google/disconnect', { method: 'POST' });
			const data: { ok?: boolean } = await resp.json();
			if (data.ok) {
				googleStatus = 'disconnected';
				syncedCount = 0;
			}
		} catch (err) {
			console.error('Disconnect failed:', err);
		}
	}
</script>

<svelte:head><title>Synapse · Settings</title></svelte:head>

<CatalogHeader term="Account" />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Settings</h1>
		<p class="page-tagline">Account and preferences</p>
	</div>

	<!-- Google Calendar Integration -->
	<section class="settings-section">
		<h2 class="settings-section-title font-display">Integrations</h2>

		<div class="settings-card surface">
			<div class="settings-card-row">
				<div class="settings-card-info">
					<h3 class="settings-card-name">Google Calendar</h3>
					<p class="settings-card-desc">
						Sync course deadlines to your Google Calendar and view Google Calendar events in Synapse.
					</p>
				</div>

				<div class="settings-card-status">
					{#if googleStatus === 'loading'}
						<span class="status-chip idle">Checking…</span>
					{:else if googleStatus === 'connected'}
						<div class="gcal-connected">
							<span class="gcal-dot"></span>
							<div>
								<span class="gcal-label">Connected</span>
								{#if syncedCount > 0}
									<span class="gcal-sub">{syncedCount} event{syncedCount !== 1 ? 's' : ''} synced</span>
								{/if}
							</div>
						</div>
					{:else}
						<div class="gcal-disconnected">
							<span class="gcal-label">Not connected</span>
						</div>
					{/if}
				</div>
			</div>

			<div class="settings-card-actions">
				{#if googleStatus === 'connected'}
					<button
						type="button"
						class="btn btn-sm btn-danger"
						onclick={handleDisconnect}
					>
						Disconnect
					</button>
				{:else if googleStatus === 'disconnected'}
					<button
						type="button"
						class="btn btn-sm"
						onclick={handleConnect}
						disabled={connecting}
					>
						{connecting ? 'Connecting…' : 'Connect'}
					</button>
				{/if}
			</div>
		</div>

		<div class="settings-hint">
			<p>To connect, you need a Google Calendar and Google Cloud OAuth credentials configured for this app.</p>
			<ol class="settings-steps">
				<li>Create OAuth 2.0 credentials at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
				<li>Add <code class="settings-code">http://localhost:5173/api/calendar/google/callback</code> as an authorized redirect URI</li>
				<li>Enable the Google Calendar API for your project</li>
				<li>Set <code class="settings-code">GOOGLE_CLIENT_ID</code> and <code class="settings-code">GOOGLE_CLIENT_SECRET</code> in your <code class="settings-code">.env</code></li>
			</ol>
		</div>
	</section>
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

	.settings-section {
		margin-top: 2rem;
	}

	.settings-section-title {
		font-size: 1.25rem;
		color: var(--ink);
		margin: 0 0 1rem;
	}

	.settings-card {
		padding: 1.25rem;
	}

	.settings-card-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.settings-card-info {
		flex: 1;
		min-width: 200px;
	}

	.settings-card-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink);
		margin: 0 0 0.35rem;
	}

	.settings-card-desc {
		font-size: 0.85rem;
		color: var(--ink-soft);
		margin: 0;
		line-height: 1.5;
	}

	.settings-card-status {
		flex-shrink: 0;
	}

	.gcal-connected {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.gcal-dot {
		width: 8px;
		height: 8px;
		background: #4285F4;
		flex-shrink: 0;
	}

	.gcal-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--ink);
	}

	.gcal-sub {
		display: block;
		font-size: 0.75rem;
		color: var(--ink-faint);
		margin-top: 2px;
	}

	.gcal-disconnected .gcal-label {
		color: var(--ink-soft);
	}

	.settings-card-actions {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--rule);
	}

	.settings-hint {
		margin-top: 1rem;
		padding: 1rem 1.25rem;
		background: var(--paper-shelf);
		border: 1px solid var(--rule);
		font-size: 0.82rem;
		color: var(--ink-soft);
		line-height: 1.6;
	}

	.settings-hint p {
		margin: 0 0 0.5rem;
	}

	.settings-steps {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
	}

	.settings-steps li {
		margin-bottom: 0.3rem;
	}

	.settings-code {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		background: var(--paper);
		padding: 0.1rem 0.3rem;
		border: 1px solid var(--rule);
	}

	.settings-hint a {
		color: var(--ink);
	}
</style>
