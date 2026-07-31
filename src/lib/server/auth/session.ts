import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const MIN_LENGTH = IV_LENGTH + TAG_LENGTH + 1;

export type SessionPayload = {
	userId: string;
	sessionId: string;
	workosSessionId?: string;
};

function deriveKey(secret: string): Buffer {
	return createHash('sha256').update(secret).digest();
}

export function encrypt(payload: SessionPayload, secret: string): string {
	const key = deriveKey(secret);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decrypt(cookie: string, secret: string): SessionPayload | null {
	try {
		const key = deriveKey(secret);
		const raw = Buffer.from(cookie, 'base64url');
		if (raw.length < MIN_LENGTH) return null;
		const iv = raw.subarray(0, IV_LENGTH);
		const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
		const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(tag);
		const plaintext = decipher.update(encrypted) + decipher.final('utf8');
		return JSON.parse(plaintext) as SessionPayload;
	} catch {
		return null;
	}
}
