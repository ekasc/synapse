<script lang="ts">
	import { tick } from 'svelte';

	type Course = { id: string; code: string; name: string };
	type Message = { id: string; role: 'user' | 'assistant'; content: string };

	let { courses = [] }: { courses?: Course[] } = $props();

	let open = $state(false);
	let selectedCourseId = $state('all');
	let draft = $state('');
	let sending = $state(false);
	let errorMessage = $state('');
	let thread = $state<HTMLDivElement>();
	let composer = $state<HTMLTextAreaElement>();
	let messages = $state<Message[]>([
		{
			id: 'welcome',
			role: 'assistant',
			content: 'What can I help you with? Ask about your courses, deadlines, or study plan.'
		}
	]);

	const selectedCourse = $derived(courses.find((course) => course.id === selectedCourseId));
	const scopeLabel = $derived(selectedCourse?.code ?? 'All courses');

	async function openDrawer() {
		open = true;
		await tick();
		composer?.focus();
	}

	function closeDrawer() {
		open = false;
	}

	async function scrollToLatest() {
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
	}

	async function sendMessage() {
		const question = draft.trim();
		if (!question || sending) return;
		messages = [...messages, { id: crypto.randomUUID(), role: 'user', content: question }];
		draft = '';
		sending = true;
		errorMessage = '';
		await scrollToLatest();

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					question,
					courseId: selectedCourseId,
					history: messages.slice(-8).map(({ role, content }) => ({ role, content }))
				})
			});
			const payload = (await response.json()) as {
				ok?: boolean;
				error?: string;
				answer?: string;
			};
			if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Unable to answer');
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: payload.answer ?? 'No answer returned.'
				}
			];
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to reach the assistant';
		} finally {
			sending = false;
			await scrollToLatest();
			composer?.focus();
		}
	}

	function clearConversation() {
		messages = messages.slice(0, 1);
		errorMessage = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) closeDrawer();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<button class="assistant-backdrop" aria-label="Close assistant" onclick={closeDrawer}></button>
	<aside class="assistant-drawer" aria-label="Synapse assistant">
		<header>
			<div>
				<span>Synapse</span>
				<h2>Academic Assistant</h2>
			</div>
			<button class="close-button" onclick={closeDrawer} aria-label="Close assistant">×</button>
		</header>

		<div class="drawer-controls">
			<label>
				<span>Search scope</span>
				<select bind:value={selectedCourseId}>
					<option value="all">All courses</option>
					{#each courses as course (course.id)}
						<option value={course.id}>{course.code} — {course.name}</option>
					{/each}
				</select>
			</label>
			<button onclick={clearConversation}>clear</button>
		</div>

		<div class="drawer-thread" bind:this={thread} aria-live="polite">
			{#each messages as message (message.id)}
				<article class:user={message.role === 'user'}>
					<span>{message.role === 'user' ? 'You' : 'Synapse'}</span>
					<p>{message.content}</p>
				</article>
			{/each}
			{#if sending}
				<p class="thinking">Thinking…</p>
			{/if}
		</div>

		<footer>
			{#if errorMessage}<p class="error-message" role="alert">{errorMessage}</p>{/if}
			<label for="assistant-drawer-question" class="sr-only">Ask Synapse</label>
			<textarea
				id="assistant-drawer-question"
				bind:this={composer}
				bind:value={draft}
				rows="3"
				placeholder={`Ask ${scopeLabel.toLowerCase()}…`}
				onkeydown={(event) => {
					if (event.key === 'Enter' && !event.shiftKey) {
						event.preventDefault();
						void sendMessage();
					}
				}}
			></textarea>
			<div class="composer-actions">
				<span>Enter to send</span>
				<button class="send-button" disabled={!draft.trim() || sending} onclick={sendMessage}>
					Ask Synapse
				</button>
			</div>
		</footer>
	</aside>
{:else}
	<button class="assistant-toggle" onclick={openDrawer} aria-label="Open Synapse assistant">
		<span aria-hidden="true">✦</span>
		Ask Synapse
	</button>
{/if}

<style>
	.assistant-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		border: 0;
		background: rgb(24 22 18 / 0.18);
		cursor: default;
	}
	.assistant-drawer {
		position: fixed;
		inset: 0 0 0 auto;
		z-index: 81;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		width: min(430px, calc(100vw - 2rem));
		border-left: 1px solid var(--ink);
		background: var(--paper);
		box-shadow: -12px 0 35px rgb(24 22 18 / 0.16);
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		border-bottom: 1px solid var(--ink);
		background: var(--paper-shelf);
	}
	header span,
	.drawer-controls label > span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	h2 {
		margin: 0.2rem 0 0;
		font: 700 1.35rem/1.1 var(--font-body);
	}
	.close-button {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--rule);
		background: transparent;
		color: var(--ink);
		font-size: 1.4rem;
		cursor: pointer;
	}
	.drawer-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.75rem;
		padding: 0.9rem 1.25rem;
		border-bottom: 1px solid var(--rule);
	}
	.drawer-controls label {
		display: grid;
		gap: 0.35rem;
	}
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		font: var(--text-small)/1.45 var(--font-body);
	}
	select {
		min-height: 2.4rem;
		padding: 0.45rem 0.55rem;
	}
	.drawer-controls > button {
		min-height: 2.4rem;
		border: 0;
		background: transparent;
		color: var(--ink-soft);
		cursor: pointer;
	}
	.drawer-thread {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		overflow-y: auto;
		padding: 1.25rem;
	}
	article {
		max-width: 90%;
		padding-left: 0.75rem;
		border-left: 2px solid var(--rule);
	}
	article.user {
		align-self: flex-end;
		padding-right: 0.75rem;
		padding-left: 0;
		border-right: 2px solid var(--ink);
		border-left: 0;
		text-align: right;
	}
	article > span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	article p {
		margin: 0.35rem 0 0;
		font-size: var(--text-small);
		line-height: 1.55;
	}
	.thinking {
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}
	footer {
		padding: 1rem 1.25rem 1.25rem;
		border-top: 1px solid var(--ink);
		background: var(--paper-shelf);
	}
	textarea {
		display: block;
		min-height: 5rem;
		padding: 0.65rem;
		resize: vertical;
	}
	.composer-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.6rem;
	}
	.composer-actions > span {
		color: var(--ink-faint);
		font-size: var(--text-caption);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.send-button,
	.assistant-toggle {
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--paper);
		font: 600 var(--text-small)/1 var(--font-body);
		cursor: pointer;
	}
	.send-button {
		padding: 0.75rem 0.9rem;
	}
	.send-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.error-message {
		margin: 0 0 0.7rem;
		border: 1px solid rgb(194 54 42 / 0.4);
		padding: 0.55rem;
		color: var(--pen-red);
		font-size: var(--text-caption);
	}
	.assistant-toggle {
		position: fixed;
		right: 1.5rem;
		bottom: 1.5rem;
		z-index: 70;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 1rem;
		box-shadow: 4px 4px 0 var(--highlight);
	}
	.assistant-toggle span {
		color: var(--highlight);
		font-size: 1.1rem;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 640px) {
		.assistant-drawer {
			width: 100vw;
		}
		.assistant-toggle {
			right: 1rem;
			bottom: 1rem;
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.assistant-drawer {
			animation: slide-in 160ms var(--ease-out-quart);
		}
		@keyframes slide-in {
			from {
				transform: translateX(100%);
			}
		}
	}
</style>
