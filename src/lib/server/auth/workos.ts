import { WorkOS } from '@workos-inc/node';
import type { RequestEvent } from '@sveltejs/kit';

export type WorkOSProfile = {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	sid: string;
};

let _workos: WorkOS | null = null;

function getWorkOS(apiKey: string, clientId: string): WorkOS {
	if (!_workos) {
		_workos = new WorkOS({ apiKey, clientId });
	}
	return _workos;
}

export function getAuthorizationUrl(event: RequestEvent, state: string): string {
	const { WORKOS_API_KEY, WORKOS_CLIENT_ID } = getEnv(event);
	const workos = getWorkOS(WORKOS_API_KEY, WORKOS_CLIENT_ID);
	// The callback is always same-origin: derive it from the request so local dev
	// (localhost) and deployed (workers.dev / custom domain) never disagree.
	const redirectUri = `${new URL(event.request.url).origin}/auth/callback`;
	return workos.userManagement.getAuthorizationUrl({
		clientId: WORKOS_CLIENT_ID,
		redirectUri,
		state,
		provider: 'authkit'
	});
}

export function randomState(): string {
	const b = new Uint8Array(32);
	crypto.getRandomValues(b);
	return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function exchangeCode(event: RequestEvent, code: string): Promise<WorkOSProfile> {
	const { WORKOS_API_KEY, WORKOS_CLIENT_ID } = getEnv(event);
	const workos = getWorkOS(WORKOS_API_KEY, WORKOS_CLIENT_ID);

	const ipAddress = event.request.headers.get('cf-connecting-ip') ?? undefined;
	const userAgent = event.request.headers.get('user-agent') ?? undefined;

	const response = await workos.userManagement.authenticateWithCode({
		clientId: WORKOS_CLIENT_ID,
		code,
		ipAddress,
		userAgent
	});

	const sid = extractSidFromJWT(response.accessToken);

	return {
		id: response.user.id,
		email: response.user.email,
		firstName: response.user.firstName ?? response.user.email.split('@')[0],
		lastName: response.user.lastName ?? '',
		sid
	};
}

export function getLogoutUrl(event: RequestEvent, sessionId: string, returnTo: string): string {
	const { WORKOS_API_KEY, WORKOS_CLIENT_ID } = getEnv(event);
	const workos = getWorkOS(WORKOS_API_KEY, WORKOS_CLIENT_ID);
	return workos.userManagement.getLogoutUrl({ sessionId, returnTo });
}

function extractSidFromJWT(token: string): string {
	try {
		const payload = token.split('.')[1];
		const decoded = JSON.parse(atob(payload));
		return ((decoded as Record<string, unknown>).sid as string) ?? '';
	} catch {
		return '';
	}
}

function getEnv(event: RequestEvent): {
	WORKOS_API_KEY: string;
	WORKOS_CLIENT_ID: string;
} {
	const platformEnv = event.platform?.env as Record<string, string> | undefined;
	const apiKey = platformEnv?.WORKOS_API_KEY ?? process.env.WORKOS_API_KEY ?? '';
	const clientId = platformEnv?.WORKOS_CLIENT_ID ?? process.env.WORKOS_CLIENT_ID ?? '';

	if (!apiKey || !clientId) {
		throw new Error('WORKOS_API_KEY and WORKOS_CLIENT_ID must be set');
	}

	return { WORKOS_API_KEY: apiKey, WORKOS_CLIENT_ID: clientId };
}
