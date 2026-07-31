<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';

	let {
		open = $bindable(false),
		term = $bindable('Spring' as string),
		year = $bindable(new Date().getFullYear()),
		error = $bindable(''),
		saving = $bindable(false),
		termChoices = ['Winter', 'Spring', 'Summer', 'Fall'] as readonly string[],
		onsave
	}: {
		open?: boolean;
		term?: string;
		year?: number;
		error?: string;
		saving?: boolean;
		termChoices?: readonly string[];
		onsave: () => Promise<void>;
	} = $props();
</script>

{#if open}
	<Dialog bind:open title="Add semester" description="Choose a term and year to get started.">
		<form
			class="semester-form mt-4 grid gap-4"
			onsubmit={(event) => {
				event.preventDefault();
				void onsave();
			}}
		>
			<fieldset class="m-0 border-0 p-0">
				<legend class="mb-1 text-[var(--text-caption)]">Term</legend>
				<div class="term-buttons flex gap-2">
					{#each termChoices as choice (choice)}
						<button
							type="button"
							aria-pressed={term === choice}
							class="cursor-pointer border border-[var(--rule)] bg-[var(--paper)] px-[0.8rem] py-[0.55rem] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
							onclick={() => (term = choice)}
						>
							{choice}
						</button>
					{/each}
				</div>
			</fieldset>
			<label class="grid gap-[0.4rem] text-[var(--text-caption)]"
				>Year<input
					class="border border-[var(--rule)] bg-[var(--paper)] p-[0.6rem] font-[inherit]"
					type="number"
					min="2000"
					max="2100"
					bind:value={year}
				/></label
			>
			{#if error}
				<p class="form-error m-0 text-[var(--pen-red)] text-[var(--text-caption)]" role="alert">
					{error}
				</p>
			{/if}
			<button class="btn btn-primary" type="submit" disabled={saving}
				>{saving ? 'Saving…' : 'Add semester'}</button
			>
		</form>
	</Dialog>
{/if}
