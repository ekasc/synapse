export type VapidKeys = { publicKey: string; privateKey: string };

type Bytes = Uint8Array<ArrayBuffer>;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Web Crypto only accepts ArrayBuffer-backed views; this coerces any Uint8Array.
function toBuffer(bytes: Uint8Array): Bytes {
	if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0) {
		return bytes as Bytes;
	}
	const out = new Uint8Array(bytes.byteLength);
	out.set(bytes, 0);
	return out;
}

export function base64UrlToBytes(value: string): Bytes {
	const pad = (4 - (value.length % 4)) % 4;
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(...arrays: Uint8Array[]): Bytes {
	const total = arrays.reduce((sum, a) => sum + a.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const a of arrays) {
		out.set(a, offset);
		offset += a.length;
	}
	return out;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		toBuffer(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, toBuffer(data)));
}

export async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Bytes> {
	const effectiveSalt = salt.length === 0 ? new Uint8Array(32) : salt;
	return hmacSha256(effectiveSalt, ikm);
}

export async function hkdfExpand(
	prk: Uint8Array,
	info: Uint8Array,
	length: number
): Promise<Bytes> {
	const hashLen = 32;
	const n = Math.ceil(length / hashLen);
	const okm = new Uint8Array(n * hashLen);
	let prev: Bytes = new Uint8Array(0);
	for (let i = 1; i <= n; i++) {
		const input = new Uint8Array(prev.length + info.length + 1);
		input.set(prev, 0);
		input.set(info, prev.length);
		input[prev.length + info.length] = i;
		prev = await hmacSha256(prk, input);
		okm.set(prev, (i - 1) * hashLen);
	}
	return okm.slice(0, length);
}

export async function generateVapidKeys(): Promise<VapidKeys> {
	const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
		'sign',
		'verify'
	]);
	const pubJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
	const x = base64UrlToBytes(pubJwk.x!);
	const y = base64UrlToBytes(pubJwk.y!);
	const point = new Uint8Array(65);
	point[0] = 0x04;
	point.set(x, 1);
	point.set(y, 33);
	const privJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
	return {
		publicKey: bytesToBase64Url(point),
		privateKey: privJwk.d!
	};
}

export async function ecdhSharedSecret(
	serverKeys: VapidKeys,
	clientPublicKey: string
): Promise<Uint8Array> {
	const pubPoint = base64UrlToBytes(serverKeys.publicKey);
	const x = bytesToBase64Url(pubPoint.slice(1, 33));
	const y = bytesToBase64Url(pubPoint.slice(33, 65));
	const serverKey = await crypto.subtle.importKey(
		'jwk',
		{ kty: 'EC', crv: 'P-256', d: serverKeys.privateKey, x, y },
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		['deriveBits']
	);
	const clientPoint = base64UrlToBytes(clientPublicKey);
	if (clientPoint.length !== 65 || clientPoint[0] !== 0x04) {
		throw new Error('Invalid uncompressed P-256 point');
	}
	const clientKey = await crypto.subtle.importKey(
		'jwk',
		{
			kty: 'EC',
			crv: 'P-256',
			x: bytesToBase64Url(clientPoint.slice(1, 33)),
			y: bytesToBase64Url(clientPoint.slice(33, 65))
		},
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);
	const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKey, 256);
	return new Uint8Array(bits);
}

export async function deriveInputKeyingMaterial(
	authSecret: Uint8Array,
	ecdhSecret: Uint8Array
): Promise<Uint8Array> {
	return hkdfExtract(authSecret, ecdhSecret);
}

export async function deriveMessageKeys(
	ikm: Uint8Array,
	salt: Uint8Array,
	uaPublic: Uint8Array,
	asPublic: Uint8Array
): Promise<{ contentEncryptionKey: Bytes; nonce: Bytes }> {
	const keyInfo = new Uint8Array(13 + 1 + 65 + 65);
	keyInfo.set(textEncoder.encode('WebPush: info'), 0);
	keyInfo[13] = 0x00;
	keyInfo.set(uaPublic, 14);
	keyInfo.set(asPublic, 79);
	const ikm2 = await hkdfExpand(ikm, keyInfo, 32);
	const prk2 = await hkdfExtract(salt, ikm2);
	const cekInfo = concatBytes(
		textEncoder.encode('Content-Encoding: aes128gcm'),
		new Uint8Array([0x00])
	);
	const nonceInfo = concatBytes(
		textEncoder.encode('Content-Encoding: nonce'),
		new Uint8Array([0x00])
	);
	const contentEncryptionKey = await hkdfExpand(prk2, cekInfo, 16);
	const nonce = await hkdfExpand(prk2, nonceInfo, 12);
	return { contentEncryptionKey, nonce };
}

export function aes128GcmHeader(
	salt: Uint8Array,
	recordSize: number,
	serverPublicKey: Uint8Array
): Bytes {
	const header = new Uint8Array(16 + 4 + 1 + 65);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, recordSize, false);
	header[20] = 0x41;
	header.set(serverPublicKey, 21);
	return header;
}

