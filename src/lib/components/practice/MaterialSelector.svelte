<script lang="ts">
	type Material = {
		id: string;
		fileName: string;
	};

	let {
		materials,
		selectedIds,
		ontoggle
	}: {
		materials: Material[];
		selectedIds: string[];
		ontoggle: (id: string) => void;
	} = $props();

	const allSelected = $derived(selectedIds.length === materials.length);

	function toggleAll() {
		if (allSelected) {
			for (const m of materials) ontoggle(m.id);
		} else {
			const toAdd = materials.filter((m) => !selectedIds.includes(m.id));
			for (const m of toAdd) ontoggle(m.id);
		}
	}
</script>

<fieldset class="material-scope">
	<div class="material-scope-head">
		<legend>Use course materials</legend>
		{#if materials.length > 1}
			<button type="button" class="material-scope-toggle" onclick={toggleAll}>
				{allSelected ? 'clear all' : 'select all'}
			</button>
		{/if}
	</div>
	<div class="material-options">
		{#each materials as material (material.id)}
			<label class="material-option">
				<input
					type="checkbox"
					checked={selectedIds.includes(material.id)}
					onchange={() => ontoggle(material.id)}
				/>
				<span>{material.fileName}</span>
			</label>
		{/each}
	</div>
	{#if selectedIds.length === 0}
		<p class="material-scope-error">Select at least one course material.</p>
	{/if}
</fieldset>

<style>
	.material-scope {
		padding: 0;
		margin: 0 0 1rem;
		border: 0;
	}

	.material-scope-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.45rem;
	}

	.material-scope legend {
		padding: 0;
		color: var(--ink);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.material-scope-toggle {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		font: 0.72rem var(--font-mono);
		text-decoration: underline;
		text-underline-offset: 0.2rem;
		cursor: pointer;
	}

	.material-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
		gap: 0.4rem;
	}

	.material-option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--ink);
		font-size: 0.82rem;
		cursor: pointer;
	}

	.material-option input {
		accent-color: var(--ink);
	}

	.material-option span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.material-scope-error {
		margin: 0.45rem 0 0;
		color: var(--accent);
		font-size: 0.78rem;
	}
</style>
