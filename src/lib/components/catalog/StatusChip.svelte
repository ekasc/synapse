<script lang="ts">
	interface Props {
		variant: 'crit' | 'ok' | 'warn' | 'idle';
		label: string;
		title?: string;
	}

	let { variant, label, title }: Props = $props();
</script>

<span class="status-chip {variant}" {title}>
	{label}
</span>
