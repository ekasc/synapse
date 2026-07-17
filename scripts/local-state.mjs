import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const REQUIRED_TABLES = ['briefings', 'semesters', 'd1_migrations'];
export const EXPECTED_BRIEFINGS = {
	'CSIS 3560': 1,
	'CSIS 4280': 4,
	'CSIS 4495': 4
};

function meetsExpectedVersion(code, version) {
	const expected = EXPECTED_BRIEFINGS[code];
	if (expected == null) return false;
	return version >= expected;
}

export function querySql(path, statement) {
	const database = new DatabaseSync(path);
	try {
		if (/^(?:PRAGMA\s+wal_checkpoint|BEGIN\b|DELETE\b|UPDATE\b|INSERT\b)/i.test(statement)) {
			database.exec(statement);
			return '';
		}
		return database
			.prepare(statement)
			.all()
			.map((row) => Object.values(row).join('|'))
			.join('\n');
	} finally {
		database.close();
	}
}

function snapshot(source, destination) {
	const database = new DatabaseSync(source, { readOnly: true });
	try {
		writeFileSync(destination, database.serialize());
	} finally {
		database.close();
	}
}

function lines(value) {
	return value ? value.split('\n').filter(Boolean) : [];
}

export function localPaths(root) {
	const local = resolve(root, '.synapse-local');
	return {
		local,
		backups: join(local, 'backups'),
		runtime: join(local, 'runtime'),
		wrangler: join(local, 'wrangler'),
		legacyD1: join(root, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject'),
		localD1: join(local, 'wrangler', 'v3', 'd1', 'miniflare-D1DatabaseObject')
	};
}

export function ensureLocalDirectories(root) {
	const paths = localPaths(root);
	for (const path of [
		paths.backups,
		join(paths.local, 'ledgers'),
		join(paths.local, 'screenshots'),
		paths.runtime,
		paths.wrangler
	]) {
		mkdirSync(path, { recursive: true });
	}
	return paths;
}

export function inspectCandidate(path, migrationCount) {
	const report = {
		path,
		name: basename(path),
		size: statSync(path).size,
		integrity: false,
		tables: [],
		requiredTableCount: 0,
		migrationCount: 0,
		briefingCount: 0,
		semesterCount: 0,
		briefings: {},
		duplicateSemesters: 0,
		fingerprint: null,
		valid: false,
		reason: null
	};

	try {
		report.integrity = querySql(path, 'PRAGMA integrity_check;') === 'ok';
		if (!report.integrity) {
			report.reason = 'integrity_check failed';
			return report;
		}
		report.tables = lines(
			querySql(path, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
		);
		report.requiredTableCount = REQUIRED_TABLES.filter((table) =>
			report.tables.includes(table)
		).length;
		if (report.requiredTableCount !== REQUIRED_TABLES.length) {
			report.reason = `missing required tables (${report.requiredTableCount}/${REQUIRED_TABLES.length})`;
			return report;
		}

		report.migrationCount = Number(querySql(path, 'SELECT COUNT(*) FROM d1_migrations;'));
		report.briefingCount = Number(querySql(path, 'SELECT COUNT(*) FROM briefings;'));
		report.semesterCount = Number(querySql(path, 'SELECT COUNT(*) FROM semesters;'));
		for (const row of lines(
			querySql(
				path,
				"SELECT code || '|' || schema_version FROM briefings WHERE code IN ('CSIS 3560', 'CSIS 4280', 'CSIS 4495') ORDER BY code;"
			)
		)) {
			const [code, version] = row.split('|');
			report.briefings[code] = Number(version);
		}
		report.duplicateSemesters = Number(
			querySql(
				path,
				'SELECT COUNT(*) FROM (SELECT term, year FROM semesters GROUP BY term, year HAVING COUNT(*) > 1);'
			)
		);
		const expectedBriefingsPresent = Object.entries(EXPECTED_BRIEFINGS).every(([code]) =>
			meetsExpectedVersion(code, report.briefings[code])
		);
		const completeMigrations = report.migrationCount >= migrationCount;
		report.valid = expectedBriefingsPresent && completeMigrations;
		report.reason = report.valid ? null : 'missing expected migrations or briefing rows';
		if (report.valid) {
			const database = new DatabaseSync(path, { readOnly: true });
			try {
				report.fingerprint = createHash('sha256').update(database.serialize()).digest('hex');
			} finally {
				database.close();
			}
		}
	} catch (error) {
		report.reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
	}
	return report;
}

export function inspectDirectory(directory, migrationCount) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sqlite'))
		.map((entry) => inspectCandidate(join(directory, entry.name), migrationCount));
}

function score(report) {
	return [
		report.integrity ? 1 : 0,
		report.requiredTableCount,
		report.migrationCount,
		Object.keys(report.briefings).length,
		-report.duplicateSemesters,
		report.briefingCount
	];
}

function compareLogicalScore(left, right) {
	const a = score(left);
	const b = score(right);
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) return b[index] - a[index];
	}
	return 0;
}

