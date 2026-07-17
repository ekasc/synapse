#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	discoverCanonicalDatabase,
	inspectCandidate,
	localPaths,
	parseBackupName,
	planBackupRetention,
	readBackupRetention,
	stateLockStatus
} from './local-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function check(name, fn) {
	try {
		fn();
		console.log(`  PASS ${name}`);
	} catch (error) {
		failures += 1;
		console.log(`  FAIL ${name}: ${error instanceof Error ? error.message : error}`);
	}
}

function migrations() {
	return readdirSync(join(ROOT, 'migrations')).filter((file) => file.endsWith('.sql')).length;
}

function config() {
	const json = JSON.parse(
		readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8')
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1')
	);
	const d1 = json.d1_databases?.find((database) => database.binding === 'BRIEF_DB');
	if (!d1?.database_id) throw new Error('BRIEF_DB database_id missing from wrangler.jsonc');
	return d1;
}

function backupEntries(paths, migrationCount) {
	return readdirSync(paths.backups, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => ({ name: entry.name, parsed: parseBackupName(entry.name) }))
		.filter((entry) => entry.parsed)
		.map((entry) => ({
			...entry.parsed,
			valid: inspectCandidate(join(paths.backups, entry.name), migrationCount).valid
		}));
}

function main() {
	console.log('== Synapse local-state verification ==\n');
	const paths = localPaths(ROOT);
	for (const directory of [
		paths.local,
		join(paths.local, 'ledgers'),
		join(paths.local, 'screenshots'),
		paths.runtime,
		paths.wrangler,
		paths.backups
	]) {
		check(`directory exists: ${directory.replace(`${ROOT}/`, '')}`, () => {
			if (!existsSync(directory)) throw new Error('missing');
		});
	}
	const d1 = config();
	check('active Wrangler config defines BRIEF_DB', () => {
		if (d1.binding !== 'BRIEF_DB') throw new Error(`found ${d1.binding}`);
	});
	check('active Wrangler config has D1 database ID', () => {
		if (!d1.database_id) throw new Error('missing');
	});
	const migrationCount = migrations();
	let candidate;
	check('canonical SQLite is uniquely resolved', () => {
		candidate = discoverCanonicalDatabase(ROOT, migrationCount, ['local']).candidate;
	});
	if (candidate) {
		check('canonical SQLite integrity_check passes', () => {
			if (!candidate.integrity) throw new Error(candidate.reason);
		});
		check('complete migration history exists', () => {
			if (candidate.migrationCount < migrationCount)
				throw new Error(`${candidate.migrationCount}/${migrationCount}`);
		});
		check('CSIS 3560 remains schema v1', () => {
			if (candidate.briefings['CSIS 3560'] !== 1) throw new Error('missing or rewritten schema');
		});
		check('CSIS 4280 remains schema v4+', () => {
			if (candidate.briefings['CSIS 4280'] < 4) throw new Error('missing or rewritten schema');
		});
		check('CSIS 4495 remains schema v4+', () => {
			if (candidate.briefings['CSIS 4495'] < 4) throw new Error('missing or rewritten schema');
		});
		check('exactly one canonical Fall 2026 semester remains', () => {
			const count = execFileSync(
				'sqlite3',
				[candidate.path, "SELECT COUNT(*) FROM semesters WHERE term='Fall' AND year=2026;"],
				{ encoding: 'utf8' }
			).trim();
			if (count !== '1') throw new Error(`found ${count}`);
		});
		check('briefing content matches latest valid backup', () => {
			const entries = backupEntries(paths, migrationCount)
				.filter((entry) => entry.valid)
				.sort((left, right) => right.timestamp - left.timestamp);
			if (!entries[0]) throw new Error('no valid backup');
			const backup = join(paths.backups, entries[0].name);
			const columns = 'code, name, institution, professor, briefing_json';
			const current = execFileSync(
				'sqlite3',
				[candidate.path, `SELECT ${columns} FROM briefings ORDER BY code;`],
				{ encoding: 'utf8' }
			);
			const previous = execFileSync(
				'sqlite3',
				[backup, `SELECT ${columns} FROM briefings ORDER BY code;`],
				{ encoding: 'utf8' }
			);
			if (current !== previous) throw new Error(`differs from ${entries[0].name}`);
		});
	}
	check('no stale same-host runtime lock exists', () => {
		const lock = stateLockStatus(ROOT);
		if (lock.stale) throw new Error(`stale lock: ${lock.path}`);
	});
	check('backup retention limit is valid and respected', () => {
		const entries = backupEntries(paths, migrationCount);
		const plan = planBackupRetention(entries, readBackupRetention());
		if (plan.pruned.length)
			throw new Error(`${plan.pruned.length} valid backup(s) exceed retention`);
	});
	check('CSIS 4495 ledger remains consistent', () => {
		const ledger = JSON.parse(readFileSync(join(paths.local, 'ledgers', 'csis-4495.json'), 'utf8'));
		if (
			ledger.paidRequestsPermitted ||
			ledger.status !== 'closed' ||
			Math.abs(ledger.capUsd - ledger.spentUsd - ledger.remainingUsd) > 0.000001
		)
			throw new Error('invalid ledger');
	});
	check('.synapse-local remains ignored by Git', () => {
		const output = execFileSync('git', ['check-ignore', '-q', '.synapse-local/example'], {
			cwd: ROOT
		});
		if (output === undefined) return;
	});
	check(
		'local-state scripts contain no persistent /tmp, absolute Mac path, or Miniflare hash',
		() => {
			const text = readdirSync(join(ROOT, 'scripts'))
				.filter((file) => file.endsWith('.mjs'))
				.map((file) => readFileSync(join(ROOT, 'scripts', file), 'utf8'))
				.join('\n');
			if (/\/tmp\/|\/Users\//.test(text) || /\b[a-f0-9]{64}\b/.test(text))
				throw new Error('forbidden persistent path or hash found');
		}
	);
	console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} ${failures} failed check(s)`);
	process.exitCode = failures ? 1 : 0;
}

main();
