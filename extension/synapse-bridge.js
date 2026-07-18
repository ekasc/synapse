function isSynapseOrigin(origin) {
	return (
		/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ||
		/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)
	);
}

document.documentElement.dataset.synapseFocusGuard = 'bridge-loaded';

let port;
let portDisconnected = false;

function sendRuntimeMessage(message, callback) {
	try {
		chrome.runtime.sendMessage(message, callback);
	} catch {
		// The content script can outlive an extension reload; ignore that stale tab.
	}
}
try {
	port = chrome.runtime.connect({ name: 'synapse-focus-bridge' });
} catch (error) {
	window.postMessage(
		{ source: 'synapse-extension', type: 'EXTENSION_READY', ok: false, error: String(error) },
		window.location.origin
	);
}

if (!port) {
	// Keep the content script alive while Chrome restarts the worker.
	port = { postMessage() {}, onMessage: { addListener() {} }, onDisconnect: { addListener() {} } };
}

port.onMessage.addListener((response) => {
	if (response.requestId === 'bridge-ready') {
		window.postMessage(
			{ source: 'synapse-extension', type: 'EXTENSION_READY', ok: Boolean(response.ok) },
			window.location.origin
		);
		return;
	}
	window.postMessage({ source: 'synapse-extension', ...response }, window.location.origin);
});

// Do not attach an onDisconnect callback: Chrome can invalidate an old
// content-script context while invoking it during extension reloads.

window.addEventListener('message', (event) => {
	if (event.source !== window || !isSynapseOrigin(event.origin)) return;
	if (event.data?.source !== 'synapse-web') return;
	const allowedTypes = new Set(['START_FOCUS', 'PAUSE_FOCUS', 'END_FOCUS', 'GET_FOCUS_STATE']);
	if (!allowedTypes.has(event.data.type)) return;
	sendRuntimeMessage(
		{ type: event.data.type, payload: event.data.payload },
		(response) => {
			if (chrome.runtime.lastError) return;
			window.postMessage(
				{ source: 'synapse-extension', requestId: event.data.requestId, ...(response ?? {}) },
				window.location.origin
			);
		}
	);
});

window.setTimeout(() => {
	if (!portDisconnected) port.postMessage({ type: 'GET_FOCUS_STATE', requestId: 'bridge-ready' });
}, 50);

// Some Chrome profiles keep an old content-script port alive after a reload.
// A one-shot message provides a reliable readiness check in that case.
window.setTimeout(() => {
	sendRuntimeMessage({ type: 'GET_FOCUS_STATE' }, (response) => {
		if (chrome.runtime.lastError) return;
		window.postMessage(
			{ source: 'synapse-extension', type: 'EXTENSION_READY', ok: Boolean(response?.ok), result: response?.result },
			window.location.origin
		);
	});
}, 75);
