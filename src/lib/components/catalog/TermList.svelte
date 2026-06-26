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

	const terms: Term[] = $derived(
		sorted.map((s) => ({
			id: s.id,
			label: `${s.term} ${s.year}`,
			count: countsById[s.id] ?? null
		}))
	);
</script>

<div class="term-list">
	<div class="sidebar-section-label">Terms</div>
	{#each terms as term (term.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- href is resolveRoute('/app/semesters') with ?term= suffix -->
		<a
			class="sidebar-link term-list-item"
			href={`${resolveRoute('/app/semesters')}?term=${term.id}`}
			data-active={$page.url.searchParams.get('term') === term.id ? 'true' : undefined}
		>
			<span class="term-label">{term.label}</span>
			{#if term.count !== null}
				<span class="sidebar-count">{term.count}</span>
			{/if}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
	{#if terms.length === 0}
		<a class="sidebar-link term-list-item" href={resolveRoute('/app/semesters')}>
			<span class="term-label">+ add term</span>
		</a>
	{/if}
</div>

<style>
	.term-list {
		margin-top: 0.5rem;
	}

	.sidebar-section-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-soft);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 0 1.25rem 0.5rem;
	}

	.term-list-item {
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--ink-soft);
	}

	.term-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}

	.sidebar-count {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-soft);
		font-weight: 500;
		line-height: 1;
		flex-shrink: 0;
	}
</style>
