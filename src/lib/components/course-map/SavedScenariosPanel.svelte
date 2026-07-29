<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { SharedScenarioReplayResult } from './sharing';
	import {
		associateSavedScenario,
		beginScenarioOperation,
		clearScenarioOperation,
		completeScenarioOperation,
		failScenarioOperation,
		type SavedScenarioAssociation,
		type ScenarioOperation,
		type ScenarioOperationState,
		type StoredMove,
		type StoredScenario
	} from './saved-scenarios';

	interface Props {
		moves: StoredMove[];
		association: SavedScenarioAssociation | null;
		dirty: boolean;
		onassociationchange: (association: SavedScenarioAssociation | null) => void;
		onloadscenario: (stored: StoredScenario) => SharedScenarioReplayResult;
	}

	let { moves, association, dirty, onassociationchange, onloadscenario }: Props = $props();
	let scenarios = $state<StoredScenario[]>([]);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let showSaveForm = $state(false);
	let name = $state('');
	let operationState = $state<ScenarioOperationState>(clearScenarioOperation());
	let busyOperation = $derived(operationState.kind === 'busy' ? operationState.operation : null);
	let renameId = $state<string | null>(null);
	let renameName = $state('');
	let deleteId = $state<string | null>(null);
	let pendingLoad = $state<StoredScenario | null>(null);
	let loadIssues = $state<SharedScenarioReplayResult | null>(null);
	let failedScenario = $derived(operationState.kind === 'failure' ? operationState.scenario : null);

	type ScenarioResponse = { scenario: StoredScenario };
	type ScenarioListResponse = { scenarios: StoredScenario[] };

	async function request<T>(url: string, options?: RequestInit): Promise<T> {
		const response = await fetch(url, options);
		const body: unknown = response.status === 204 ? null : await response.json();
		if (!response.ok) throw { status: response.status, body };
		return body as T;
	}

	function recordFailure(
		operation: ScenarioOperation,
		scenario: StoredScenario | null,
		message: string,
		error: unknown
	) {
		operationState = failScenarioOperation(
			operation,
			scenario,
			message,
			(error as { status?: number }).status === 409
		);
	}

	async function refresh() {
		operationState = beginScenarioOperation('list');
		status = 'loading';
		try {
			const body = await request<ScenarioListResponse>('/api/course-map/scenarios');
			scenarios = body.scenarios;
			status = 'ready';
			operationState = clearScenarioOperation();
		} catch (error) {
			status = 'error';
			recordFailure('list', null, 'Could not load the planning library.', error);
		}
	}

	onMount(refresh);

	async function openSave() {
		showSaveForm = true;
		name = association?.name ?? '';
		await tick();
		document.querySelector<HTMLInputElement>('#scenario-name')?.focus();
	}

	async function createSaved(
		copyName: string = name,
		copyMoves: StoredMove[] = moves,
		associate = true,
		operation: 'create' | 'duplicate' | 'recovery' = 'create',
		source: StoredScenario | null = null
	) {
		const trimmed = copyName.trim();
		if (!trimmed || copyMoves.length === 0) return;
		operationState = beginScenarioOperation(operation, source);
		try {
			const body = await request<ScenarioResponse>('/api/course-map/scenarios', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: trimmed, moves: copyMoves })
			});
			if (associate) onassociationchange(associateSavedScenario(body.scenario));
			showSaveForm = false;
			await refresh();
			operationState = completeScenarioOperation(
				operation,
				operation === 'duplicate' ? 'Draft plan duplicated' : 'Draft plan saved'
			);
		} catch (error) {
			recordFailure(operation, source, `Could not ${operation} draft plan.`, error);
		}
	}

	async function saveChanges() {
		if (!association) return;
		const target = scenarios.find(({ id }) => id === association.id) ?? {
			id: association.id,
			name: association.name,
			revision: association.revision,
			createdAt: '',
			updatedAt: '',
			moves
		};
		operationState = beginScenarioOperation('update', target);
		try {
			const body = await request<ScenarioResponse>(`/api/course-map/scenarios/${association.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: association.name,
					moves,
					expectedRevision: association.revision
				})
			});
			onassociationchange(associateSavedScenario(body.scenario));
			await refresh();
			operationState = completeScenarioOperation('update', 'Draft plan changes saved');
		} catch (error) {
			recordFailure('update', target, 'Could not save draft plan changes.', error);
		}
	}

	async function load(
		stored: StoredScenario,
		force = false,
		operation: 'load' | 'recovery' = 'load'
	) {
		if (!force && moves.length > 0 && (!association || dirty)) {
			pendingLoad = stored;
			return;
		}
		operationState = beginScenarioOperation(operation, stored);
		try {
			const body = await request<ScenarioResponse>(`/api/course-map/scenarios/${stored.id}`);
			onassociationchange(associateSavedScenario(body.scenario));
			pendingLoad = null;
			loadIssues = onloadscenario(body.scenario);
			operationState = completeScenarioOperation(
				operation,
				operation === 'recovery' ? 'Saved version restored' : 'Draft plan ready to compare'
			);
		} catch (error) {
			recordFailure(operation, stored, 'Could not load draft plan.', error);
		}
	}

	async function rename(stored: StoredScenario) {
		const trimmed = renameName.trim();
		if (!trimmed) return;
		operationState = beginScenarioOperation('rename', stored);
		try {
			const body = await request<ScenarioResponse>(`/api/course-map/scenarios/${stored.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: trimmed, expectedRevision: stored.revision })
			});
			if (association?.id === stored.id) onassociationchange(associateSavedScenario(body.scenario));
			renameId = null;
			await refresh();
			operationState = completeScenarioOperation('rename', 'Draft plan renamed');
		} catch (error) {
			recordFailure('rename', stored, 'Could not rename draft plan.', error);
		}
	}

	async function duplicate(stored: StoredScenario) {
		operationState = beginScenarioOperation('duplicate', stored);
		try {
			const body = await request<ScenarioResponse>(`/api/course-map/scenarios/${stored.id}`);
			const copyName = `${body.scenario.name} — Copy`.slice(0, 80);
			await createSaved(copyName, body.scenario.moves, false, 'duplicate', stored);
		} catch (error) {
			recordFailure('duplicate', stored, 'Could not duplicate draft plan.', error);
		}
	}

	async function remove(stored: StoredScenario) {
		operationState = beginScenarioOperation('delete', stored);
		try {
			await request(`/api/course-map/scenarios/${stored.id}`, {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ revision: stored.revision })
			});
			if (association?.id === stored.id) onassociationchange(null);
			deleteId = null;
			await refresh();
			operationState = completeScenarioOperation('delete', 'Draft plan deleted');
		} catch (error) {
			recordFailure('delete', stored, 'Could not delete draft plan.', error);
		}
	}

	function retryFailure() {
		if (operationState.kind !== 'failure') return;
		const { operation, scenario: target } = operationState;
		if (operation === 'list') return refresh();
		if (operation === 'create') return createSaved();
		if (operation === 'update') return saveChanges();
		if (!target) return;
		if (operation === 'load' || operation === 'recovery') return load(target, true, operation);
		if (operation === 'rename') return rename(target);
		if (operation === 'duplicate') return duplicate(target);
		return remove(target);
	}
