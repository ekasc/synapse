<script lang="ts">
	import { onMount } from 'svelte';

	type PushStatus = 'checking' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'error';

	let status = $state<PushStatus>('checking');
	let busy = $state(false);
	let message = $state('');

	const supported =
		typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

	function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
		const padding = '='.repeat((4 - (base64.length % 4)) % 4);
		const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
		const raw = atob(normalized);
		const output = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
		return output;
	}

	async function refreshStatus() {
		if (!supported) {
			status = 'unsupported';
			return;
		}
		const registration = await navigator.serviceWorker.getRegistration('/sw.js');
		const subscription = await registration?.pushManager.getSubscription();
		if (subscription) {
			status = 'subscribed';
		} else if (Notification.permission === 'denied') {
			status = 'denied';
		} else {
			status = 'unsubscribed';
		}
	}

	async function enable() {
		busy = true;
		message = '';
		try {
			const registration = await navigator.serviceWorker.register('/sw.js');
			const vapidResponse = await fetch('/api/weekly-push/vapid');
			const vapid = (await vapidResponse.json()) as { publicKey?: string };
			if (!vapid.publicKey) {
				status = 'error';
				message = 'Push is not configured on the server yet (missing VAPID key).';
				return;
			}
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				status = 'denied';
				message = 'Notifications are blocked. Allow them in your browser settings and try again.';
				return;
			}
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
			});
			const json = subscription.toJSON();
			if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
				throw new Error('incomplete subscription');
			}
			const response = await fetch('/api/weekly-push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
			});
			if (!response.ok) throw new Error('subscribe failed');
			status = 'subscribed';
			message = 'Done — the weekly plan will be pushed every Monday morning.';
		} catch {
			status = 'error';
			message = 'Could not enable push notifications.';
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		message = '';
		try {
			const registration = await navigator.serviceWorker.getRegistration('/sw.js');
			const subscription = await registration?.pushManager.getSubscription();
			if (subscription) {
				await fetch('/api/weekly-push/unsubscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});
				await subscription.unsubscribe();
			}
			status = 'unsubscribed';
			message = 'Push notifications are off.';
		} catch {
			status = 'error';
			message = 'Could not disable push notifications.';
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		void refreshStatus();
	});
</script>

<svelte:head><title>Synapse · Settings</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-display">Settings</h1>
		<p class="page-tagline">Account and preferences</p>
	</div>

	<section class="panel" aria-label="Weekly plan push">
		<div class="panel-head">
			<h2 class="panel-title">Weekly plan push</h2>
			<p class="panel-copy">
				Every Monday morning, Synapse pushes this week’s priorities, deadlines, and crunch windows
				to this browser. The plan itself is always the deterministic digest — the push just delivers
				it.
			</p>
		</div>
		<div class="panel-row">
			<div class="panel-state">
				<span class="state-kicker">Status</span>
				<span class="state-value" data-status={status}>
					{#if status === 'checking'}
						checking…
					{:else if status === 'unsupported'}
						not supported in this browser
					{:else if status === 'denied'}
						notifications blocked
					{:else if status === 'subscribed'}
						subscribed
					{:else if status === 'error'}
						something went wrong
					{:else}
						not subscribed
					{/if}
				</span>
			</div>
			<div class="panel-actions">
				{#if status === 'subscribed'}
					<button class="btn btn-danger btn-sm" disabled={busy} onclick={() => void disable()}>
						Turn off push
					</button>
				{:else if status !== 'checking' && status !== 'unsupported'}
					<button class="btn btn-primary btn-sm" disabled={busy} onclick={() => void enable()}>
						{status === 'denied' ? 'Try again' : 'Enable push'}
					</button>
				{/if}
			</div>
		</div>
		{#if message}
			<p class="panel-message" role="status">{message}</p>
		{/if}
		{#if status === 'unsupported'}
			<p class="panel-hint">
				This browser does not support Web Push. The weekly plan stays available at Weekly Plan in
				the sidebar.
			</p>
		{/if}
	</section>
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

	.panel {
		max-width: 40rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 1.25rem 1.4rem;
		display: grid;
		gap: 1rem;
	}

	.panel-title {
		font-family: var(--font-hand);
		font-weight: 700;
		font-size: 1.35rem;
		color: var(--ink);
		margin: 0 0 0.35rem;
	}

	.panel-copy {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.panel-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		border-top: 1px dashed var(--rule-soft);
		padding-top: 0.9rem;
	}

	.panel-state {
		display: grid;
		gap: 0.2rem;
	}

	.state-kicker {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}

	.state-value {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink);
	}
	.state-value[data-status='subscribed'] {
		color: var(--ok);
	}
	.state-value[data-status='denied'],
	.state-value[data-status='error'] {
		color: var(--pen-red);
	}

	.panel-message {
		margin: 0;
		border: 1px dashed var(--rule-soft);
		background: var(--paper-shelf);
		color: var(--ink-soft);
		font-size: 0.85rem;
		line-height: 1.5;
		padding: 0.6rem 0.8rem;
	}

	.panel-hint {
		margin: 0;
		color: var(--ink-faint);
		font-size: 0.8rem;
		line-height: 1.5;
	}
</style>
