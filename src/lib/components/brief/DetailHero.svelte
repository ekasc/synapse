<script lang="ts">
	import type { BriefingDetailViewModel } from '$lib/server/briefing/view-model';

	let { brief }: { brief: BriefingDetailViewModel } = $props();

	const title = $derived.by(() => {
		const escaped = brief.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return brief.title.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, 'i'), '') || brief.title;
	});

	const dateLabel = $derived.by(() => {
		const d = new Date(brief.researchedAt);
		if (isNaN(d.getTime())) return '';
		return d
			.toLocaleString('en-US', {
				month: 'short',
				day: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			})
			.replace(',', ' ·');
	});

	const highlightText = $derived.by(() => {
		const prereq = brief.prerequisites?.text?.trim();
		if (prereq && prereq.length > 0) {
			return { label: 'PREREQ', value: prereq };
		}
		const cred = brief.credits?.text?.trim();
		if (cred) {
			return { label: 'CREDITS', value: cred };
		}
		const del = brief.delivery?.text?.trim();
		if (del) {
			return { label: 'DELIVERY', value: del };
		}
		if (brief.offerings?.current?.term) {
			return { label: 'OFFERED', value: brief.offerings.current.term };
		}
		return null;
	});
</script>

<header class="grid gap-[0.4rem] pb-6">
	<div class="flex items-baseline justify-between gap-4 max-[700px]:flex-col max-[700px]:gap-1">
		<span class=" font-medium tracking-[0.1em] text-[var(--ink)] text-[var(--text-caption)]"
			>{brief.courseCode}</span
		>
		<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">{dateLabel}</span>
	</div>
	<h1
		class="mt-[0.2rem] font-[family-name:var(--font-body)] text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.01em] text-balance text-[var(--ink)]"
	>
		{title}
	</h1>
	<p
		class="mt-[0.1rem] font-[family-name:var(--font-body)] text-base leading-[1.4] text-[var(--ink-soft)]"
	>
		{brief.institution}
	</p>
	{#if highlightText}
		<div
			class="mt-[0.85rem] bg-[var(--highlight)] px-[0.9rem] py-[0.6rem] font-[family-name:var(--font-body)] text-[1.4rem] leading-tight font-bold tracking-[-0.005em] text-[var(--ink)] max-[700px]:text-[1.15rem]"
			role="note"
			aria-label={highlightText.label}
		>
			<span class="mr-[0.4rem] font-medium text-[var(--text-caption)]">{highlightText.label}:</span>
			<span>{highlightText.value}</span>
		</div>
	{/if}
</header>
