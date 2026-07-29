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

<section
	class="my-[1.1rem] mb-5 border-y border-[var(--rule)] py-4"
	aria-labelledby="saved-practice-heading"
>
	<div class="mb-3 flex items-end justify-between gap-4">
		<div>
			<div class="eyebrow">Course library</div>
			<h2
				id="saved-practice-heading"
				class="mt-[0.15rem] mb-0 [font-family:var(--font-body)] text-[length:var(--text-subheading)] leading-[1.1] font-bold"
			>
				Saved practice
			</h2>
		</div>
		{#if sessions.length > 0}
			<span class=" text-[length:var(--text-small)] text-[var(--ink-faint)]"
				>{sessions.length} saved</span
			>
		{/if}
	</div>

	{#if loading}
		<p class="mt-0 mb-3 text-xs text-[var(--ink-faint)]">Loading saved practice…</p>
	{:else if sessions.length === 0}
		<p class="m-0 text-[var(--ink-soft)] text-[var(--text-caption)]">
			Generated quizzes and flashcards for this course will appear here.
		</p>
	{:else}
		<ul class="m-0 grid list-none gap-[0.55rem] p-0">
			{#each sessions as session (session.id)}
				<li
					class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-[var(--rule)] bg-[var(--paper)] p-3 max-[700px]:grid-cols-[minmax(0,1fr)] {activeSessionId ===
					session.id
						? 'border-[var(--ink)] bg-[var(--paper-shelf)]'
						: ''}"
				>
					<div class="min-w-0">
						<div class="font-semibold text-[var(--ink)] text-[var(--text-small)]">
							{sessionTitle(session)}
						</div>
						<div class="mt-[0.15rem] truncate text-[var(--ink-soft)] text-[var(--text-caption)]">
							{sessionSources(session)}
						</div>
						<div
							class="mt-[0.4rem] flex flex-wrap gap-x-3 gap-y-[0.3rem] text-[var(--ink-faint)] text-[var(--text-caption)]"
						>
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
					<div class="flex flex-wrap justify-end gap-[0.4rem] max-[700px]:justify-start">
						<button class="btn btn-secondary btn-sm" onclick={() => onresume(session.id, 'quiz')}
							>review quiz</button
						>
						<button
							class="btn btn-secondary btn-sm"
							onclick={() => onresume(session.id, 'flashcards')}>review cards</button
						>
						<button
							class="cursor-pointer border-0 bg-transparent px-[0.45rem] py-[0.35rem] text-[length:var(--text-micro)] leading-[1.4] text-[var(--pen-red)]"
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
	.eyebrow {
		color: var(--ink-soft);
		font-size: var(--text-small);
	}
</style>
