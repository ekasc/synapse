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

<fieldset class="m-0 mb-4 border-0 p-0">
	<div class="mb-[0.45rem] flex items-baseline justify-between gap-4">
		<legend class="p-0 font-semibold text-[var(--ink)] text-[var(--text-caption)]"
			>Use course materials</legend
		>
		{#if materials.length > 1}
			<button
				type="button"
				class="cursor-pointer border-0 bg-transparent p-0 text-[length:var(--text-caption)] leading-[1.4] text-[var(--ink-soft)] underline underline-offset-[0.2rem]"
				onclick={toggleAll}
			>
				{allSelected ? 'clear all' : 'select all'}
			</button>
		{/if}
	</div>
	<div class="grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-[0.4rem]">
		{#each materials as material (material.id)}
			<label
				class="flex min-w-0 cursor-pointer items-center gap-[0.55rem] border border-[var(--rule)] bg-[var(--paper)] px-[0.65rem] py-[0.55rem] text-[var(--ink)] text-[var(--text-caption)]"
			>
				<input
					class="accent-[var(--ink)]"
					type="checkbox"
					checked={selectedIds.includes(material.id)}
					onchange={() => ontoggle(material.id)}
				/>
				<span class="truncate">{material.fileName}</span>
			</label>
		{/each}
	</div>
	{#if selectedIds.length === 0}
		<p class="mt-[0.45rem] mb-0 text-[var(--accent)] text-[var(--text-caption)]">
			Select at least one course material.
		</p>
	{/if}
</fieldset>
