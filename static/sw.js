// Service worker for Synapse weekly digest push notifications.
// The browser decrypts the Web Push payload (RFC 8291) before this runs.
self.addEventListener('push', (event) => {
	let data;
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : '' };
	}
	const title = data.title || 'Synapse';
	event.waitUntil(
		self.registration.showNotification(title, {
			body: data.body || 'Your weekly plan is ready.',
			tag: 'weekly-digest',
			data: { url: data.url || '/app/weekly' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || '/app/weekly';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if ('focus' in client) {
					if ('navigate' in client) client.navigate(url);
					return client.focus();
				}
			}
			if (self.clients.openWindow) return self.clients.openWindow(url);
		})
	);
});
