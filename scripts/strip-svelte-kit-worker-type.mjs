#!/usr/bin/env node
// svelte-check pulls the entire built output (.svelte-kit/output, .svelte-kit/cloudflare)
// into the TS program via `Cloudflare.GlobalProps.mainModule`'s typeof-import of the
// wrapped worker entry. Nothing in src uses GlobalProps, so neutralize the reference.
// Run after `wrangler types` — the file is regenerated each time, so this is idempotent.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../worker-configuration.d.ts', import.meta.url).pathname;
const src = readFileSync(file, 'utf8');
const target = `mainModule: typeof import("./.svelte-kit/cloudflare/_worker");`;
const replacement = `mainModule: unknown;`;

if (!src.includes(target)) {
	process.exit(0); // already stripped (or structure changed — leave it alone)
}

writeFileSync(file, src.replace(target, replacement));
console.log('stripped .svelte-kit worker typeof-import from worker-configuration.d.ts');
