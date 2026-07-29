<script lang="ts">
	import { resolveRoute } from '$app/paths';

	type AcademicDigestJob = {
		id: string;
		fileName: string;
		status: 'queued' | 'processing' | 'completed' | 'failed';
		error: string | null;
	};

	let {
		job,
		ondismiss
	}: {
		job: AcademicDigestJob | null;
		ondismiss: () => void;
	} = $props();
</script>

{#if job}
	<div
		class="digest-job-banner group flex items-center gap-[0.8rem] border-b border-[var(--ink)] bg-[var(--highlight-soft)] px-4 py-[0.6rem] text-[var(--ink)] data-[status=completed]:bg-[color-mix(in_srgb,var(--ok)_18%,var(--paper))] data-[status=failed]:bg-[color-mix(in_srgb,var(--accent)_16%,var(--paper))]"
		data-status={job.status}
		role={job.status === 'failed' ? 'alert' : 'status'}
	>
		<div class="flex min-w-0 flex-1 items-center gap-[0.55rem]">
			<span
				class="digest-job-pulse h-[0.55rem] w-[0.55rem] flex-none animate-[digest-pulse_1.2s_ease-in-out_infinite] bg-[var(--warn)] group-data-[status=completed]:animate-none group-data-[status=completed]:bg-[var(--ok)] group-data-[status=failed]:animate-none group-data-[status=failed]:bg-[var(--accent)]"
				aria-hidden="true"
			></span>
			<strong>
				{job.status === 'completed'
					? 'Transcript ready'
					: job.status === 'failed'
						? 'Transcript digestion failed'
						: 'Digesting transcript'}
			</strong>
			<span class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-caption)]"
				>{job.fileName}</span
			>
			{#if job.error}<span
					class="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--text-caption)]"
					>{job.error}</span
				>{/if}
		</div>
		<a
			class="font-semibold text-[var(--text-caption)] text-inherit"
			href={resolveRoute('/app/digest')}>Grades & GPA</a
		>
		{#if job.status === 'completed' || job.status === 'failed'}
			<button
				type="button"
				class="cursor-pointer border-0 bg-transparent font-semibold text-[var(--text-caption)] text-inherit"
				aria-label="Dismiss transcript status"
				onclick={ondismiss}>x</button
			>
		{/if}
	</div>
{/if}

<style>
	@keyframes -global-digest-pulse {
		50% {
			opacity: 0.3;
		}
	}
</style>
