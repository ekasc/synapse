import { json } from '@sveltejs/kit';

// Public VAPID key only — the private key never leaves the Worker.
export async function GET(event) {
	const env = event.platform?.env as Record<string, string> | undefined;
	return json({
		publicKey: env?.VAPID_PUBLIC_KEY ?? '',
		configured: Boolean(env?.VAPID_PUBLIC_KEY)
	});
}
