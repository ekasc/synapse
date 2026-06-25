<script lang="ts">
	interface Props {
		eyebrow?: string;
		title: string;
		meta?: string;
	}

	let { eyebrow = '', title, meta = '' }: Props = $props();
</script>

<div class="section-head-wrap">
	{#if eyebrow}
		<div class="section-eyebrow">{eyebrow}</div>
	{/if}
	<div class="section-head">
		<h2 class="section-title">{title}</h2>
		{#if meta}
			<div class="section-meta">{meta}</div>
		{/if}
	</div>
</div>
