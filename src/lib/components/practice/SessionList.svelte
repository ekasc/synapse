<script lang="ts">
	type MaterialSource = {
		materialId: string;
		fileName: string;
		pageStart?: number;
		pageEnd?: number;
	};

	type Session = {
		id: string;
		courseId: string;
		courseCode: string;
		status: 'in_progress' | 'completed' | 'paused';
		score: number;
		questionCount: number;
		flashcardCount: number;
		topics: string[];
		sourceMaterials: MaterialSource[];
		createdAt: string;
		updatedAt: string;
	};

	let {
		sessions,
		activeSessionId = null,
		loading = false,
		onresume,
		ondelete
	}: {
		sessions: Session[];
		activeSessionId?: string | null;
		loading?: boolean;
		onresume: (sessionId: string, mode: 'quiz' | 'flashcards') => void;
		ondelete: (sessionId: string) => void;
	} = $props();

	function sessionTitle(session: Session) {
		return session.topics.length > 0 ? session.topics.slice(0, 2).join(' · ') : 'Broad review';
	}

	function sessionSources(session: Session) {
		return session.sourceMaterials.map((source) => source.fileName).join(', ');
	}
</script>

<section class="saved-practice" aria-labelledby="saved-practice-heading">
	<div class="saved-practice-head">
		<div>
			<div class="eyebrow font-mono">Course library</div>
			<h2 id="saved-practice-heading">Saved practice</h2>
		</div>
		{#if sessions.length > 0}
			<span class="saved-count font-mono">{sessions.length} saved</span>
		{/if}
	</div>

	{#if loading}
		<p class="shelf-status font-mono">Loading saved practice…</p>
	{:else if sessions.length === 0}
		<p class="saved-empty">Generated quizzes and flashcards for this course will appear here.</p>
	{:else}
		<ul class="sessions-shelf">
			{#each sessions as session (session.id)}
				<li class="session-row" class:session-active={activeSessionId === session.id}>
					<div class="session-info">
						<div class="session-title">{sessionTitle(session)}</div>
						<div class="session-sources">{sessionSources(session)}</div>
						<div class="session-meta font-mono">
							<span>{session.questionCount} questions</span>
							<span>{session.flashcardCount} cards</span>
							<span>{session.score}/{session.questionCount} correct</span>
							<span>{session.status.replace('_', ' ')}</span>
							<time datetime={session.updatedAt}
								>{new Date(session.updatedAt).toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}</time
							>
						</div>
					</div>
					<div class="session-actions">
						<button class="btn btn-secondary btn-sm" onclick={() => onresume(session.id, 'quiz')}
							>review quiz</button
						>
						<button
							class="btn btn-secondary btn-sm"
							onclick={() => onresume(session.id, 'flashcards')}>review cards</button
						>
						<button
							class="session-delete"
							onclick={() => ondelete(session.id)}
							aria-label={`Delete ${sessionTitle(session)} practice set`}>delete</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.shelf-status {
		font-size: 0.75rem;
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin: 0 0 0.75rem;
	}

	.saved-practice {
		padding: 1rem 0;
		margin: 1.1rem 0 1.25rem;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}

	.saved-practice-head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.saved-practice-head h2 {
		margin: 0.15rem 0 0;
		font: 700 1.3rem var(--font-hand);
		line-height: 1.1;
	}

	.saved-practice-head .eyebrow,
	.saved-count {
		color: var(--ink-faint);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.saved-empty {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.86rem;
	}

	.sessions-shelf {
		display: grid;
		gap: 0.55rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.session-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid var(--rule);
		background: var(--paper);
	}

	.session-row.session-active {
		border-color: var(--ink);
		background: var(--paper-shelf);
	}

	.session-info {
		min-width: 0;
	}

	.session-title {
		color: var(--ink);
		font-size: 0.92rem;
		font-weight: 600;
	}

	.session-sources {
		overflow: hidden;
		margin-top: 0.15rem;
		color: var(--ink-soft);
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.session-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.75rem;
		margin-top: 0.4rem;
		color: var(--ink-faint);
		font-size: 0.65rem;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.session-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.session-delete {
		padding: 0.35rem 0.45rem;
		border: 0;
		background: transparent;
		color: var(--pen-red);
		font: 0.65rem var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	@media (max-width: 700px) {
		.session-row {
			grid-template-columns: minmax(0, 1fr);
		}

		.session-actions {
			justify-content: flex-start;
		}
	}
</style>
