<script lang="ts">
	import { tick } from 'svelte';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';

	type Source = {
		id: string;
		label: string;
		detail: string;
		excerpt: string;
	};

	type ChatMessage = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		sources?: Source[];
		confidence?: 'grounded' | 'limited';
	};

	let { data } = $props();
	const courses = $derived(data.courses ?? []);

	let selectedCourseId = $state('all');
	let draft = $state('');
	let sending = $state(false);
	let errorMessage = $state('');
	let thread: HTMLDivElement;
	let messages = $state<ChatMessage[]>([
		{
			id: 'welcome',
			role: 'assistant',
			content:
				'I can help you find deadlines, explain course material, and connect information across your academic records. Choose a course or ask across your catalog.',
			confidence: 'grounded'
		}
	]);

	const selectedCourse = $derived(courses.find((course) => course.id === selectedCourseId));
	const scopeLabel = $derived(selectedCourse?.code ?? 'All courses');
	const suggestions = $derived(
		selectedCourse
			? [
					`What should I review next for ${selectedCourse.code}?`,
					`Summarize the key topics in ${selectedCourse.code}.`,
					`What deadlines are coming up for ${selectedCourse.code}?`
				]
			: [
					'What deadlines are coming up this week?',
					'Which course needs the most attention?',
					'What should I study tonight?'
				]
	);
	const latestSources = $derived(
		[...messages].reverse().find((message) => message.sources)?.sources ?? []
	);

	function demoAnswer(question: string): ChatMessage {
		const course = selectedCourse;
		if (course) {
			return {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: `This is the frontend demonstration for ${course.code}. Once the RAG service is connected, I’ll retrieve the strongest passages from its syllabus and uploaded materials, then answer “${question}” with page-level citations.`,
				confidence: 'limited',
				sources: [
					{
						id: 'demo-syllabus',
						label: `${course.code} syllabus`,
						detail: 'Demo citation · page 3',
						excerpt: 'Retrieved passages will appear here with the exact supporting text.'
					},
					{
						id: 'demo-notes',
						label: `${course.code} course notes`,
						detail: 'Demo citation · section 2',
						excerpt: 'Source cards will link back to the original uploaded material.'
					}
				]
			};
		}

		return {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: `This is the frontend demonstration. The RAG service will search across your selected courses before answering “${question}”. It will separate recorded facts from study recommendations and decline when no supporting evidence is found.`,
			confidence: 'limited',
			sources: [
				{
					id: 'demo-catalog',
					label: 'Academic catalog',
					detail: `Demo citation · ${courses.length} courses`,
					excerpt: 'Cross-course results will identify the course and source for every claim.'
				}
			]
		};
	}

	async function scrollToLatest() {
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
	}

	async function sendMessage(text = draft) {
		const question = text.trim();
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
				confidence?: 'grounded' | 'limited';
				sources?: Source[];
			};
			if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Unable to answer');
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: payload.answer ?? 'No answer returned.',
					confidence: payload.confidence,
					sources: payload.sources
				}
			];
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to reach the assistant';
		} finally {
			sending = false;
			await scrollToLatest();
		}
	}

	function clearConversation() {
		messages = messages.slice(0, 1);
		draft = '';
		errorMessage = '';
	}
</script>

<svelte:head><title>Synapse · Academic Assistant</title></svelte:head>

