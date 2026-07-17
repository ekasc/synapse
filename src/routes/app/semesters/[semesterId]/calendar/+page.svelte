<script lang="ts">
	import CalendarWorkspace from '$lib/components/calendar/CalendarWorkspace.svelte';

	let { data } = $props();
</script>

<CalendarWorkspace {data} />
