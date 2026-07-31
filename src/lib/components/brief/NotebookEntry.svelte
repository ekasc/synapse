<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

	let { brief }: { brief: BriefingDetailViewModel } = $props();

	const dateStamp = $derived.by(() => {
		const d = new Date(brief.researchedAt);
		if (isNaN(d.getTime())) return '';
		const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
		const day = String(d.getDate()).padStart(2, '0');
		const year = d.getFullYear();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${month} ${day} ${year} · ${hh}:${mm}`;
	});

	const title = $derived.by(() => {
		const escaped = brief.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return brief.title.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, 'i'), '') || brief.title;
	});

	const rmpRating = $derived(brief.studentReviews?.rating);
	const rmpLabel = $derived(rmpRating != null ? `${rmpRating.toFixed(1)} / 5` : 'N/A');
	const rmpVariant = $derived.by(() => {
		if (rmpRating == null) return 'idle';
		if (rmpRating < 3) return 'crit';
		if (rmpRating >= 4) return 'ok';
		return 'warn';
	});

	const termLabel = $derived(brief.offerings?.current?.term ?? '');
	const profLabel = $derived(
		brief.offerings?.current?.instructor?.name ?? brief.professor.requestedName ?? ''
	);
	const creditsLabel = $derived.by(() => {
		const text = brief.credits?.text?.trim();
		if (!text) return '';
		const m = text.match(/\d+/);
		return m ? `${m[0]} credit${m[0] === '1' ? '' : 's'}` : text;
	});
	const sourceLabel = $derived(
		`${brief.sources.length} source${brief.sources.length === 1 ? '' : 's'}`
	);

	const metaParts = $derived(
		[profLabel, termLabel, creditsLabel, sourceLabel].filter((s) => s && s.trim().length > 0)
	);
</script>

<a
	class="group flex gap-0 border-0 border-b border-[var(--rule)] bg-[var(--paper)] p-0 text-inherit no-underline transition-[background] duration-150 ease-[var(--ease-out-quart)] hover:bg-[var(--paper-shelf)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ink)]"
	href={resolveRoute(`/app/brief/${encodeURIComponent(brief.courseCode)}`)}
>
	<div
		class="grid min-w-0 flex-auto gap-[0.35rem] px-6 py-5 max-[700px]:py-4 max-[700px]:pr-4 max-[700px]:pl-[1.1rem]"
	>
		<div class=" text-[var(--ink-faint)] text-[var(--text-caption)]">
			{dateStamp}
		</div>
		<div
			class="mt-[0.1rem] flex items-center justify-between gap-3 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-1"
		>
			<span class=" font-medium tracking-[0.1em] text-[var(--ink)] text-[var(--text-caption)]"
				>{brief.courseCode}</span
			>
			<span
				class={[
					'border border-transparent px-[0.45rem] py-[0.15rem]  leading-[1.2] font-medium text-[var(--text-caption)]',
					rmpVariant === 'ok' && 'bg-[var(--highlight-soft)] text-[var(--ink)]',
					rmpVariant === 'warn' && 'bg-[var(--paper-shelf)] text-[var(--ink-soft)]',
					rmpVariant === 'crit' && 'bg-[var(--pen-red)] text-[var(--paper)]',
					rmpVariant === 'idle' && 'bg-[var(--paper-shelf)] text-[var(--ink-faint)]'
				]}>{rmpLabel}</span
			>
		</div>
		<h3
			class="mt-[0.1rem] mb-0 font-[family-name:var(--font-body)] text-[1.4rem] leading-[1.15] font-bold tracking-[-0.005em] text-balance text-[var(--ink)] transition-transform duration-150 ease-[var(--ease-out-quart)] group-hover:-translate-y-px max-[700px]:text-[1.2rem]"
		>
			{title}
		</h3>
		<div
			class="mt-[0.15rem] font-[family-name:var(--font-body)] [overflow-wrap:anywhere] text-[var(--ink-soft)] text-[var(--text-caption)]"
		>
			{metaParts.join(' · ')}
		</div>
	</div>
</a>