<CatalogHeader term="Assistant" />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Academic Assistant</h1>
		<p class="page-tagline">Ask your courses. Verify every answer against its source.</p>
	</div>

	<div class="control-bar">
		<label class="scope-control">
			<span class="font-mono">Search scope</span>
			<select bind:value={selectedCourseId}>
				<option value="all">All courses</option>
				{#each courses as course (course.id)}
					<option value={course.id}>{course.code} — {course.name}</option>
				{/each}
			</select>
		</label>
		<div class="control-actions">
			<span class="demo-stamp font-mono">read-only RAG</span>
			<button class="btn btn-ghost btn-sm" onclick={clearConversation}>clear chat</button>
		</div>
	</div>

	<div class="assistant-layout">
		<section class="chat-panel surface-polaroid" aria-label="Conversation">
			<div class="thread-head">
				<div>
					<span class="font-mono">Current scope</span>
					<strong>{scopeLabel}</strong>
				</div>
				<span class="privacy-note font-mono">read-only</span>
			</div>

			<div class="thread" bind:this={thread} aria-live="polite">
				{#each messages as message (message.id)}
					<article class="message" class:user-message={message.role === 'user'}>
						<div class="message-label font-mono">
							{message.role === 'user' ? 'You' : 'Synapse'}
							{#if message.confidence}
								<span class:limited={message.confidence === 'limited'}>{message.confidence}</span>
							{/if}
						</div>
						<p>{message.content}</p>
						{#if message.sources?.length}
							<div class="inline-sources">
								{#each message.sources as source, index (source.id)}
									<a href={`#source-${source.id}`}
										><span class="font-mono">[{index + 1}]</span> {source.label}</a
									>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
				{#if sending}
					<div class="thinking">
						<span></span><span></span><span></span><em>checking sources</em>
					</div>
				{/if}
			</div>

			<div class="composer">
				{#if errorMessage}<p class="error-message">{errorMessage}</p>{/if}
				<label for="chat-question" class="sr-only">Ask an academic question</label>
				<textarea
					id="chat-question"
					bind:value={draft}
					rows="2"
					placeholder={`Ask ${scopeLabel.toLowerCase()}…`}
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							void sendMessage();
						}
					}}
				></textarea>
				<div class="composer-foot">
					<span class="font-mono">Enter to send · Shift + Enter for a new line</span>
					<button
						class="btn btn-primary"
						disabled={!draft.trim() || sending}
						onclick={() => sendMessage()}>ask Synapse</button
					>
				</div>
			</div>
		</section>

		<aside class="evidence-panel">
			<div class="suggestion-block">
				<p class="eyebrow font-mono">Try asking</p>
				{#each suggestions as suggestion}
					<button onclick={() => sendMessage(suggestion)}>{suggestion}<span>→</span></button>
				{/each}
			</div>

			<div class="source-block surface-polaroid">
				<div class="source-head">
					<div>
						<p class="eyebrow font-mono">Evidence desk</p>
						<h2>Sources</h2>
					</div>
					<span class="font-mono">{messages.at(-1)?.sources?.length ?? 0}</span>
				</div>
				{#if latestSources.length}
					<div class="source-list">
						{#each latestSources as source, index (source.id)}
							<article id={`source-${source.id}`} class="source-card">
								<div class="source-number font-mono">[{index + 1}]</div>
								<div>
									<strong>{source.label}</strong><span class="font-mono">{source.detail}</span>
									<p>{source.excerpt}</p>
								</div>
							</article>
						{/each}
					</div>
				{:else}
					<p class="empty-evidence">Sources supporting the latest answer will appear here.</p>
				{/if}
			</div>
		</aside>
	</div>

	<p class="disclaimer">
		<strong>Evidence first:</strong> answers are limited to your recorded course data and indexed materials.
		Verify important deadlines with the original source.
	</p>
</div>

<style>
	.page {
		max-width: 1100px;
		margin-inline: auto;
		padding-block: 2rem 4rem;
	}
	.page-title {
		font-size: clamp(2.4rem, 4vw, 3rem);
		color: var(--ink);
		margin: 0.25rem 0 0.5rem;
		line-height: 1;
	}
	.page-tagline {
		color: var(--ink-soft);
		font-size: 0.92rem;
		margin: 0.35rem 0 0;
	}
	.control-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--ink);
	}
	.scope-control {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: min(25rem, 100%);
	}
	.scope-control > span,
	.thread-head span,
	.composer-foot span {
		color: var(--ink-faint);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	select,
	textarea {
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-body);
	}
	select {
		min-height: 2.5rem;
		padding: 0.5rem 0.65rem;
	}
	.control-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.demo-stamp {
		padding: 0.25rem 0.45rem;
		border: 1px dashed var(--accent);
		color: var(--accent);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.assistant-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.75fr);
		gap: 1rem;
	}
	.chat-panel {
		padding: 0;
		min-height: 660px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.thread-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--rule);
		background: var(--paper-shelf);
	}
	.thread-head div {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.thread-head strong {
		font-family: var(--font-display);
		font-size: 1rem;
	}
	.privacy-note {
		border: 1px solid var(--rule);
		padding: 0.2rem 0.4rem;
	}
	.thread {
		flex: 1;
		max-height: 500px;
		overflow-y: auto;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		scroll-behavior: smooth;
	}
	.message {
		max-width: 88%;
		border-left: 2px solid var(--highlight);
		padding: 0.2rem 0 0.2rem 0.8rem;
	}
	.message.user-message {
		align-self: flex-end;
		border-left: 0;
		border-right: 2px solid var(--ink);
		padding: 0.2rem 0.8rem 0.2rem 0;
		text-align: right;
	}
	.message-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
	}
	.user-message .message-label {
		justify-content: flex-end;
	}
	.message-label span {
		padding: 0.1rem 0.3rem;
		background: var(--highlight-soft);
		color: var(--ink);
		letter-spacing: 0.05em;
	}
	.message-label span.limited {
		background: var(--paper-shelf);
		color: var(--warn);
	}
	.message p {
		margin: 0;
		color: var(--ink);
		font-size: 0.9rem;
		line-height: 1.6;
	}
	.inline-sources {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.65rem;
	}
	.inline-sources a {
		border-bottom: 2px solid var(--highlight);
		color: var(--ink-soft);
		font-size: 0.7rem;
		text-decoration: none;
	}
	.thinking {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--ink-faint);
	}
	.thinking span {
		width: 5px;
		height: 5px;
		background: var(--ink-faint);
		animation: thinking 1s ease-in-out infinite;
	}
	.thinking span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.thinking span:nth-child(3) {
		animation-delay: 0.3s;
	}
	.thinking em {
		margin-left: 0.4rem;
		font: normal 0.65rem var(--font-mono);
		text-transform: uppercase;
	}
	.composer {
		border-top: 1px solid var(--ink);
		padding: 1rem;
		background: var(--paper-shelf);
	}
	.composer textarea {
		display: block;
		width: 100%;
		min-height: 4.5rem;
		box-sizing: border-box;
		padding: 0.65rem;
		resize: vertical;
		font-size: 0.88rem;
	}
	.composer-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.55rem;
	}
	.evidence-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.suggestion-block {
		border-top: 1px solid var(--ink);
		padding-top: 0.85rem;
	}
	.eyebrow {
		margin: 0 0 0.55rem;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-faint);
	}
	.suggestion-block button {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0.7rem 0.2rem;
		border: 0;
		border-bottom: 1px dashed var(--rule);
		background: transparent;
		color: var(--ink-soft);
		text-align: left;
		font: 0.78rem/1.4 var(--font-body);
		cursor: pointer;
	}
	.suggestion-block button:hover {
		color: var(--ink);
		background: var(--highlight-soft);
	}
	.source-block {
		padding: 1rem;
	}
	.source-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--rule);
	}
	.source-head h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
	}
	.source-head > span {
		border: 1px solid var(--rule);
		padding: 0.2rem 0.4rem;
		font-size: 0.65rem;
	}
	.source-list {
		display: flex;
		flex-direction: column;
	}
	.source-card {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.6rem;
		padding: 0.85rem 0;
		border-bottom: 1px dashed var(--rule);
	}
	.source-number {
		font-size: 0.65rem;
		color: var(--ink-faint);
	}
	.source-card strong,
	.source-card span {
		display: block;
	}
	.source-card strong {
		font-family: var(--font-display);
		font-size: 0.86rem;
	}
	.source-card span {
		margin-top: 0.18rem;
		color: var(--ink-faint);
		font-size: 0.6rem;
		text-transform: uppercase;
	}
	.source-card p,
	.empty-evidence {
		margin: 0.45rem 0 0;
		color: var(--ink-soft);
		font-size: 0.72rem;
		line-height: 1.45;
	}
	.disclaimer {
		margin: 0.85rem 0 0;
		color: var(--ink-faint);
		font-size: 0.7rem;
		line-height: 1.5;
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
	@keyframes thinking {
		50% {
			opacity: 0.25;
			transform: translateY(-2px);
		}
	}
	@media (max-width: 850px) {
		.assistant-layout {
			grid-template-columns: 1fr;
		}
		.chat-panel {
			min-height: 600px;
		}
		.evidence-panel {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 640px) {
		.page {
			padding-block: 1.25rem 5rem;
		}
		.control-bar,
		.composer-foot {
			align-items: stretch;
			flex-direction: column;
		}
		.scope-control {
			min-width: 0;
		}
		.control-actions {
			justify-content: space-between;
		}
		.evidence-panel {
			display: flex;
		}
		.message {
			max-width: 96%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.thinking span {
			animation: none;
		}
		.thread {
			scroll-behavior: auto;
		}
	}
</style>
