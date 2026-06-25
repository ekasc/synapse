<script lang="ts">
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';

	interface Term {
		id: string;
		label: string;
		count?: number | null;
	}

	interface Props {
		semesters: { id: string; term: string; year: number; order: number }[];
		countsById?: Record<string, number>;
	}

	let { semesters, countsById = {} }: Props = $props();

	const sorted = $derived([...semesters].sort((a, b) => b.order - a.order));

	function isActive(id: string | null): boolean {
		if (id === null)
			return $page.url.pathname === '/app/semesters' && !$page.url.searchParams.has('term');
		return $page.url.searchParams.get('term') === id;
	}

	const terms: Term[] = $derived(
		sorted.map((s) => ({
			id: s.id,
			label: `${s.term} ${s.year}`,
			count: countsById[s.id] ?? null
		}))
	);
</script>

<div class="term-list">
	<div class="nav-label">Terms</div>
	<a
		class="term-list-item"
		href={resolveRoute('/app/semesters')}
		data-active={isActive(null) ? 'true' : undefined}
	>
		<span class="term-list-label">All terms</span>
	</a>
	{#each terms as term (term.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- href is resolveRoute('/app/semesters') with ?term= suffix -->
		<a
			class="term-list-item"
			href={`${resolveRoute('/app/semesters')}?term=${term.id}`}
			data-active={isActive(term.id) ? 'true' : undefined}
		>
			<span class="term-list-label">{term.label}</span>
			{#if term.count !== null}
				<span class="term-list-count">{term.count}</span>
			{/if}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
	{#if terms.length === 0}
		<a class="term-list-item" href={resolveRoute('/app/semesters')}>
			<span class="term-list-label">+ add term</span>
		</a>
	{/if}
</div>

<style>
	.term-list {
		margin-top: 0.5rem;
	}

	.nav-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--ink-faint);
		padding: 0 1.25rem 0.4rem;
	}

	.term-list-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 1.25rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink-soft);
		text-decoration: none;
		border-left: 2px solid transparent;
		transition:
			color 0.12s,
			background 0.12s,
			border-left-color 0.12s;
	}

	.term-list-item:hover {
		color: var(--ink);
		background: rgba(26, 26, 23, 0.04);
		border-left-color: var(--ink);
	}

	.term-list-item[data-active='true'] {
		color: var(--ink);
		background: var(--paper);
		border-left-color: var(--accent);
		font-weight: 500;
	}

	.term-list-count {
		font-size: 0.7rem;
		color: var(--ink-faint);
	}
</style>
