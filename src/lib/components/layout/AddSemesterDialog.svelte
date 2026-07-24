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
			class="semester-form"
			onsubmit={(event) => {
				event.preventDefault();
				void onsave();
			}}
		>
			<fieldset>
				<legend>Term</legend>
				<div class="term-buttons">
					{#each termChoices as choice}
						<button
							type="button"
							aria-pressed={term === choice}
							class:chosen={term === choice}
							onclick={() => (term = choice)}
						>
							{choice}
						</button>
					{/each}
				</div>
			</fieldset>
			<label>Year<input type="number" min="2000" max="2100" bind:value={year} /></label>
			{#if error}
				<p class="form-error" role="alert">{error}</p>
			{/if}
			<button class="btn btn-primary" type="submit" disabled={saving}
				>{saving ? 'Saving…' : 'Add semester'}</button
			>
		</form>
	</Dialog>
{/if}

<style>
	.semester-form {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	.semester-form fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}

	.semester-form legend,
	.semester-form label {
		display: grid;
		gap: 0.4rem;
		font-size: 0.85rem;
	}

	.term-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.term-buttons button {
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		cursor: pointer;
	}

	.term-buttons button.chosen {
		background: var(--ink);
		color: var(--paper);
	}

	.semester-form input {
		padding: 0.6rem;
		border: 1px solid var(--rule);
		background: var(--paper);
		font: inherit;
	}

	.form-error {
		margin: 0;
		color: var(--pen-red);
		font-size: 0.85rem;
	}
</style>