export function selectCanonicalCandidate(reports) {
	const valid = reports
		.filter((report) => report.valid)
		.sort((left, right) => compareLogicalScore(left, right) || left.path.localeCompare(right.path));
	if (valid.length === 0) {
		throw new Error(
			`No valid Synapse SQLite candidate. ${reports.map((report) => `${report.path}: ${report.reason}`).join('; ')}`
		);
	}
	const best = valid[0];
	const tied = valid.filter((report) => compareLogicalScore(best, report) === 0);
	const fingerprints = new Set(tied.map((report) => report.fingerprint));
	if (fingerprints.size > 1) {
		throw new Error(
			`Ambiguous valid SQLite candidates: ${tied.map((report) => report.path).join(', ')}`
		);
	}
	return best;
}

export function discoverCanonicalDatabase(root, migrationCount, locations = ['local', 'legacy']) {
	const paths = localPaths(root);
	const reports = locations.flatMap((location) =>
		inspectDirectory(location === 'local' ? paths.localD1 : paths.legacyD1, migrationCount)
	);
	return { candidate: selectCanonicalCandidate(reports), reports };
}

export function backupName(now = new Date(), token = randomUUID()) {
	return `${now.toISOString().replace(/[:.]/g, '-')}__synapse-briefs-${token}.sqlite`;
}

export function parseBackupName(name) {
	const match =
		/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})(?:-(\d{3})Z)?(?:__synapse-briefs-[0-9a-f-]+|_synapse-briefs)\.sqlite$/.exec(
			name
		);
	if (!match) return null;
	const timestamp = Date.parse(
		`${match[1].replace(/(T\d{2})-(\d{2})-(\d{2})$/, '$1:$2:$3')}.${match[2] || '000'}Z`
	);
	return Number.isNaN(timestamp) ? null : { name, timestamp };
}

export function backupDatabase(source, backupDirectory) {
	mkdirSync(backupDirectory, { recursive: true });
	const path = join(backupDirectory, backupName());
	snapshot(source, path);
	return path;
}

export function readBackupRetention(value = process.env.SYNAPSE_BACKUP_KEEP) {
	if (value === undefined) return 10;
	if (!/^[1-9]\d*$/.test(value)) throw new Error('SYNAPSE_BACKUP_KEEP must be a positive integer');
	const keep = Number(value);
	if (!Number.isSafeInteger(keep)) throw new Error('SYNAPSE_BACKUP_KEEP must be a safe integer');
	return keep;
}

export function planBackupRetention(entries, keep, currentBackup) {
	const valid = entries.filter((entry) => entry.valid).sort((a, b) => b.timestamp - a.timestamp);
	const protectedNames = new Set(
		[currentBackup ? basename(currentBackup) : null, valid[0]?.name].filter(Boolean)
	);
	const retained = valid.slice(0, keep).map((entry) => entry.name);
	for (const name of protectedNames) if (!retained.includes(name)) retained.push(name);
	return {
		retained,
		pruned: valid.filter((entry) => !retained.includes(entry.name)).map((entry) => entry.name),
		invalid: entries.filter((entry) => !entry.valid).map((entry) => entry.name)
	};
}

