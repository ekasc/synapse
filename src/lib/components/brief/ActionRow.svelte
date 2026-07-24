<script lang="ts">
	import { goto } from '$app/navigation';

	let {
		courseCode,
		courseTitle,
		professorName,
		institution,
		onDeleted
	}: {
		courseCode: string;
		courseTitle?: string;
		professorName?: string | null;
		institution?: string;
		onDeleted?: () => void;
	} = $props();

	let confirming = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	async function confirmDelete() {
		deleting = true;
		deleteError = null;
		try {
			const res = await fetch(`/api/brief?code=${encodeURIComponent(courseCode)}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error('delete failed');
			confirming = false;
			onDeleted?.();
		} catch {
			deleteError = 'Could not delete this brief.';
		} finally {
			deleting = false;
		}
	}

	async function refreshResearch() {
		const params = new URLSearchParams({ code: courseCode });
		if (courseTitle) params.set('name', courseTitle);
		if (professorName) params.set('prof', professorName);
		if (institution) params.set('inst', institution);
		await goto(`/app/brief?${params.toString()}`);
	}
</script>

<div class="action-row">
	{#if deleteError}
		<span class="error font-mono">{deleteError}</span>
	{/if}
	{#if confirming}
		<span class="confirm-label font-mono">Delete this brief?</span>
		<button class="btn btn-sm btn-ghost" type="button" onclick={() => (confirming = false)}>
			cancel
		</button>
		<button class="btn btn-sm btn-danger" type="button" onclick={confirmDelete} disabled={deleting}>
			{deleting ? 'deleting…' : 'delete'}
		</button>
	{:else}
		<button class="btn btn-sm btn-ghost" type="button" onclick={refreshResearch}>
			Refresh research
		</button>
		<button class="btn btn-sm btn-danger" type="button" onclick={() => (confirming = true)}>
			Delete brief
		</button>
	{/if}
</div>

<style>
	.action-row {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.5rem;
		padding-top: 1.5rem;
		margin-top: 2rem;
		border-top: 1px solid var(--rule-soft);
	}

	.confirm-label {
		font-size: 0.85rem;
		color: var(--pen-red);
		margin-right: auto;
	}

	.error {
		font-size: 0.85rem;
		color: var(--pen-red);
		margin-right: auto;
	}
</style>