</script>

<section
	class="mb-[0.8rem] border border-[var(--ink)] bg-[var(--surface-paper)] p-4 [&_button]:min-h-11 [&_button]:cursor-pointer [&_button]:border [&_button]:border-[var(--ink)] [&_button]:bg-[var(--surface-paper)] [&_button]:px-[0.7rem] [&_button]:font-[inherit] [&_button]:text-[var(--ink)] [&_button]:disabled:cursor-not-allowed [&_button]:disabled:opacity-50 [&_input]:min-h-11 [&_input]:border [&_input]:border-[var(--ink)] [&_input]:bg-[var(--surface-paper)] [&_input]:font-[inherit] [&_input]:text-[var(--ink)] [&_p]:m-0"
	aria-labelledby="saved-title"
>
	<div
		class="flex items-center justify-between gap-4 max-[600px]:flex-col max-[600px]:items-stretch"
	>
		<h3 id="saved-title" class="m-0 font-[var(--font-body)]">Saved drafts</h3>
		{#if moves.length > 0 && !association}
			<button type="button" onclick={openSave}>Save draft plan</button>
		{:else if association && dirty}
			<button type="button" onclick={saveChanges} disabled={busyOperation !== null}
				>Save changes</button
			>
		{:else if association}<span class="text-[var(--ink-soft)] text-[var(--text-caption)]"
				>Saved</span
			>{/if}
	</div>
	<div aria-live="polite">{operationState.kind === 'success' ? operationState.message : ''}</div>
	{#if association}<p class="text-[var(--ink-soft)] text-[var(--text-caption)]">
			<strong>{association.name}</strong> · revision {association.revision}{dirty
				? ' · Unsaved changes'
				: ''}
		</p>{/if}
	{#if loadIssues && loadIssues.skippedCount > 0}<div
			class="mt-3 grid gap-[0.45rem] bg-[var(--paper-shelf)] p-3"
		>
			<strong>Saved draft plan compatibility issues</strong>
			<p>
				{loadIssues.appliedCount} moves loaded into the preview · {loadIssues.skippedCount} moves skipped
				because courses or semesters are unavailable.
			</p>
		</div>{/if}
	{#if showSaveForm}<form
			class="mt-3 grid gap-[0.45rem] bg-[var(--paper-shelf)] p-3 [&_div]:flex [&_div]:flex-wrap [&_div]:gap-[0.35rem] [&_input]:box-border [&_input]:w-full [&_input]:px-[0.6rem]"
			onsubmit={(event) => {
				event.preventDefault();
				createSaved();
			}}
		>
			<label for="scenario-name">Draft plan name</label><input
				id="scenario-name"
				bind:value={name}
				maxlength="80"
				required
			/>
			<div>
				<button disabled={busyOperation !== null}>Save</button><button
					type="button"
					onclick={() => (showSaveForm = false)}>Cancel</button
				>
			</div>
		</form>{/if}
	{#if operationState.kind === 'failure'}<div
			class={[
				'mt-3 grid gap-[0.45rem] bg-[var(--paper-shelf)] p-3',
				operationState.conflict &&
					'border-t-dashed border border-t-2 border-[var(--accent)] border-t-[var(--ink)]'
			]}
			role="alert"
		>
			<strong
				>{operationState.conflict
					? `${operationState.scenario?.name ?? 'This draft plan'} changed elsewhere.`
					: operationState.message}</strong
			>
			{#if operationState.operation !== 'list'}<p>
					{operationState.operation} failed{operationState.scenario
						? ` for “${operationState.scenario.name}”`
						: ''}.
				</p>{/if}
			<button type="button" onclick={retryFailure} disabled={busyOperation !== null}
				>{operationState.operation === 'list'
					? 'Try again'
					: `Retry ${operationState.operation}`}</button
			>{#if operationState.conflict && operationState.scenario}<button
					type="button"
					onclick={() => load(failedScenario!, true, 'recovery')}>Reload exact saved record</button
				>{#if operationState.operation === 'update'}<button
						type="button"
						onclick={() =>
							createSaved(
								`${association?.name ?? failedScenario!.name} — Copy`.slice(0, 80),
								moves,
								true,
								'recovery',
								failedScenario
							)}>Save current plan as new</button
					>{/if}{/if}
		</div>{/if}
	{#if pendingLoad}<div class="mt-3 grid gap-[0.45rem] bg-[var(--paper-shelf)] p-3">
			<strong>Replace the current draft plan?</strong>
			<p>Your unsaved planning changes will be discarded.</p>
			<button type="button" onclick={() => load(pendingLoad!, true)}>Replace</button><button
				type="button"
				onclick={() => (pendingLoad = null)}>Cancel</button
			>
		</div>{/if}
	{#if status === 'loading'}<p aria-live="polite">Loading saved draft plans…</p>
	{:else if status === 'error'}<p class="mt-3 font-semibold text-[var(--pen-red)]" role="alert">
			Could not load saved draft plans.
		</p>{:else if scenarios.length === 0}<p>
			No saved draft plans yet.<br />Make a course move, then save the draft here.
		</p>
	{:else}<details class="mt-3" open>
			<summary class="cursor-pointer p-2 font-bold"
				>{scenarios.length} saved draft plan{scenarios.length === 1 ? '' : 's'}</summary
			>
			<ul class="m-0 list-none p-0">
				{#each scenarios as stored (stored.id)}<li
						class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-[var(--rule)] py-3 max-[600px]:grid-cols-1 max-[600px]:items-stretch"
					>
						<div>
							<strong>{stored.name}</strong><span
								class="block text-[var(--ink-soft)] text-[var(--text-caption)]"
								>{stored.moves.length} moves · Updated {new Date(
									stored.updatedAt
								).toLocaleDateString()}</span
							>
						</div>
						{#if renameId === stored.id}<form
								class="mt-3 grid gap-[0.45rem] bg-[var(--paper-shelf)] p-3 [&_div]:flex [&_div]:flex-wrap [&_div]:gap-[0.35rem] [&_input]:box-border [&_input]:w-full [&_input]:px-[0.6rem]"
								onsubmit={(event) => {
									event.preventDefault();
									rename(stored);
								}}
							>
								<label for={`rename-${stored.id}`}>Draft plan name</label><input
									id={`rename-${stored.id}`}
									bind:value={renameName}
									maxlength="80"
								/><button>Save name</button><button type="button" onclick={() => (renameId = null)}
									>Cancel</button
								>
							</form>
						{:else if deleteId === stored.id}<div class="col-span-full">
								<strong>Delete “{stored.name}”?</strong>
								<p>
									This removes the saved draft plan. Your current on-screen plan will remain open.
								</p>
								<button type="button" onclick={() => remove(stored)}>Delete</button><button
									type="button"
									onclick={() => (deleteId = null)}>Cancel</button
								>
							</div>
						{:else}<div class="flex flex-wrap gap-[0.35rem] max-[600px]:[&_button]:flex-auto">
								<button
									type="button"
									aria-label={`Preview ${stored.name}`}
									onclick={() => load(stored)}>Preview</button
								><button
									type="button"
									aria-label={`Rename ${stored.name}`}
									onclick={() => {
										operationState = clearScenarioOperation();
										renameId = stored.id;
										renameName = stored.name;
									}}>Rename</button
								><button
									type="button"
									aria-label={`Duplicate ${stored.name}`}
									onclick={() => duplicate(stored)}>Duplicate</button
								><button
									type="button"
									aria-label={`Delete ${stored.name}`}
									onclick={() => (deleteId = stored.id)}>Delete</button
								>
							</div>{/if}
					</li>{/each}
			</ul>
		</details>{/if}
</section>
