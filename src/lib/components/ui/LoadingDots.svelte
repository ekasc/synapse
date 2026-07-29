<script lang="ts">
	/**
	 * The app's single loading indicator. Opacity-only pulse (compositor
	 * friendly), flat square dots per the design system, announced via
	 * role="status". Global prefers-reduced-motion rules stop the animation.
	 */
	let { label = 'Loading' }: { label?: string } = $props();
</script>

<span class="inline-flex items-center" role="status">
	<span class="sr-only">{label}…</span>
	<span class="inline-flex gap-1" aria-hidden="true">
		<span
			class="size-[5px] [animation:loading-dots-pulse_1s_var(--ease-out-quart)_infinite] bg-[var(--ink)]"
		></span>
		<span
			class="size-[5px] [animation:loading-dots-pulse_1s_var(--ease-out-quart)_infinite] bg-[var(--ink)] [animation-delay:0.15s]"
		></span>
		<span
			class="size-[5px] [animation:loading-dots-pulse_1s_var(--ease-out-quart)_infinite] bg-[var(--ink)] [animation-delay:0.3s]"
		></span>
	</span>
</span>

<style>
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
