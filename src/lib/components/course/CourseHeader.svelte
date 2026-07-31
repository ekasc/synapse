<script lang="ts">
	type CourseStatus = 'planned' | 'active' | 'completed' | 'at-risk';
	type RiskLevel = 'none' | 'low' | 'medium' | 'high';

	type Course = {
		code: string;
		name: string;
		instructor?: string;
		credits?: number;
		tag?: string;
		signals?: {
			status?: CourseStatus;
			riskLevel?: RiskLevel;
			currentGrade?: number;
			nextDeadline?: string;
			requirementGroup?: string;
		};
	};

	type Semester = { id: string; term: string; year: number; order: number };

	let {
		course,
		semester,
		onEdit,
		onDelete,
		onBack
	}: {
		course: Course;
		semester: Semester | null;
		onEdit: () => void;
		onDelete: () => void;
		onBack: () => void;
	} = $props();

	const status = $derived(course.signals?.status ?? 'planned');
	const statusLabel = $derived(status.replaceAll('-', ' '));

	const statusVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		status === 'completed'
			? 'ok'
			: status === 'at-risk'
				? 'crit'
				: status === 'active'
					? 'warn'
					: 'idle'
	);

	const riskLabel = $derived(course.signals?.riskLevel ?? 'none');

	const riskVariant: 'crit' | 'ok' | 'warn' | 'idle' = $derived(
		riskLabel === 'high'
			? 'crit'
			: riskLabel === 'medium'
				? 'warn'
				: riskLabel === 'low'
					? 'ok'
					: 'idle'
	);
</script>

<button
	class="mb-4 inline-block cursor-pointer border-none bg-transparent p-0 text-[var(--ink-soft)] text-[var(--text-caption)] transition-colors duration-100 ease-[var(--ease-out-quart)] hover:text-[var(--ink)]"
	onclick={onBack}>← back</button
>

<div class="mb-8 border-b border-[var(--ink)] pb-6">
	<div class="mb-6 flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<h1 class="page-title">{course.code}</h1>
			<p class="font-body m-0 mb-2 text-[1.05rem] leading-[1.3] font-semibold text-[var(--ink)]">
				{course.name}
			</p>
			<p class="m-0 tracking-[0.1em] text-[var(--ink-soft)] text-[var(--text-caption)]">
				{#if semester}{semester.term} {semester.year} ·
				{/if}
				{#if course.instructor}{course.instructor} ·
				{/if}
				{#if course.credits !== undefined}{course.credits} credit{course.credits === 1
						? ''
						: 's'}{/if}
			</p>
			{#if course.tag || course.signals?.requirementGroup}
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#if course.tag}
						<span
							class="border border-[var(--rule)] bg-[var(--paper-shelf)] px-[0.55rem] py-[0.2rem] tracking-[0.1em] text-[var(--ink)] text-[var(--text-caption)]"
							>{course.tag}</span
						>
					{/if}
					{#if course.signals?.requirementGroup}
						<span
							class="border border-[var(--rule)] bg-[var(--paper)] px-[0.55rem] py-[0.2rem] tracking-[0.1em] text-[var(--ink)] text-[var(--text-caption)]"
							>{course.signals.requirementGroup}</span
						>
					{/if}
				</div>
			{/if}
		</div>
		<div class="flex gap-2">
			<button class="btn btn-secondary btn-sm" onclick={onEdit}>edit</button>
			<button class="btn btn-danger btn-sm" onclick={onDelete}>delete</button>
		</div>
	</div>

	<div class="flex flex-wrap items-baseline gap-x-6 gap-y-[0.45rem]" aria-label="Course state">
		<span class="inline-flex items-baseline gap-2">
			<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Status</span>
			<span
				class="font-body leading-[1.2] font-semibold text-[var(--text-small)] {statusVariant ===
				'crit'
					? 'text-[var(--accent)]'
					: statusVariant === 'ok'
						? 'text-[var(--ok)]'
						: statusVariant === 'warn'
							? 'text-[var(--warn)]'
							: 'text-[var(--ink-faint)]'}">{statusLabel}</span
			>
		</span>
		<span class="inline-flex items-baseline gap-2">
			<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Grade</span>
			<span
				class="font-body leading-[1.2] font-semibold text-[var(--ink)] text-[var(--text-small)]"
			>
				{#if course.signals?.currentGrade !== undefined}
					{course.signals.currentGrade}
				{:else}
					<span class="font-normal text-[var(--ink-faint)]">—</span>
				{/if}
			</span>
		</span>
		<span class="inline-flex items-baseline gap-2">
			<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Risk</span>
			<span
				class="font-body leading-[1.2] font-semibold text-[var(--text-small)] {riskVariant ===
				'crit'
					? 'text-[var(--accent)]'
					: riskVariant === 'ok'
						? 'text-[var(--ok)]'
						: riskVariant === 'warn'
							? 'text-[var(--warn)]'
							: 'text-[var(--ink-faint)]'}">{riskLabel}</span
			>
		</span>
		{#if course.signals?.nextDeadline}
			<span class="inline-flex items-baseline gap-2">
				<span class=" text-[var(--ink-faint)] text-[var(--text-caption)]">Next</span>
				<span
					class="font-body leading-[1.2] font-semibold text-[var(--ink)] text-[var(--text-small)]"
					>{course.signals.nextDeadline}</span
				>
			</span>
		{/if}
	</div>
</div>
