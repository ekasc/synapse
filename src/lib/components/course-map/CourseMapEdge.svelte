<script lang="ts">
	import type { MapPosition, MapRelation } from './types';

	interface Props {
		relation: MapRelation;
		source: MapPosition;
		target: MapPosition;
		muted: boolean;
	}

	let { relation, source, target, muted }: Props = $props();
	const path = $derived.by(() => {
		const sourceX = source.x + source.width;
		const sourceY = source.y + source.height / 2;
		const targetX = target.x;
		const targetY = target.y + target.height / 2;
		const midpointX = (sourceX + targetX) / 2;
		return `M ${sourceX} ${sourceY} C ${midpointX} ${sourceY}, ${midpointX} ${targetY}, ${targetX} ${targetY}`;
	});
</script>

<path
	d={path}
	class={{ edge: true, pending: relation.reviewStatus === 'pending', muted }}
	marker-end="url(#course-map-arrow)"
/>

<style>
	.edge {
		fill: none;
		stroke: var(--ink-soft);
		stroke-width: 2;
		transition: opacity 0.15s var(--ease-out-quart);
	}

	.pending {
		stroke-dasharray: 7 6;
	}

	.muted {
		opacity: 0.14;
	}
</style>
