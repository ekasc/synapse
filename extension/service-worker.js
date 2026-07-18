const SESSION_KEY = 'synapseFocusSession';
const END_ALARM = 'synapse-focus-end';
const OVERRIDE_ALARM = 'synapse-focus-override-end';
const RULE_START_ID = 1000;

function normalizeDomains(domains) {
	return [
		...new Set((domains ?? []).map((domain) => String(domain).trim().toLowerCase()).filter(Boolean))
	];
}

async function currentRuleIds() {
	const rules = await chrome.declarativeNetRequest.getDynamicRules();
	return rules.filter((rule) => rule.id >= RULE_START_ID).map((rule) => rule.id);
}

async function removeBlockingRules() {
	const ids = await currentRuleIds();
	if (ids.length) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
}

async function installBlockingRules(session) {
	await removeBlockingRules();
	if (!session.active || session.paused || session.overrideUntil > Date.now()) return;

	const blockedSites = normalizeDomains(session.blockedSites);
	const allowedSites = new Set(normalizeDomains(session.allowedSites));
	const rules = blockedSites
		.filter((domain) => !allowedSites.has(domain))
		.map((domain, index) => ({
			id: RULE_START_ID + index,
			priority: 1,
			action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
			condition: {
				requestDomains: [domain],
				resourceTypes: ['main_frame']
			}
		}));

	if (rules.length) await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
}

async function saveSession(session) {
	await chrome.storage.local.set({ [SESSION_KEY]: session });
}

async function getSession() {
	const stored = await chrome.storage.local.get(SESSION_KEY);
	return stored[SESSION_KEY] ?? null;
}

async function startFocus(payload) {
	const session = {
		active: true,
		paused: false,
		endsAt: Number(payload.endsAt),
		course: String(payload.course ?? 'Focus'),
		intention: String(payload.intention ?? ''),
		allowedSites: normalizeDomains(payload.allowedSites),
		blockedSites: normalizeDomains(payload.blockedSites),
		overrideUntil: 0
	};
	await saveSession(session);
	await chrome.alarms.clear(END_ALARM);
	await chrome.alarms.create(END_ALARM, { when: session.endsAt });
	await installBlockingRules(session);
	return session;
}

async function pauseFocus() {
	const session = await getSession();
	if (!session) return null;
	session.paused = true;
	await saveSession(session);
	await removeBlockingRules();
	return session;
}

async function endFocus() {
	await removeBlockingRules();
	await chrome.alarms.clear(END_ALARM);
	await chrome.alarms.clear(OVERRIDE_ALARM);
	await chrome.storage.local.remove(SESSION_KEY);
}

async function beginOverride() {
	const session = await getSession();
	if (!session?.active) return null;
	session.overrideUntil = Date.now() + 5 * 60 * 1000;
	await saveSession(session);
	await removeBlockingRules();
	await chrome.alarms.create(OVERRIDE_ALARM, { when: session.overrideUntil });
	return session;
}

async function handleMessage(message) {
	if (message.type === 'START_FOCUS') return startFocus(message.payload ?? {});
	if (message.type === 'PAUSE_FOCUS') return pauseFocus();
	if (message.type === 'END_FOCUS') return endFocus();
	if (message.type === 'GET_FOCUS_STATE') return getSession();
	if (message.type === 'BEGIN_OVERRIDE') return beginOverride();
	return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	handleMessage(message)
		.then((result) => sendResponse({ ok: true, result }))
		.catch((error) => sendResponse({ ok: false, error: String(error) }));
	return true;
});

chrome.runtime.onConnect.addListener((port) => {
	if (port.name !== 'synapse-focus-bridge') return;
	port.onMessage.addListener((message) => {
		handleMessage(message)
			.then((result) => port.postMessage({ requestId: message.requestId, ok: true, result }))
			.catch((error) =>
				port.postMessage({ requestId: message.requestId, ok: false, error: String(error) })
			);
	});
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name === END_ALARM) await endFocus();
	if (alarm.name === OVERRIDE_ALARM) {
		const session = await getSession();
		if (!session || session.endsAt <= Date.now()) return endFocus();
		session.overrideUntil = 0;
		await saveSession(session);
		await installBlockingRules(session);
	}
});

chrome.runtime.onStartup.addListener(async () => {
	const session = await getSession();
	if (!session || session.endsAt <= Date.now()) return endFocus();
	await installBlockingRules(session);
});
