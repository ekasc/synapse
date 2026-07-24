<script lang="ts">
	/**
	 * The app's single loading indicator. Opacity-only pulse (compositor
	 * friendly), flat square dots per the design system, announced via
	 * role="status". Global prefers-reduced-motion rules stop the animation.
	 */
	let { label = 'Loading' }: { label?: string } = $props();
</script>

<span class="loading-dots" role="status">
	<span class="loading-dots-label">{label}…</span>
	<span class="loading-dots-mark" aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
	</span>
</span>

<style>
	.loading-dots {
		display: inline-flex;
		align-items: center;
	}

	.loading-dots-label {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	.loading-dots-mark {
		display: inline-flex;
		gap: 4px;
	}

	.loading-dots-mark span {
		width: 5px;
		height: 5px;
		background: var(--ink);
		animation: loading-dots-pulse 1s var(--ease-out-quart) infinite;
	}

	.loading-dots-mark span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.loading-dots-mark span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes loading-dots-pulse {
		0%,
		100% {
			opacity: 0.2;
		}
		40% {
			opacity: 1;
		}
	}
</style>
