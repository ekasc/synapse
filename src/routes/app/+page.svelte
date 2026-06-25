<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { resolveRoute } from '$app/paths';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';
	import SectionHead from '$lib/components/catalog/SectionHead.svelte';
	import BookShelf from '$lib/components/catalog/BookShelf.svelte';
	import BookCard from '$lib/components/catalog/BookCard.svelte';

	const here = $derived($page.url.pathname);

	let { data } = $props();

	let { semesters, courses } = $derived(data);

	const sortedSemesters = $derived([...semesters].sort((a, b) => b.order - a.order));
	const currentTerm = $derived(
		sortedSemesters.find((s) => courses.some((c) => c.semesterId === s.id)) ??
			sortedSemesters[0] ??
			null
	);
	const currentTermLabel = $derived(currentTerm ? `${currentTerm.term} ${currentTerm.year}` : '—');

	function spineForSemester(semesterId: string): 'crit' | 'ok' | 'warn' | 'idle' {
		if (!currentTerm) return 'idle';
		if (semesterId === currentTerm.id) return 'warn';
		const sem = sortedSemesters.find((s) => s.id === semesterId);
		if (!sem) return 'idle';
		if (sem.order < currentTerm.order) return 'ok';
		return 'idle';
	}

	function semesterStatus(semesterId: string): {
		label: string;
		variant: 'crit' | 'ok' | 'warn' | 'idle';
	} {
		if (!currentTerm) return { label: '—', variant: 'idle' };
		if (semesterId === currentTerm.id) return { label: 'Current', variant: 'warn' };
		const sem = sortedSemesters.find((s) => s.id === semesterId);
		if (!sem) return { label: '—', variant: 'idle' };
		if (sem.order < currentTerm.order) return { label: 'Past', variant: 'ok' };
		return { label: 'Future', variant: 'idle' };
	}

	function termShort(id: string): string {
		const s = sortedSemesters.find((x) => x.id === id);
		if (!s) return '—';
		return `${s.term[0]}${String(s.year).slice(-2)}`;
	}
</script>

<svelte:head><title>Synapse · Dashboard</title></svelte:head>

<CatalogHeader term={currentTermLabel} />

<div class="page">
	{#if semesters.length === 0}
		<div class="empty">
			<h1 class="page-title font-hand">Dashboard</h1>
			<p class="page-tagline">Your catalog is empty. Set up your semesters to get started.</p>
			<div class="empty-actions">
				<button class="btn btn-primary" onclick={() => goto(resolveRoute('/app/setup'))}>
					Start setup →
				</button>
			</div>
		</div>
	{:else}
		<div class="dashboard page-enter">
			<div class="page-cover">
				<h1 class="page-title font-hand">Catalog</h1>
				<p class="page-tagline">
					<span class="tagline-num">{courses.length}</span> course{courses.length === 1 ? '' : 's'}
					across
					<span class="tagline-num">{semesters.length}</span> term{semesters.length === 1
						? ''
						: 's'}
				</p>
			</div>

			{#each sortedSemesters as semester (semester.id)}
				{@const semesterCourses = courses.filter((c) => c.semesterId === semester.id)}
				{@const status = semesterStatus(semester.id)}
				<div class="semester-section">
					<SectionHead
						eyebrow={`${semesterCourses.length} ${semesterCourses.length === 1 ? 'course' : 'courses'}`}
						title={`${semester.term} ${semester.year}`}
						meta={status.label.toUpperCase()}
					/>
					{#if semesterCourses.length === 0}
						<div class="empty-shelf">No courses in this term yet.</div>
					{:else}
						<BookShelf>
							{#each semesterCourses as course (course.id)}
								<BookCard
									href={`${resolveRoute(`/app/courses/${course.id}`)}?from=${encodeURIComponent(here)}`}
									spine={spineForSemester(semester.id)}
									meta={course.code}
									title={course.name}
									detail={`${semester.term} ${semester.year}`}
									statusLabel={termShort(semester.id)}
									statusVariant={status.variant}
								/>
							{/each}
						</BookShelf>
					{/if}
				</div>
			{/each}

			<div class="action-board">
				<button class="btn btn-secondary" onclick={() => goto(resolveRoute('/app/courses/manage'))}>
					manage courses
				</button>
				<button class="btn btn-primary" onclick={() => goto(resolveRoute('/app/courses'))}>
					open course map
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1100px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}

	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.4rem 0 0.25rem;
		line-height: 1;
	}

	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.95rem;
		margin: 0 0 1.5rem;
	}

	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.semester-section {
		margin-top: 1rem;
	}

	.empty-shelf {
		padding: 1.25rem;
		border: 1px dashed var(--rule);
		color: var(--ink-faint);
		font-size: 0.82rem;
		text-align: center;
		background: var(--paper);
	}

	.empty {
		text-align: center;
		padding-block: 4rem;
	}

	.empty-actions {
		margin-top: 1.5rem;
	}

	.action-board {
		display: flex;
		gap: 0.6rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 1rem;
	}

	@media (max-width: 640px) {
		.action-board {
			flex-direction: column;
		}
	}
</style>
