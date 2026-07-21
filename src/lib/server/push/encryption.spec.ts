import { describe, expect, it } from 'vitest';
import {
	aes128GcmHeader,
	base64UrlToBytes,
	buildPushRequest,
	bytesToBase64Url,
	decodeVapidJwt,
	deriveInputKeyingMaterial,
	deriveMessageKeys,
	ecdhSharedSecret,
	encryptPushMessage,
	generateVapidKeys,
	hkdfExpand,
	hkdfExtract,
	vapidAuthorizationHeader
} from './encryption.ts';

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function makeUncompressedPoint(jwk: { x?: string; y?: string }): Uint8Array {
	const x = base64UrlToBytes(jwk.x!);
	const y = base64UrlToBytes(jwk.y!);
	const point = new Uint8Array(65);
	point[0] = 0x04;
	point.set(x, 1);
	point.set(y, 33);
	return point;
}

describe('encryption', () => {
	it('HKDF RFC 5869 test case 1', async () => {
		const ikm = new Uint8Array(22).fill(0x0b);
		const salt = new Uint8Array([
			0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c
		]);
		const info = new Uint8Array([0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9]);
		const prk = await hkdfExtract(salt, ikm);
		const okm = await hkdfExpand(prk, info, 42);
		expect(bytesToHex(okm)).toBe(
			'3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'
		);
	});

	it('base64url round trip preserves bytes and uses safe alphabet', () => {
		const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
		const str = bytesToBase64Url(bytes);
		expect(str).not.toContain('=');
		expect(str).not.toContain('+');
		expect(str).not.toContain('/');
		expect(Array.from(base64UrlToBytes(str))).toEqual(Array.from(bytes));
		const triggerPadding = new Uint8Array([0xfb, 0xff, 0xfe]);
		const encoded = bytesToBase64Url(triggerPadding);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(Array.from(base64UrlToBytes(encoded))).toEqual(Array.from(triggerPadding));
		expect(bytesToBase64Url(new Uint8Array(0))).toBe('');
		expect(base64UrlToBytes('').length).toBe(0);
	});

	it('generateVapidKeys produces 65-byte public point and 32-byte private scalar', async () => {
		const keys = await generateVapidKeys();
		const pub = base64UrlToBytes(keys.publicKey);
		const priv = base64UrlToBytes(keys.privateKey);
		expect(pub.length).toBe(65);
		expect(pub[0]).toBe(0x04);
		expect(priv.length).toBe(32);
	});

	it('VAPID JWT structure and ES256 signature verify', async () => {
		const keys = await generateVapidKeys();
		const nowSeconds = 1700000000;
		const auth = await vapidAuthorizationHeader({
			subject: 'mailto:admin@example.com',
			audience: 'https://push.example.com',
			privateKey: keys.privateKey,
			publicKey: keys.publicKey,
			nowSeconds
		});
		expect(auth.startsWith('WebPush ')).toBe(true);
		const jwt = auth.slice('WebPush '.length);
		const decoded = decodeVapidJwt(jwt);
		expect(decoded.header).toEqual({ typ: 'JWT', alg: 'ES256' });
		expect(decoded.claims.aud).toBe('https://push.example.com');
		expect(decoded.claims.sub).toBe('mailto:admin@example.com');
		expect(decoded.claims.exp).toBe(nowSeconds + 43200);
		expect(decoded.signature.length).toBe(64);
		const pubPoint = base64UrlToBytes(keys.publicKey);
		const spkiPrefix = new Uint8Array([
			0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
			0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00
		]);
		const spki = new Uint8Array(spkiPrefix.length + 65);
		spki.set(spkiPrefix, 0);
		spki.set(pubPoint, spkiPrefix.length);
		const verifyKey = await crypto.subtle.importKey(
			'spki',
			spki,
			{ name: 'ECDSA', namedCurve: 'P-256' },
			false,
			['verify']
		);
		const ok = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			verifyKey,
			decoded.signature,
			decoded.signedData
		);
		expect(ok).toBe(true);
	});

	it('encryptPushMessage round-trip: client re-derives keys and decrypts', async () => {
		const serverKeys = await generateVapidKeys();
		const clientPair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits']
		);
		const clientPubJwk = await crypto.subtle.exportKey('jwk', clientPair.publicKey);
		const clientPoint = makeUncompressedPoint(clientPubJwk);
		const auth = crypto.getRandomValues(new Uint8Array(16));
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const payload = 'hello push world';
		const { body } = await encryptPushMessage({
			payload,
			subscription: {
				keys: { p256dh: bytesToBase64Url(clientPoint), auth: bytesToBase64Url(auth) }
			},
			serverKeys,
			salt,
			recordSize: 4096
		});
		const parsedSalt = body.slice(0, 16);
		const rs = (body[16] << 24) | (body[17] << 16) | (body[18] << 8) | body[19];
		const idlen = body[20];
		const serverPubBytes = body.slice(21, 21 + idlen);
		const ciphertext = body.slice(21 + idlen);
		expect(rs).toBe(4096);
		expect(idlen).toBe(0x41);
		expect(Array.from(parsedSalt)).toEqual(Array.from(salt));
		const serverPubKey = await crypto.subtle.importKey(
			'jwk',
			{
				kty: 'EC',
				crv: 'P-256',
				x: bytesToBase64Url(serverPubBytes.slice(1, 33)),
				y: bytesToBase64Url(serverPubBytes.slice(33, 65))
			},
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[]
		);
		const clientEcdhBits = new Uint8Array(
			await crypto.subtle.deriveBits(
				{ name: 'ECDH', public: serverPubKey },
				clientPair.privateKey,
				256
			)
		);
		const clientPrk = await deriveInputKeyingMaterial(auth, clientEcdhBits);
		const { contentEncryptionKey: clientCek, nonce: clientNonce } = await deriveMessageKeys(
			clientPrk,
			parsedSalt,
			clientPoint,
			serverPubBytes
		);
		const decKey = await crypto.subtle.importKey('raw', clientCek, 'AES-GCM', false, ['decrypt']);
		const decrypted = new Uint8Array(
			await crypto.subtle.decrypt({ name: 'AES-GCM', iv: clientNonce }, decKey, ciphertext)
		);
		const payloadBytes = new TextEncoder().encode(payload);
		const expected = new Uint8Array(payloadBytes.length + 1);
		expected.set(payloadBytes, 0);
		expected[expected.length - 1] = 0x02;
		expect(Array.from(decrypted)).toEqual(Array.from(expected));
	});

	it('aes128GcmHeader exact byte layout', () => {
		const salt = new Uint8Array(16).fill(0xaa);
		const serverPub = new Uint8Array(65);
		serverPub[0] = 0x04;
		serverPub.fill(0xbb, 1);
		const header = aes128GcmHeader(salt, 4096, serverPub);
		expect(header.length).toBe(86);
		expect(Array.from(header.slice(0, 16))).toEqual(Array.from(salt));
		expect(header[16]).toBe(0x00);
		expect(header[17]).toBe(0x00);
		expect(header[18]).toBe(0x10);
		expect(header[19]).toBe(0x00);
		expect(header[20]).toBe(0x41);
		expect(Array.from(header.slice(21))).toEqual(Array.from(serverPub));
	});

	it('buildPushRequest shape and required headers', async () => {
		const serverKeys = await generateVapidKeys();
		const clientPair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits']
		);
		const clientPubJwk = await crypto.subtle.exportKey('jwk', clientPair.publicKey);
		const clientPoint = makeUncompressedPoint(clientPubJwk);
		const endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/abc';
		const nowSeconds = 1700000000;
		const { url, init } = await buildPushRequest({
			subscription: {
				endpoint,
				keys: {
					p256dh: bytesToBase64Url(clientPoint),
					auth: bytesToBase64Url(new Uint8Array(16).fill(0x42))
				}
			},
			payload: JSON.stringify({ title: 'Hi' }),
			vapid: {
				subject: 'mailto:admin@example.com',
				privateKey: serverKeys.privateKey,
				publicKey: serverKeys.publicKey
			},
			nowSeconds,
			topic: 'new-message'
		});
		expect(url).toBe(endpoint);
		expect(init.method).toBe('POST');
		expect(init.body).toBeInstanceOf(Uint8Array);
		const headers = init.headers as Record<string, string>;
		expect(headers['Content-Encoding']).toBe('aes128gcm');
		expect(headers['Content-Type']).toBe('application/octet-stream');
		expect(headers['TTL']).toBe('86400');
		expect(headers['Urgency']).toBe('high');
		expect(headers['Topic']).toBe('new-message');
		expect(headers['Authorization'].startsWith('WebPush ')).toBe(true);
		expect(headers['Crypto-Key'].startsWith('dh=')).toBe(true);
	});

	it('ecdhSharedSecret is symmetric across both peers', async () => {
		const serverKeys = await generateVapidKeys();
		const clientPair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits']
		);
		const clientPubJwk = await crypto.subtle.exportKey('jwk', clientPair.publicKey);
		const clientPoint = makeUncompressedPoint(clientPubJwk);
		const serverSide = await ecdhSharedSecret(serverKeys, bytesToBase64Url(clientPoint));
		const serverPubPoint = base64UrlToBytes(serverKeys.publicKey);
		const serverPubKey = await crypto.subtle.importKey(
			'jwk',
			{
				kty: 'EC',
				crv: 'P-256',
				x: bytesToBase64Url(serverPubPoint.slice(1, 33)),
				y: bytesToBase64Url(serverPubPoint.slice(33, 65))
			},
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			[]
		);
		const clientSide = new Uint8Array(
			await crypto.subtle.deriveBits(
				{ name: 'ECDH', public: serverPubKey },
				clientPair.privateKey,
				256
			)
		);
		expect(serverSide.length).toBe(32);
		expect(bytesToHex(serverSide)).toBe(bytesToHex(clientSide));
	});
});