export function pruneBackups(backupDirectory, migrationCount, currentBackup) {
	const keep = readBackupRetention();
	const entries = readdirSync(backupDirectory, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => ({ entry, parsed: parseBackupName(entry.name) }))
		.filter(({ parsed }) => parsed)
		.map(({ entry, parsed }) => ({
			...parsed,
			path: join(backupDirectory, entry.name),
			valid: inspectCandidate(join(backupDirectory, entry.name), migrationCount).valid
		}));
	const plan = planBackupRetention(entries, keep, currentBackup);
	const errors = [];
	for (const name of plan.pruned) {
		try {
			rmSync(join(backupDirectory, name));
		} catch (error) {
			errors.push(`${name}: ${error instanceof Error ? error.message : error}`);
		}
	}
	return { keep, ...plan, errors };
}

function safeHostname() {
	return hostname().replace(/[^A-Za-z0-9._-]/g, '_');
}

function isAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error?.code === 'EPERM';
	}
}

export function lockPath(root) {
	return join(localPaths(root).runtime, 'locks', safeHostname(), 'local-state.lock');
}

export function stateLockStatus(root) {
	const path = lockPath(root);
	if (!existsSync(path)) return { path, exists: false, stale: false, owner: null };
	try {
		const owner = JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8'));
		const stale =
			owner.hostname === hostname() && Number.isSafeInteger(owner.pid) && !isAlive(owner.pid);
		return { path, exists: true, stale, owner };
	} catch {
		return { path, exists: true, stale: true, owner: null };
	}
}

export function acquireStateLock(root, operation) {
	const path = lockPath(root);
	mkdirSync(dirname(path), { recursive: true });
	const token = randomUUID();
	const owner = {
		operation,
		pid: process.pid,
		hostname: hostname(),
		startedAt: new Date().toISOString(),
		root,
		token
	};
	let created = false;
	try {
		mkdirSync(path);
		created = true;
		writeFileSync(join(path, 'owner.json'), JSON.stringify(owner, null, 2));
	} catch (error) {
		if (error?.code !== 'EEXIST') {
			if (created) rmSync(path, { recursive: true, force: true });
			throw error;
		}
		let existing;
		try {
			existing = JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8'));
		} catch {
			existing = null;
		}
		const malformedLockIsOld = !existing && Date.now() - statSync(path).mtimeMs > 5_000;
		if (
			(existing?.hostname === hostname() &&
				Number.isSafeInteger(existing.pid) &&
				!isAlive(existing.pid)) ||
			malformedLockIsOld
		) {
			const stale = `${path}.stale-${existing?.pid ?? 'unknown'}-${randomUUID()}`;
			renameSync(path, stale);
			rmSync(stale, { recursive: true, force: true });
			return acquireStateLock(root, operation);
		}
		const details = existing
			? `operation=${existing.operation} pid=${existing.pid} hostname=${existing.hostname}`
			: 'owner metadata unavailable';
		throw new Error(
			`LOCAL_STATE_LOCKED: ${details}; lock=${path}; stop the owner or rerun after confirming a stale same-host lock.`
		);
	}
	return {
		path,
		owner,
		release() {
			try {
				const current = JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8'));
				if (current.token === token) rmSync(path, { recursive: true, force: true });
			} catch {}
		}
	};
}

export function stageSnapshot(source, stagePath) {
	snapshot(source, stagePath);
	querySql(stagePath, 'PRAGMA wal_checkpoint(TRUNCATE);');
}

export function replaceDatabaseAtomically(source, destination) {
	mkdirSync(dirname(destination), { recursive: true });
	const temp = join(dirname(destination), `.${basename(destination)}.${randomUUID()}.staging`);
	stageSnapshot(source, temp);
	if (existsSync(destination)) querySql(destination, 'PRAGMA wal_checkpoint(TRUNCATE);');
	for (const extension of ['-wal', '-shm']) rmSync(destination + extension, { force: true });
	renameSync(temp, destination);
}
