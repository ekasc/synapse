#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireStateLock, discoverCanonicalDatabase, localPaths } from './local-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function config() {
	const raw = readFileSync(resolve(ROOT, 'wrangler.jsonc'), 'utf8');
	const json = JSON.parse(raw.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
	const d1 = json.d1_databases?.find((database) => database.binding === 'BRIEF_DB');
	if (!d1?.database_id) throw new Error('BRIEF_DB with database_id is required in wrangler.jsonc');
	return d1;
}

function migrationCount() {
	return readdirSync(resolve(ROOT, 'migrations')).filter((file) => file.endsWith('.sql')).length;
}

function main() {
	const port = process.argv[2] || '8788';
	if (!/^\d+$/.test(port)) throw new Error('Port must be a number');
	const build = resolve(ROOT, '.svelte-kit', 'cloudflare');
	if (!existsSync(build)) throw new Error('Build output missing: run "pnpm build" first.');
	const paths = localPaths(ROOT);
	const database = discoverCanonicalDatabase(ROOT, migrationCount(), ['local']).candidate;
	const lock = acquireStateLock(ROOT, 'local-dev');
	const d1 = config();
	console.log(`Database ready: ${database.path}`);
	console.log(`Starting local dev on ${port}; state lock: ${lock.path}`);
	const child = spawn(
		'pnpm',
		[
			'wrangler',
			'pages',
			'dev',
			build,
			'--d1',
			`${d1.binding}=${d1.database_id}`,
			'--persist-to',
			paths.wrangler,
			'--port',
			port
		],
		{
			cwd: ROOT,
			stdio: 'inherit'
		}
	);
	const stop = () => child.kill('SIGTERM');
	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);
	child.on('error', (error) => {
		console.error(`FATAL: ${error.message}`);
		lock.release();
		process.exitCode = 1;
	});
	child.on('close', (code) => {
		lock.release();
		process.exitCode = code ?? 1;
	});
}

try {
	main();
} catch (error) {
	console.error(`FATAL: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
}
