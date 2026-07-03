<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { AlertDialog, Button, Dialog, Input, Select } from '$lib/components/ui';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';

	type Semester = { id: string; term: string; year: number; order: number };

	let { data }: { data: { semesters: Semester[] } } = $props();

	let semesters = $derived(data.semesters);

	let showModal = $state<'add' | 'edit' | null>(null);
	let editing = $state<Semester | null>(null);
	let form = $state({ term: 'Fall', year: new Date().getFullYear(), order: 0 });
	let saving = $state(false);
	let deleteConfirm = $state<string | null>(null);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	const TERMS = ['Fall', 'Spring', 'Summer'];

	const sorted = $derived([...semesters].sort((a, b) => b.order - a.order));

	const termFilter = $derived($page.url.searchParams.get('term'));
	const focusedTerm = $derived(
		termFilter ? (sorted.find((s) => s.id === termFilter) ?? null) : null
	);
	const headerTerm = $derived(
		focusedTerm ? `${focusedTerm.term} ${focusedTerm.year}` : 'All terms'
	);
	const taglineCount = $derived(focusedTerm ? 1 : semesters.length);
	const taglineSuffix = $derived(focusedTerm ? 'in focus' : 'in the catalog');
	const visibleSemesters = $derived(focusedTerm ? [focusedTerm] : sorted);

	async function save() {
		saving = true;
		error = null;
		success = null;
		try {
			if (showModal === 'add') {
				const res = await fetch('/api/semesters', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: crypto.randomUUID(),
						term: form.term,
						year: form.year,
						order: form.order
					})
				});
				if (!res.ok) throw new Error('Failed to create semester');
				success = 'Semester created';
			} else if (showModal === 'edit' && editing) {
				const res = await fetch('/api/semesters', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: editing.id, ...form })
				});
				if (!res.ok) throw new Error('Failed to update semester');
				success = 'Semester updated';
			}
			closeModal();
			await invalidateAll();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		saving = true;
		error = null;
		success = null;
		try {
			const res = await fetch('/api/semesters', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) throw new Error('Failed to delete semester');
			deleteConfirm = null;
			success = 'Semester deleted. Courses in this semester were also removed.';
			await invalidateAll();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	function openAdd() {
		form = {
			term: 'Fall',
			year: new Date().getFullYear(),
			order: sorted.length > 0 ? sorted[0].order + 1 : 1
		};
		editing = null;
		error = null;
		showModal = 'add';
	}

	function openEdit(s: Semester) {
		form = { term: s.term, year: s.year, order: s.order };
		editing = s;
		error = null;
		showModal = 'edit';
	}

	function closeModal() {
		showModal = null;
		editing = null;
	}
</script>

<svelte:head><title>Synapse · Semesters</title></svelte:head>

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-display">Semesters</h1>
		<p class="page-tagline">
			<span class="tagline-num">{taglineCount}</span> semester{taglineCount === 1 ? '' : 's'}
			{taglineSuffix}
		</p>
		<div class="page-actions">
			<Button onclick={openAdd}>+ new semester</Button>
		</div>
	</div>

	{#if error}
		<p class="toast error">{error}</p>
	{/if}
	{#if success}
		<p class="toast success">{success}</p>
	{/if}

	<SectionHead
		eyebrow={`${visibleSemesters.length} ${visibleSemesters.length === 1 ? 'row' : 'rows'}`}
		title="In the catalog"
		meta="SORTED BY RECENCY"
	/>

	<div class="table-wrap surface-polaroid">
		<table class="data-table">
			<thead>
				<tr>
					<th>Term</th>
					<th>Year</th>
					<th class="cell-actions"></th>
				</tr>
			</thead>
			<tbody>
				{#each visibleSemesters as semester (semester.id)}
					<tr>
						<td class="cell-term font-display">{semester.term}</td>
						<td class="cell-year font-mono">{semester.year}</td>
						<td class="cell-actions">
							<Button size="sm" onclick={() => openEdit(semester)}>edit</Button>
							<Button size="sm" variant="danger" onclick={() => (deleteConfirm = semester.id)}
								>delete</Button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if visibleSemesters.length === 0}
			<p class="table-empty">
				{focusedTerm ? 'No matching term.' : 'No semesters yet. Create one to get started.'}
			</p>
		{/if}
	</div>
</div>

<AlertDialog
	open={deleteConfirm !== null}
	title="Delete semester?"
	description="This will also remove all courses in this semester. This cannot be undone."
	confirmLabel="Delete"
	busy={saving}
	onConfirm={() => (deleteConfirm ? remove(deleteConfirm) : undefined)}
	onCancel={() => (deleteConfirm = null)}
/>

<Dialog
	open={showModal !== null}
	title={showModal === 'add' ? 'New semester' : 'Edit semester'}
	class="modal"
	onOpenChange={(open) => {
		if (!open) closeModal();
	}}
>
	{#if error}
		<p class="toast error">{error}</p>
	{/if}

	<label class="field">
		<span class="field-label">Term</span>
		<Select
			value={form.term}
			options={TERMS.map((term) => ({ value: term, label: term }))}
			onValueChange={(value) => (form.term = value)}
		/>
	</label>

	<label class="field">
		<span class="field-label">Year</span>
		<Input type="number" class="field-input" bind:value={form.year} min="2020" max="2040" />
	</label>

	<label class="field">
		<span class="field-label">Order</span>
		<Input type="number" class="field-input" bind:value={form.order} placeholder="0" />
		<span class="field-hint">Higher = more recent</span>
	</label>

	<div class="modal-actions">
		<Button onclick={closeModal} disabled={saving}>Cancel</Button>
		<Button variant="primary" onclick={save} disabled={saving}>
			{saving ? 'Saving…' : showModal === 'add' ? 'Create' : 'Save'}
		</Button>
	</div>
</Dialog>

<style>
	.page {
		max-width: var(--page-width);
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

	.page-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.toast {
		padding: 0.6rem 0.9rem;
		font-size: 0.8rem;
		margin-bottom: 1rem;
		border: 1px solid;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.toast.error {
		background: var(--paper);
		color: var(--accent);
		border-color: var(--accent);
	}

	.toast.success {
		background: var(--paper);
		color: var(--ink);
		border-color: var(--ink);
	}

	.table-wrap {
		padding: 0;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.7rem 0.85rem;
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
		background: var(--paper-shelf);
		border-bottom: 1px solid var(--ink);
	}

	.data-table td {
		padding: 0.7rem 0.85rem;
		border-bottom: 1px solid var(--rule);
		color: var(--ink-soft);
	}

	.data-table tr:last-child td {
		border-bottom: none;
	}

	.data-table tr:hover td {
		background: var(--paper-shelf);
	}

	.cell-term {
		font-size: 1rem;
		font-weight: 500;
		color: var(--ink);
	}

	.cell-year {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.cell-actions {
		width: 9rem;
		text-align: right;
	}

	.table-empty {
		padding: 2rem;
		text-align: center;
		color: var(--ink-faint);
		font-size: 0.85rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.85rem;
	}

	.field-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.field-hint {
		font-size: 0.7rem;
		color: var(--ink-faint);
	}

	.modal-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 1.25rem;
	}
</style>
