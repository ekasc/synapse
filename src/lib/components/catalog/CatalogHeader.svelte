<script lang="ts">
	interface Props {
		term: string;
	}

	let { term }: Props = $props();
</script>

<header class="catalog-header" aria-label="Current term">
	<span class="catalog-term">{term}</span>
</header>
