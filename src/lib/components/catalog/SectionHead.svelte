<script lang="ts">
	interface Props {
		title: string;
	}

	let { title }: Props = $props();
</script>

<div class="section-head">
	<h2 class="section-title">{title}</h2>
</div>
