<script lang="ts">
	export type IconName =
		| 'dashboard'
		| 'graph'
		| 'courses'
		| 'semesters'
		| 'calendar'
		| 'digest'
		| 'practice'
		| 'brief'
		| 'syllabus'
		| 'cover';

	let {
		name,
		size = 16,
		class: className = ''
	}: {
		name: IconName;
		size?: number;
		class?: string;
	} = $props();
</script>

<svg
	class="sidebar-icon {className}"
	viewBox="0 0 20 20"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'dashboard'}
		<rect x="3" y="3" width="6" height="6" rx="1" />
		<rect x="11" y="3" width="6" height="6" rx="1" />
		<rect x="3" y="11" width="6" height="6" rx="1" />
		<rect x="11" y="11" width="6" height="6" rx="1" />
	{:else if name === 'graph'}
		<circle cx="5" cy="5" r="1.8" />
		<circle cx="15" cy="5" r="1.8" />
		<circle cx="5" cy="15" r="1.8" />
		<circle cx="15" cy="15" r="1.8" />
		<line x1="6.3" y1="6.3" x2="13.7" y2="13.7" />
		<line x1="13.7" y1="6.3" x2="6.3" y2="13.7" />
		<line x1="5" y1="5" x2="15" y2="15" />
	{:else if name === 'courses'}
		<path d="M4 4 L10 6 L16 4 L16 14 L10 16 L4 14 Z" />
		<line x1="10" y1="6" x2="10" y2="16" />
	{:else if name === 'semesters'}
		<rect x="3" y="3" width="14" height="4" rx="1" />
		<rect x="3" y="8" width="14" height="4" rx="1" />
		<rect x="3" y="13" width="14" height="4" rx="1" />
	{:else if name === 'calendar'}
		<rect x="3" y="5" width="14" height="12" rx="1" />
		<line x1="3" y1="9" x2="17" y2="9" />
		<line x1="7" y1="3" x2="7" y2="7" />
		<line x1="13" y1="3" x2="13" y2="7" />
	{:else if name === 'digest'}
		<path d="M5 3 L15 3 L15 17 L5 17 Z" />
		<line x1="7.5" y1="7" x2="12.5" y2="7" />
		<line x1="7.5" y1="10" x2="12.5" y2="10" />
		<line x1="7.5" y1="13" x2="10" y2="13" />
	{:else if name === 'practice'}
		<circle cx="10" cy="10" r="6.5" />
		<path d="M7 10 L9.5 12.5 L13.5 7.5" />
	{:else if name === 'brief'}
		<circle cx="8" cy="8" r="4" />
		<line x1="11" y1="11" x2="15" y2="15" />
	{:else if name === 'syllabus'}
		<rect x="4" y="3" width="12" height="14" rx="1" />
		<line x1="6.5" y1="7" x2="13.5" y2="7" />
		<line x1="6.5" y1="10" x2="13.5" y2="10" />
		<line x1="6.5" y1="13" x2="11" y2="13" />
	{:else if name === 'cover'}
		<path d="M3 3 L17 3 L17 17 L3 17 Z" />
		<line x1="3" y1="8" x2="17" y2="8" />
		<line x1="9" y1="3" x2="9" y2="17" />
	{/if}
</svg>

<style>
	:global(.sidebar-icon) {
		display: inline-block;
		flex-shrink: 0;
	}
</style>
