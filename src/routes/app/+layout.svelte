<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const nav = [
		{ href: '/app', label: 'Dashboard', icon: '◫' },
		{ href: '/app/courses', label: 'Courses', icon: '◰' },
		{ href: '/app/calendar', label: 'Calendar', icon: '◷' },
		{ href: '/app/digest', label: 'Digest', icon: '◶' },
		{ href: '/app/practice', label: 'Practice', icon: '◵' },
		{ href: '/app/brief', label: 'Brief', icon: '◴' },
		{ href: '/app/settings', label: 'Settings', icon: '⚙' },
	];
</script>

<div class="app-shell">
	<aside class="sidebar" aria-label="App navigation">
		<div class="sidebar-header">
			<a href="/" class="sidebar-brand font-hand">synapse</a>
			<span class="sidebar-vol tape-shadow">vol. 01</span>
		</div>

		<nav class="sidebar-nav">
			{#each nav as item}
				<a
					href={item.href}
					class="sidebar-link"
					class:active={$page.url.pathname === item.href}
				>
					<span class="sidebar-icon">{item.icon}</span>
					<span class="sidebar-label">{item.label}</span>
				</a>
			{/each}
		</nav>

		<div class="sidebar-footer">
			<a href="/" class="sidebar-back font-mono">← back to cover</a>
		</div>
	</aside>

	<main class="app-main paper" class:canvas-main={$page.url.pathname === '/app/courses'}>
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		min-height: 100vh;
	}

	.sidebar {
		width: 200px;
		flex-shrink: 0;
		background: var(--paper-edge);
		border-right: 1px solid rgba(26, 26, 23, 0.12);
		display: flex;
		flex-direction: column;
		padding: 1.5rem 0;
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.sidebar-header {
		padding: 0 1.25rem 1rem;
		border-bottom: 1px dashed var(--ink-faint);
		margin-bottom: 1rem;
	}

	.sidebar-brand {
		font-size: 1.5rem;
		color: var(--ink);
		text-decoration: none;
		display: block;
		line-height: 1;
	}

	.sidebar-vol {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink-soft);
		margin-top: 0.25rem;
		display: inline-block;
		padding: 2px 8px;
		background: rgba(255, 255, 255, 0.3);
	}

	.sidebar-nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 0.5rem;
	}

	.sidebar-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		color: var(--ink-soft);
		text-decoration: none;
		font-size: 0.9rem;
		font-family: var(--font-body);
		transition: background 0.15s, color 0.15s;
	}

	.sidebar-link:hover {
		background: rgba(26, 26, 23, 0.05);
		color: var(--ink);
	}

	.sidebar-link.active {
		background: var(--highlight);
		color: var(--ink);
		mix-blend-mode: multiply;
	}

	.sidebar-icon {
		font-size: 1rem;
		width: 1.25rem;
		text-align: center;
		opacity: 0.6;
	}

	.sidebar-label {
		font-weight: 500;
	}

	.sidebar-footer {
		padding: 1rem 1.25rem 0;
		border-top: 1px dashed var(--ink-faint);
		margin-top: 1rem;
	}

	.sidebar-back {
		font-family: var(--font-hand);
		font-size: 0.95rem;
		color: var(--ink-soft);
		text-decoration: none;
	}

	.sidebar-back:hover {
		color: var(--ink);
	}

	.app-main {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
	}

	.app-main.canvas-main {
		position: relative;
		padding: 0;
		overflow: hidden;
		height: 100vh;
	}

	@media (max-width: 640px) {
		.app-shell {
			flex-direction: column;
		}

		.sidebar {
			width: 100%;
			height: auto;
			position: static;
			flex-direction: row;
			flex-wrap: wrap;
			padding: 0.75rem;
			gap: 0.25rem;
			border-right: none;
			border-bottom: 1px solid rgba(26, 26, 23, 0.12);
		}

		.sidebar-header,
		.sidebar-footer {
			display: none;
		}

		.sidebar-nav {
			flex-direction: row;
			flex-wrap: wrap;
			padding: 0;
			gap: 2px;
		}

		.sidebar-link {
			padding: 0.35rem 0.6rem;
			font-size: 0.8rem;
		}

		.app-main {
			padding: 1rem;
		}
	}
</style>
