<script lang="ts">
	import StatusChip from './StatusChip.svelte';

	type Status = 'crit' | 'ok' | 'warn' | 'idle';

	interface Props {
		href?: string;
		onclick?: (e: MouseEvent) => void;
		spine?: Status;
		spineColor?: string;
		meta: string;
		title: string;
		detail?: string;
		statusLabel?: string;
		statusVariant?: Status;
		statusValue?: string | number;
		statusUnit?: string;
	}

	let {
		href,
		onclick,
		spine = 'idle',
		spineColor,
		meta,
		title,
		detail = '',
		statusLabel,
		statusVariant = 'idle',
		statusValue,
		statusUnit
	}: Props = $props();

	const isButton = $derived(!href && !!onclick);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is the consumer's responsibility (call resolveRoute() before passing) -->
	<a class="book" {href}>
		<span class="book-spine {spine}" style={spineColor ? `background: ${spineColor}` : ''}></span>
		<div class="book-body">
			<div class="book-meta">{meta}</div>
			<div class="book-title">{title}</div>
			{#if detail}
				<div class="book-detail">{detail}</div>
			{/if}
		</div>
		<div class="book-status">
			{#if statusValue !== undefined}
				<div class="book-status-num">{statusValue}{statusUnit ?? ''}</div>
			{/if}
			{#if statusLabel}
				<div class="book-status-label">{statusLabel}</div>
			{/if}
			<StatusChip variant={statusVariant} label="" />
		</div>
	</a>
{:else if isButton}
	<button class="book" type="button" {onclick}>
		<span class="book-spine {spine}" style={spineColor ? `background: ${spineColor}` : ''}></span>
		<div class="book-body">
			<div class="book-meta">{meta}</div>
			<div class="book-title">{title}</div>
			{#if detail}
				<div class="book-detail">{detail}</div>
			{/if}
		</div>
		<div class="book-status">
			{#if statusValue !== undefined}
				<div class="book-status-num">{statusValue}{statusUnit ?? ''}</div>
			{/if}
			{#if statusLabel}
				<div class="book-status-label">{statusLabel}</div>
			{/if}
			<StatusChip variant={statusVariant} label="" />
		</div>
	</button>
{:else}
	<div class="book" role="group">
		<span class="book-spine {spine}" style={spineColor ? `background: ${spineColor}` : ''}></span>
		<div class="book-body">
			<div class="book-meta">{meta}</div>
			<div class="book-title">{title}</div>
			{#if detail}
				<div class="book-detail">{detail}</div>
			{/if}
		</div>
		<div class="book-status">
			{#if statusValue !== undefined}
				<div class="book-status-num">{statusValue}{statusUnit ?? ''}</div>
			{/if}
			{#if statusLabel}
				<div class="book-status-label">{statusLabel}</div>
			{/if}
			<StatusChip variant={statusVariant} label="" />
		</div>
	</div>
{/if}
