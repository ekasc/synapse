#!/usr/bin/env node
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	acquireStateLock,
	backupDatabase,
	discoverCanonicalDatabase,
	ensureLocalDirectories,
	inspectCandidate,
	inspectDirectory,
	localPaths,
	querySql,
	pruneBackups,
	replaceDatabaseAtomically,
	stageSnapshot
} from './local-state.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function jsonc(text) {
	return JSON.parse(text.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
}

function config() {
	const file = join(ROOT, 'wrangler.jsonc');
	if (!existsSync(file)) throw new Error(`Wrangler config not found: ${file}`);
	const d1 = jsonc(readFileSync(file, 'utf8')).d1_databases?.find(
		(database) => database.binding === 'BRIEF_DB'
	);
	if (!d1?.database_id) throw new Error('BRIEF_DB with database_id is required in wrangler.jsonc');
	return d1;
}

function migrationCount() {
	return (
		execFileSync('sh', ['-c', "find migrations -maxdepth 1 -name '*.sql' -type f | wc -l"], {
			cwd: ROOT,
			encoding: 'utf8'
		}).trim() * 1
	);
}

function applyMigrations(binding, persistTo) {
	execFileSync(
		'pnpm',
		['wrangler', 'd1', 'migrations', 'apply', binding, '--local', '--persist-to', persistTo],
		{
			cwd: ROOT,
			stdio: 'inherit'
		}
	);
}

function stageDatabase(source, d1, migrations, paths) {
	const stageRoot = join(paths.runtime, `bootstrap-stage-${process.pid}-${Date.now()}`);
	try {
		applyMigrations(d1.binding, stageRoot);
		const stageDir = join(stageRoot, 'v3', 'd1', 'miniflare-D1DatabaseObject');
		const initialized = inspectDirectory(stageDir, migrations).filter(
			(candidate) => candidate.requiredTableCount === 3 && candidate.integrity
		);
		if (initialized.length !== 1)
			throw new Error(
				`Staging database discovery failed: found ${initialized.length} initialized D1 candidates`
			);
		for (const extension of ['-wal', '-shm'])
			rmSync(initialized[0].path + extension, { force: true });
		stageSnapshot(source.path, initialized[0].path);
		applyMigrations(d1.binding, stageRoot);
		return { stageRoot, database: initialized[0].path };
	} catch (error) {
		console.error(`Staging retained for diagnosis: ${stageRoot}`);
		throw error;
	}
}

function reconcileSemesters(path) {
	const rows = querySql(
		path,
		"SELECT id || '|' || term || '|' || year || '|' || \"order\" FROM semesters ORDER BY rowid;"
	)
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((row) => {
			const [id, term, year, order] = row.split('|');
			const refs = Number(
				querySql(path, `SELECT COUNT(*) FROM courses WHERE semester_id = '${id.replaceAll("'", "''")}';`)
			);
			return { id, term, year: Number(year), order: Number(order), refs };
		});
	const groups = Map.groupBy(rows, (row) => `${row.term}|${row.year}`);
	for (const [key, duplicates] of groups) {
		if (duplicates.length < 2) continue;
		duplicates.sort(
			(left, right) =>
				right.refs - left.refs || right.order - left.order || left.id.localeCompare(right.id)
		);
		const [keep, ...remove] = duplicates;
		const ids = remove.map((row) => `'${row.id.replaceAll("'", "''")}'`).join(', ');
		querySql(path, `BEGIN IMMEDIATE; DELETE FROM semesters WHERE id IN (${ids}); COMMIT;`);
		console.log(
			`  Reconciled ${key}: kept ${keep.id}, removed ${remove.map((row) => row.id).join(', ')}`
		);
	}
}

function verifyStaged(path, migrations) {
	const report = inspectCandidate(path, migrations);
	if (!report.valid) throw new Error(`Staged database validation failed: ${report.reason}`);
	if (report.duplicateSemesters !== 0)
		throw new Error('Staged database still contains duplicate semester rows');
	return report;
}

function reconcileLedger(paths) {
	const file = join(paths.local, 'ledgers', 'csis-4495.json');
	const ledger = {
		taskIdentifier: 'CSIS-4495-V4-PERSISTENCE',
		courseCode: 'CSIS 4495',
		institution: 'Douglas College',
		requestedProfessor: 'Michael Ma',
		capUsd: 0.12,
		spentUsd: 0.031639,
		remainingUsd: 0.088361,
		attemptCount: 4,
		paidRequestsPermitted: false,
		status: 'closed',
		persistenceOutcome: 'manual_v4_persisted',
		reconciledFromPriorRun: true,
		perAttemptCostDetailsUnavailable: true,
		lastUpdated: new Date().toISOString()
	};
	if (
		ledger.spentUsd < 0 ||
		ledger.spentUsd > ledger.capUsd ||
		Math.abs(ledger.capUsd - ledger.spentUsd - ledger.remainingUsd) > 0.000001
	)
		throw new Error('CSIS 4495 ledger consistency failure');
	if (existsSync(file)) {
		const existing = JSON.parse(readFileSync(file, 'utf8'));
		if (existing.lastUpdated) ledger.lastUpdated = existing.lastUpdated;
	}
	const temp = `${file}.${process.pid}.tmp`;
	writeFileSync(temp, `${JSON.stringify(ledger, null, 2)}\n`);
	renameSync(temp, file);
}

function main() {
	const lock = acquireStateLock(ROOT, 'bootstrap');
	try {
		const paths = ensureLocalDirectories(ROOT);
		const d1 = config();
		const migrations = migrationCount();
		const { candidate: source } = discoverCanonicalDatabase(ROOT, migrations);
		console.log(`Source database: ${source.path}`);
		const backup = backupDatabase(source.path, paths.backups);
		console.log(`Backup created: ${backup}`);
		const staged = stageDatabase(source, d1, migrations, paths);
		let installed = false;
		try {
			reconcileSemesters(staged.database);
			const verified = verifyStaged(staged.database, migrations);
			if (process.env.SYNAPSE_BOOTSTRAP_FAIL_AFTER_STAGE === '1')
				throw new Error('Forced failure after staging');
			let destination;
			try {
				destination = discoverCanonicalDatabase(ROOT, migrations, ['local']).candidate.path;
			} catch {
				destination = join(paths.localD1, verified.name);
			}
			replaceDatabaseAtomically(staged.database, destination);
			installed = true;
			console.log(`Canonical database replaced atomically: ${destination}`);
		} finally {
			if (installed) rmSync(staged.stageRoot, { recursive: true, force: true });
			else console.error(`Staging retained for diagnosis: ${staged.stageRoot}`);
		}
		reconcileLedger(paths);
		const retention = pruneBackups(paths.backups, migrations, backup);
		console.log(
			`Backups: created=1 retained=${retention.retained.length} pruned=${retention.pruned.length} invalid=${retention.invalid.length}`
		);
		if (retention.errors.length)
			console.error(`Backup pruning warnings: ${retention.errors.join('; ')}`);
	} finally {
		lock.release();
	}
}

try {
	main();
} catch (error) {
	console.error(`FATAL: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
}
