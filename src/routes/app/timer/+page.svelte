<script lang="ts">
	import { onMount } from 'svelte';
	import CatalogHeader from '$lib/components/catalog/CatalogHeader.svelte';

	type SessionState = 'ready' | 'running' | 'paused' | 'complete';
	type SiteKind = 'allowed' | 'blocked';
	type SavedSession = {
		id: string;
		courseId: string | null;
		intention: string;
		completedSeconds: number;
		focusScore: number;
		completedAt: string;
	};

	let { data } = $props();
	const courses = $derived(data.courses ?? []);

	let selectedCourseId = $state('');
	let intention = $state('');
	let durationMinutes = $state(25);
	let remainingSeconds = $state(25 * 60);
	let sessionState = $state<SessionState>('ready');
	let endsAt = $state<number | null>(null);
	let distractionCount = $state(0);
	let distractionSeconds = $state<number[]>([]);
	let allowedSites = $state<string[]>([]);
	let blockedSites = $state<string[]>([]);
	let recentSessions = $state<SavedSession[]>([]);
	let allowedDraft = $state('');
	let blockedDraft = $state('');
	let siteError = $state('');
	let startedAt = $state<string | null>(null);
	let sessionSaved = $state(false);
	let saveMessage = $state('');
	let extensionConnected = $state(false);
	let extensionBridgeLoaded = $state(false);
	let extensionError = $state('');

	const totalSeconds = $derived(durationMinutes * 60);
	const elapsedSeconds = $derived(Math.max(0, totalSeconds - remainingSeconds));
	const progress = $derived(totalSeconds === 0 ? 0 : elapsedSeconds / totalSeconds);
	const focusScore = $derived(
		Math.max(0, Math.round(100 - distractionCount * 8 - (sessionState === 'paused' ? 4 : 0)))
	);
	const selectedCourse = $derived(courses.find((course) => course.id === selectedCourseId));
	const ringOffset = $derived(314.16 * (1 - progress));
	const todayMinutes = $derived(
		Math.round(
			recentSessions
				.filter(
					(session) => new Date(session.completedAt).toDateString() === new Date().toDateString()
				)
				.reduce((total, session) => total + session.completedSeconds, 0) / 60
		)
	);

	function formatTime(seconds: number) {
		const minutes = Math.floor(seconds / 60);
		return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function setDuration(minutes: number) {
		if (sessionState !== 'ready') return;
		durationMinutes = minutes;
		remainingSeconds = minutes * 60;
	}

	function startSession() {
		if (sessionState === 'complete') resetSession();
		if (!startedAt) startedAt = new Date().toISOString();
		endsAt = Date.now() + remainingSeconds * 1000;
		sessionState = 'running';
		void sendExtensionCommand('START_FOCUS', {
			endsAt,
			course: selectedCourse?.code ?? 'General study',
			intention,
			allowedSites,
			blockedSites
		});
	}

	function pauseSession() {
		if (sessionState !== 'running') return;
		remainingSeconds = Math.max(0, Math.ceil(((endsAt ?? Date.now()) - Date.now()) / 1000));
		endsAt = null;
		sessionState = 'paused';
		void sendExtensionCommand('PAUSE_FOCUS');
	}

	function resetSession() {
		sessionState = 'ready';
		endsAt = null;
		remainingSeconds = durationMinutes * 60;
		distractionCount = 0;
		distractionSeconds = [];
		startedAt = null;
		sessionSaved = false;
		saveMessage = '';
		void sendExtensionCommand('END_FOCUS');
	}

	function recordDistraction() {
		if (sessionState !== 'running') return;
		distractionCount += 1;
		distractionSeconds = [...distractionSeconds, elapsedSeconds];
	}

	function normalizeDomain(value: string) {
		const trimmed = value.trim().toLowerCase();
		if (!trimmed) return '';
		try {
			const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
			return url.hostname.replace(/^www\./, '');
		} catch {
			return '';
		}
	}

	function addSite(kind: SiteKind) {
		const draft = kind === 'allowed' ? allowedDraft : blockedDraft;
		const domain = normalizeDomain(draft);
		if (!domain) {
			siteError = 'Enter a valid website domain.';
			return;
		}
		if (allowedSites.includes(domain) || blockedSites.includes(domain)) {
			siteError = 'That website is already in a focus list.';
			return;
		}
		siteError = '';
		if (kind === 'allowed') {
			allowedSites = [...allowedSites, domain];
			allowedDraft = '';
		} else {
			blockedSites = [...blockedSites, domain];
			blockedDraft = '';
		}
		persistSites();
	}

	function removeSite(kind: SiteKind, domain: string) {
		if (kind === 'allowed') allowedSites = allowedSites.filter((site) => site !== domain);
		else blockedSites = blockedSites.filter((site) => site !== domain);
		persistSites();
	}

	async function persistSites() {
		try {
			const response = await fetch('/api/timer/preferences', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ allowedSites, blockedSites })
			});
			if (!response.ok) throw new Error('Could not save focus lists');
			siteError = '';
			if (sessionState === 'running' && endsAt) {
				void sendExtensionCommand('START_FOCUS', {
					endsAt,
					course: selectedCourse?.code ?? 'General study',
					intention,
					allowedSites,
					blockedSites
				});
			}
		} catch {
			siteError = 'The focus lists could not be saved. Try again.';
		}
	}

	function sendExtensionCommand(type: string, payload?: Record<string, unknown>) {
		return new Promise<boolean>((resolve) => {
			const requestId = crypto.randomUUID();
			const timeout = window.setTimeout(() => {
				window.removeEventListener('message', receive);
				extensionConnected = false;
				extensionError = 'No response from the extension service worker.';
				resolve(false);
			}, 2500);
			function receive(event: MessageEvent) {
				if (
					event.source !== window ||
					event.data?.source !== 'synapse-extension' ||
					event.data?.requestId !== requestId
				)
					return;
				window.clearTimeout(timeout);
				window.removeEventListener('message', receive);
				extensionConnected = Boolean(event.data.ok);
				extensionError = extensionConnected
					? ''
					: String(event.data.error ?? 'Unknown extension error.');
				resolve(extensionConnected);
			}
			window.addEventListener('message', receive);
			const safePayload = payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
			window.postMessage(
				{ source: 'synapse-web', type, payload: safePayload, requestId },
				window.location.origin
			);
		});
	}

	async function saveCompletedSession() {
		if (sessionSaved || !startedAt) return;
		sessionSaved = true;
		try {
			const response = await fetch('/api/timer/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					courseId: selectedCourseId || null,
					intention,
					plannedSeconds: totalSeconds,
					completedSeconds: totalSeconds,
					distractionCount,
					focusScore,
					startedAt
				})
			});
			if (!response.ok) throw new Error('Could not save session');
			const saved = (await response.json()) as SavedSession;
			recentSessions = [saved, ...recentSessions].slice(0, 10);
			saveMessage = 'Session saved to your study history.';
		} catch {
			sessionSaved = false;
			saveMessage = 'Session finished, but could not be saved.';
		}
	}

	onMount(() => {
		allowedSites = data.preferences?.allowedSites ?? [];
		blockedSites = data.preferences?.blockedSites ?? [];
		recentSessions = data.sessions ?? [];
		selectedCourseId = courses[0]?.id ?? '';
		extensionBridgeLoaded = document.documentElement.dataset.synapseFocusGuard === 'bridge-loaded';
		const receiveExtensionReady = (event: MessageEvent) => {
			if (
				event.source === window &&
				event.data?.source === 'synapse-extension' &&
				event.data?.type === 'EXTENSION_READY'
			) {
				extensionConnected = Boolean(event.data.ok);
				void sendExtensionCommand('GET_FOCUS_STATE');
			}
		};
		window.addEventListener('message', receiveExtensionReady);
		void sendExtensionCommand('GET_FOCUS_STATE');
		const connectionRetry = window.setTimeout(
			() => void sendExtensionCommand('GET_FOCUS_STATE'),
			1500
		);
		const interval = window.setInterval(() => {
			if (sessionState !== 'running' || endsAt === null) return;
			remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
			if (remainingSeconds === 0) {
				endsAt = null;
				sessionState = 'complete';
				void sendExtensionCommand('END_FOCUS');
				void saveCompletedSession();
			}
		}, 250);

		return () => {
			window.clearInterval(interval);
			window.clearTimeout(connectionRetry);
			window.removeEventListener('message', receiveExtensionReady);
		};
	});