export async function encryptRecord(
	contentEncryptionKey: Uint8Array,
	nonce: Uint8Array,
	plaintext: Uint8Array,
	lastRecord: boolean
): Promise<Uint8Array> {
	const padByte = lastRecord ? 0x02 : 0x01;
	const padded = new Uint8Array(plaintext.length + 1);
	padded.set(plaintext, 0);
	padded[plaintext.length] = padByte;
	const key = await crypto.subtle.importKey(
		'raw',
		toBuffer(contentEncryptionKey),
		'AES-GCM',
		false,
		['encrypt']
	);
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: toBuffer(nonce) },
		key,
		toBuffer(padded)
	);
	return new Uint8Array(encrypted);
}

export async function encryptPushMessage(input: {
	payload: string;
	subscription: { keys: { p256dh: string; auth: string } };
	serverKeys?: VapidKeys;
	salt?: Uint8Array;
	recordSize?: number;
}): Promise<{ body: Bytes; serverPublicKey: string }> {
	const serverKeys = input.serverKeys ?? (await generateVapidKeys());
	const salt = input.salt ?? crypto.getRandomValues(new Uint8Array(16));
	const recordSize = input.recordSize ?? 4096;
	const ecdhSecret = await ecdhSharedSecret(serverKeys, input.subscription.keys.p256dh);
	const authSecret = base64UrlToBytes(input.subscription.keys.auth);
	const prk = await deriveInputKeyingMaterial(authSecret, ecdhSecret);
	const serverPublicKeyBytes = base64UrlToBytes(serverKeys.publicKey);
	const clientPublicKeyBytes = base64UrlToBytes(input.subscription.keys.p256dh);
	const { contentEncryptionKey, nonce } = await deriveMessageKeys(
		prk,
		salt,
		clientPublicKeyBytes,
		serverPublicKeyBytes
	);
	const header = aes128GcmHeader(salt, recordSize, serverPublicKeyBytes);
	const ciphertext = await encryptRecord(
		contentEncryptionKey,
		nonce,
		textEncoder.encode(input.payload),
		true
	);
	const body = concatBytes(header, ciphertext);
	return { body, serverPublicKey: bytesToBase64Url(serverPublicKeyBytes) };
}

export async function vapidAuthorizationHeader(input: {
	subject: string;
	audience: string;
	privateKey: string;
	publicKey: string;
	nowSeconds: number;
}): Promise<string> {
	const header = { typ: 'JWT', alg: 'ES256' };
	const claims = { aud: input.audience, exp: input.nowSeconds + 43200, sub: input.subject };
	const b64Header = bytesToBase64Url(textEncoder.encode(JSON.stringify(header)));
	const b64Claims = bytesToBase64Url(textEncoder.encode(JSON.stringify(claims)));
	const signedData = `${b64Header}.${b64Claims}`;
	const pubPoint = base64UrlToBytes(input.publicKey);
	const x = bytesToBase64Url(pubPoint.slice(1, 33));
	const y = bytesToBase64Url(pubPoint.slice(33, 65));
	const key = await crypto.subtle.importKey(
		'jwk',
		{ kty: 'EC', crv: 'P-256', d: input.privateKey, x, y },
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);
	const signature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			key,
			toBuffer(textEncoder.encode(signedData))
		)
	);
	return `WebPush ${signedData}.${bytesToBase64Url(signature)}`;
}

export function decodeVapidJwt(jwt: string): {
	header: { typ: string; alg: string };
	claims: { aud: string; exp: number; sub: string };
	signedData: Bytes;
	signature: Bytes;
} {
	const [headerPart, claimsPart, signaturePart] = jwt.split('.');
	const header = JSON.parse(textDecoder.decode(base64UrlToBytes(headerPart))) as {
		typ: string;
		alg: string;
	};
	const claims = JSON.parse(textDecoder.decode(base64UrlToBytes(claimsPart))) as {
		aud: string;
		exp: number;
		sub: string;
	};
	const signedData = toBuffer(textEncoder.encode(`${headerPart}.${claimsPart}`));
	const signature = base64UrlToBytes(signaturePart);
	return { header, claims, signedData, signature };
}

export async function buildPushRequest(input: {
	subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
	payload: string;
	vapid: { subject: string; privateKey: string; publicKey: string };
	nowSeconds: number;
	topic: string;
	ttlSeconds?: number;
}): Promise<{ url: string; init: RequestInit }> {
	const { body, serverPublicKey } = await encryptPushMessage({
		payload: input.payload,
		subscription: input.subscription
	});
	const authorization = await vapidAuthorizationHeader({
		subject: input.vapid.subject,
		audience: new URL(input.subscription.endpoint).origin,
		privateKey: input.vapid.privateKey,
		publicKey: input.vapid.publicKey,
		nowSeconds: input.nowSeconds
	});
	const ttl = input.ttlSeconds ?? 86400;
	return {
		url: input.subscription.endpoint,
		init: {
			method: 'POST',
			body,
			headers: {
				'Content-Encoding': 'aes128gcm',
				'Content-Type': 'application/octet-stream',
				TTL: String(ttl),
				Urgency: 'high',
				Topic: input.topic,
				Authorization: authorization,
				'Crypto-Key': `dh=${serverPublicKey}`
			}
		}
	};
}
