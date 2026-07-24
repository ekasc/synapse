// Generates a VAPID P-256 keypair (RFC 8292) for the weekly digest push and
// prints where each value belongs. Run: node scripts/generate-vapid-keys.mjs
const toBase64Url = (bytes) => Buffer.from(bytes).toString('base64url');

const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
	'sign',
	'verify'
]);
const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
const triggerSecret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

console.log('# Public — add to wrangler.jsonc "vars":');
console.log(`VAPID_PUBLIC_KEY="${toBase64Url(publicKey)}"`);
console.log('');
console.log('# Secrets — set with: npx wrangler secret put <NAME>');
console.log(`VAPID_PRIVATE_KEY="${privateJwk.d}"`);
console.log(`WEEKLY_PUSH_SECRET="${triggerSecret}"`);
console.log('');
console.log('# For local preview, put all three in .dev.vars');