</script>

<svelte:head><title>Synapse · Study Timer</title></svelte:head>

<CatalogHeader term="Focus" />

<div class="page page-enter">
	<div class="page-cover">
		<h1 class="page-title font-hand">Study Timer</h1>
		<p class="page-tagline">Choose the work. Protect the time. Notice the distractions.</p>
	</div>

	<div class="control-bar">
		<span class="control-label font-mono">
			{selectedCourse?.code ?? 'general study'} · {durationMinutes} minute session
		</span>
		<div class="session-status" data-state={sessionState}>
			<span class="status-dot"></span>{sessionState}
		</div>
	</div>

	<div class="workspace">
		<section class="timer-sheet surface-polaroid" aria-label="Study timer">
			<div class="session-fields">
				<label>
					<span>Course</span>
					<select bind:value={selectedCourseId} disabled={sessionState !== 'ready'}>
						{#if courses.length === 0}<option value="">General study</option>{/if}
						{#each courses as course (course.id)}
							<option value={course.id}>{course.code} — {course.name}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Session intention</span>
					<input
						bind:value={intention}
						placeholder="e.g. Review graph traversal"
						disabled={sessionState !== 'ready'}
					/>
				</label>
			</div>

			<div class="duration-tabs" aria-label="Timer duration">
				{#each [25, 45, 60] as minutes}
					<button
						class="font-mono"
						class:active={durationMinutes === minutes}
						onclick={() => setDuration(minutes)}
						disabled={sessionState !== 'ready'}>{minutes} min</button
					>
				{/each}
			</div>

			<div class="clock-wrap">
				<svg
					class="progress-ring"
					viewBox="0 0 120 120"
					role="img"
					aria-label={`${Math.round(progress * 100)} percent complete`}
				>
					<circle class="ring-track" cx="60" cy="60" r="50"></circle>
					<circle
						class="ring-progress"
						cx="60"
						cy="60"
						r="50"
						style={`stroke-dashoffset: ${ringOffset}`}
					></circle>
				</svg>
				<div class="clock-copy">
					<span class="clock-label">{selectedCourse?.code ?? 'FOCUS'}</span>
					<strong>{formatTime(remainingSeconds)}</strong>
					<span>{intention || 'Set an intention before you begin'}</span>
				</div>
			</div>

			<div class="timer-actions">
				{#if sessionState === 'running'}
					<button class="btn btn-primary" onclick={pauseSession}>pause</button>
				{:else}
					<button class="btn btn-primary" onclick={startSession}
						>{sessionState === 'paused'
							? 'resume'
							: sessionState === 'complete'
								? 'start again'
								: 'start focus'}</button
					>
				{/if}
				<button class="btn btn-secondary" onclick={resetSession} disabled={sessionState === 'ready'}
					>reset</button
				>
				<button
					class="btn btn-danger distraction"
					onclick={recordDistraction}
					disabled={sessionState !== 'running'}>+ log distraction</button
				>
			</div>
		</section>

		<aside class="productivity-sheet surface-polaroid" aria-label="Live productivity">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Live notes</p>
					<h2>Productivity</h2>
				</div>
				<strong class="score">{focusScore}<small>/100</small></strong>
			</div>
			<div class="score-rule"><span style={`width: ${focusScore}%`}></span></div>
			<div class="metric-row">
				<div><strong>{formatTime(elapsedSeconds)}</strong><span>focused</span></div>
				<div><strong>{distractionCount}</strong><span>distractions</span></div>
				<div><strong>{todayMinutes}m</strong><span>today</span></div>
			</div>

			<div class="timeline-block">
				<div class="timeline-label">
					<span>Session trace</span><span>{durationMinutes} min</span>
				</div>
				<div class="session-trace" aria-label="Session progress and recorded distractions">
					<div class="trace-progress" style={`width: ${progress * 100}%`}></div>
					{#each distractionSeconds as second, index}
						<span
							class="trace-mark"
							style={`left: ${(second / totalSeconds) * 100}%`}
							title={`Distraction ${index + 1}`}
						></span>
					{/each}
				</div>
				<p class="trace-note">
					Marks appear when you log a distraction. Synapse does not inspect your browsing.
				</p>
			</div>

			<div class="focus-note">
				<span class="font-hand"
					>{focusScore >= 90
						? 'steady attention'
						: focusScore >= 70
							? 'a few interruptions'
							: 'reset, then continue'}</span
				>
				<p>
					{sessionState === 'running'
						? 'Your focus trace updates as this session unfolds.'
						: 'Start the timer to begin a new productivity trace.'}
				</p>
			</div>
			{#if saveMessage}<p class="save-message" class:error={saveMessage.includes('could not')}>
					{saveMessage}
				</p>{/if}
		</aside>
	</div>

	<section class="site-lists">
		<div class="site-column allowed surface-polaroid">
			<div class="site-title">
				<div>
					<p class="eyebrow">Open shelf</p>
					<h2>Allowed websites</h2>
				</div>
				<span>{allowedSites.length}</span>
			</div>
			<div class="site-add">
				<input
					bind:value={allowedDraft}
					onkeydown={(event) => event.key === 'Enter' && addSite('allowed')}
					placeholder="notebooklm.google.com"
					aria-label="Allowed website domain"
				/><button class="btn btn-primary" onclick={() => addSite('allowed')}>add</button>
			</div>
			<ul>
				{#each allowedSites as site (site)}<li>
						<a href={`https://${site}`} target="_blank" rel="noreferrer">{site}</a><button
							onclick={() => removeSite('allowed', site)}
							aria-label={`Remove ${site}`}>×</button
						>
					</li>{/each}
			</ul>
		</div>
		<div class="site-column blocked surface-polaroid">
			<div class="site-title">
				<div>
					<p class="eyebrow">Do not disturb</p>
					<h2>Blocked websites</h2>
				</div>
				<span>{blockedSites.length}</span>
			</div>
			<div class="site-add">
				<input
					bind:value={blockedDraft}
					onkeydown={(event) => event.key === 'Enter' && addSite('blocked')}
					placeholder="social.example.com"
					aria-label="Blocked website domain"
				/><button class="btn btn-primary" onclick={() => addSite('blocked')}>add</button>
			</div>
			<ul>
				{#each blockedSites as site (site)}<li>
						<span>{site}</span><button
							onclick={() => removeSite('blocked', site)}
							aria-label={`Remove ${site}`}>×</button
						>
					</li>{/each}
			</ul>
		</div>
	</section>
	{#if siteError}<p class="form-error" role="alert">{siteError}</p>{/if}
	<p class="extension-note">
		<strong>Focus Guard:</strong>
		{extensionConnected
			? 'connected — blocked domains will be enforced while the timer runs.'
			: extensionBridgeLoaded
				? `Focus Guard is installed but not responding. Reload the extension from chrome://extensions, then refresh this page.`
				: 'not connected — the extension is not running on this page.'}
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
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--ink);
	}
	.control-label {
		font-size: 0.72rem;
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.section-heading,
	.site-title {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-faint);
	}
	.session-status {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--rule);
		padding: 0.45rem 0.65rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	.status-dot {
		width: 0.48rem;
		height: 0.48rem;
		background: var(--ink-faint);
	}
	.session-status[data-state='running'] .status-dot {
		background: var(--ok);
		animation: pulse 1.4s ease-in-out infinite;
	}
	.session-status[data-state='complete'] {
		background: var(--highlight);
		border-color: var(--ink);
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(290px, 0.8fr);
		gap: 1rem;
	}
	.timer-sheet,
	.productivity-sheet,
	.site-column {
		border: 1px solid var(--rule);
		padding: 1.25rem;
	}
	.session-fields {
		display: grid;
		grid-template-columns: 0.75fr 1.25fr;
		gap: 0.75rem;
	}
	label span {
		display: block;
		margin-bottom: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-soft);
	}
	input,
	select {
		width: 100%;
		min-height: 2.5rem;
		box-sizing: border-box;
		border: 1px solid var(--rule);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		padding: 0.55rem 0.65rem;
		font: 0.8rem var(--font-body);
	}
	input:disabled,
	select:disabled {
		opacity: 0.6;
	}
	.duration-tabs {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
		margin: 1.5rem 0 0.75rem;
	}
	button {
		border-radius: 0;
		font-family: var(--font-body);
		cursor: pointer;
		transition:
			transform 0.12s var(--ease-out-quart),
			background 0.12s var(--ease-out-quart);
	}
	button:active:not(:disabled) {
		transform: translateY(2px);
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
	.duration-tabs button {
		border: 1px solid var(--rule);
		background: transparent;
		padding: 0.45rem 0.75rem;
		color: var(--ink-soft);
		font: 0.7rem var(--font-mono);
		text-transform: uppercase;
	}
	.duration-tabs button.active {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}
	.clock-wrap {
		width: min(22rem, 100%);
		aspect-ratio: 1;
		margin: 0 auto;
		position: relative;
		display: grid;
		place-items: center;
	}
	.progress-ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.ring-track,
	.ring-progress {
		fill: none;
		stroke-width: 2;
	}
	.ring-track {
		stroke: var(--rule-soft);
		stroke-dasharray: 2 4;
	}
	.ring-progress {
		stroke: var(--ink);
		stroke-linecap: square;
		stroke-dasharray: 314.16;
		transition: stroke-dashoffset 0.25s linear;
	}
	.clock-copy {
		width: 70%;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.clock-copy strong {
		font: 500 clamp(2.8rem, 7vw, 4.5rem) var(--font-mono);
		letter-spacing: -0.08em;
	}
	.clock-copy > span:last-child {
		color: var(--ink-soft);
		font-size: 0.78rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.clock-label {
		font: 0.68rem var(--font-mono);
		letter-spacing: 0.14em;
		color: var(--ink-faint);
	}
	.timer-actions {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.distraction {
		margin-left: auto;
	}
	.score {
		font: 500 2rem var(--font-mono);
	}
	.score small {
		font-size: 0.7rem;
		color: var(--ink-faint);
	}
	.score-rule {
		height: 0.4rem;
		margin: 1rem 0 1.25rem;
		background: var(--rule-soft);
	}
	.score-rule span {
		display: block;
		height: 100%;
		background: var(--highlight);
		border-right: 2px solid var(--ink);
		transition: width 0.2s var(--ease-out-quart);
	}
	.metric-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-block: 1px solid var(--rule);
	}
	.metric-row div {
		padding: 0.9rem 0.45rem;
		border-right: 1px solid var(--rule);
	}
	.metric-row div:last-child {
		border: 0;
	}
	.metric-row strong,
	.metric-row span {
		display: block;
	}
	.metric-row strong {
		font: 500 1rem var(--font-mono);
	}
	.metric-row span {
		margin-top: 0.25rem;
		color: var(--ink-faint);
		font-size: 0.65rem;
		text-transform: uppercase;
	}
	.timeline-block {
		margin-top: 1.3rem;
	}
	.timeline-label {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
		font: 0.67rem var(--font-mono);
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.session-trace {
		height: 2rem;
		border: 1px solid var(--ink);
		position: relative;
		background: var(--paper);
	}
	.trace-progress {
		height: 100%;
		background: var(--highlight-soft);
		border-right: 1px solid var(--ink);
		max-width: 100%;
	}
	.trace-mark {
		position: absolute;
		top: -0.3rem;
		bottom: -0.3rem;
		width: 2px;
		background: var(--pen-red);
	}
	.trace-note,
	.focus-note p,
	.extension-note {
		color: var(--ink-faint);
		font-size: 0.72rem;
		line-height: 1.5;
	}
	.focus-note {
		border-left: 2px solid var(--highlight);
		margin-top: 1.3rem;
		padding: 0.25rem 0 0.25rem 0.75rem;
	}
	.focus-note span {
		font-size: 1.15rem;
	}
	.focus-note p {
		margin: 0.25rem 0 0;
	}
	.site-lists {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}
	.site-title > span {
		font: 0.7rem var(--font-mono);
		border: 1px solid var(--rule);
		padding: 0.25rem 0.45rem;
	}
	.site-add {
		display: grid;
		grid-template-columns: 1fr auto;
		margin-top: 1rem;
	}
	.site-add input {
		border-right: 0;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 0;
	}
	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.25rem;
		border-bottom: 1px dashed var(--rule);
		font: 0.75rem var(--font-mono);
	}
	li a {
		color: var(--ink);
		text-decoration-color: var(--highlight);
		text-decoration-thickness: 3px;
	}
	li button {
		border: 0;
		background: transparent;
		color: var(--ink-faint);
		font-size: 1rem;
	}
	.blocked {
		border-top: 2px solid var(--pen-red);
	}
	.allowed {
		border-top: 2px solid var(--ink);
	}
	.form-error {
		color: var(--pen-red);
		font-size: 0.75rem;
		margin: 0.5rem 0 0;
	}
	.extension-note {
		margin: 0.75rem 0 0;
	}
	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}
	@media (max-width: 900px) {
		.workspace {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 640px) {
		.page {
			padding-block: 1.25rem 5rem;
		}
		.control-bar {
			align-items: flex-start;
		}
		.session-fields,
		.site-lists {
			grid-template-columns: 1fr;
		}
		.distraction {
			margin-left: 0;
		}
		.timer-actions button {
			flex: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.status-dot,
		.ring-progress {
			animation: none;
			transition: none;
		}
	}
</style>
