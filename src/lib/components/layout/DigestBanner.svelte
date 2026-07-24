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
		class="digest-job-banner"
		class:failed={job.status === 'failed'}
		class:completed={job.status === 'completed'}
		role={job.status === 'failed' ? 'alert' : 'status'}
	>
		<div>
			<span class="digest-job-pulse" aria-hidden="true"></span>
			<strong>
				{job.status === 'completed'
					? 'Transcript ready'
					: job.status === 'failed'
						? 'Transcript digestion failed'
						: 'Digesting transcript'}
			</strong>
			<span>{job.fileName}</span>
			{#if job.error}<span>{job.error}</span>{/if}
		</div>
		<a href={resolveRoute('/app/digest')}>Weekly digest</a>
		{#if job.status === 'completed' || job.status === 'failed'}
			<button type="button" aria-label="Dismiss transcript status" onclick={ondismiss}>x</button>
		{/if}
	</div>
{/if}

<style>
	.digest-job-banner {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		border-bottom: 1px solid var(--ink);
		background: var(--highlight-soft);
		padding: 0.6rem 1rem;
		color: var(--ink);
	}

	.digest-job-banner > div {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		flex: 1;
	}

	.digest-job-banner span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.78rem;
	}

	.digest-job-banner a,
	.digest-job-banner button {
		color: inherit;
		font: inherit;
		font-size: 0.76rem;
		font-weight: 600;
	}

	.digest-job-banner button {
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.digest-job-banner.completed {
		background: color-mix(in srgb, var(--ok) 18%, var(--paper));
	}

	.digest-job-banner.failed {
		background: color-mix(in srgb, var(--accent) 16%, var(--paper));
	}

	.digest-job-pulse {
		width: 0.55rem;
		height: 0.55rem;
		flex: 0 0 auto;
		background: var(--warn);
		animation: digest-pulse 1.2s ease-in-out infinite;
	}

	.completed .digest-job-pulse {
		background: var(--ok);
		animation: none;
	}

	.failed .digest-job-pulse {
		background: var(--accent);
		animation: none;
	}

	@keyframes digest-pulse {
		50% {
			opacity: 0.3;
		}
	}
</style>
