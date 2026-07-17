import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	inspectDirectory,
	planBackupRetention,
	readBackupRetention,
	selectCanonicalCandidate
} from '../../../scripts/local-state.mjs';

function candidate(path: string, overrides = {}) {
	return {
		path,
		integrity: true,
		requiredTableCount: 3,
		migrationCount: 9,
		briefingCount: 3,
		semesterCount: 1,
		briefings: { 'CSIS 3560': 1, 'CSIS 4280': 4, 'CSIS 4495': 4 },
		duplicateSemesters: 0,
		fingerprint: 'same',
		valid: true,
		reason: null,
		...overrides
	};
}

describe('local SQLite candidate selection', () => {
	it('selects one complete candidate', () => {
		expect(selectCanonicalCandidate([candidate('/state/complete.sqlite')]).path).toBe(
			'/state/complete.sqlite'
		);
	});

	it('selects the complete candidate over an empty candidate', () => {
		const empty = candidate('/state/empty.sqlite', {
			valid: false,
			requiredTableCount: 0,
			integrity: true,
			reason: 'missing required tables'
		});
		expect(selectCanonicalCandidate([empty, candidate('/state/complete.sqlite')]).path).toBe(
			'/state/complete.sqlite'
		);
	});

	it('selects the complete candidate over a corrupt candidate', () => {
		const corrupt = candidate('/state/corrupt.sqlite', {
			valid: false,
			integrity: false,
			requiredTableCount: 0,
			reason: 'integrity_check failed'
		});
		expect(selectCanonicalCandidate([corrupt, candidate('/state/complete.sqlite')]).path).toBe(
			'/state/complete.sqlite'
		);
	});

	it('selects complete migrations over an incomplete candidate', () => {
		const incomplete = candidate('/state/incomplete.sqlite', {
			valid: false,
			migrationCount: 8,
			reason: 'missing expected migrations'
		});
		expect(selectCanonicalCandidate([incomplete, candidate('/state/complete.sqlite')]).path).toBe(
			'/state/complete.sqlite'
		);
	});

	it('chooses a deterministic path for identical valid candidates', () => {
		expect(
			selectCanonicalCandidate([candidate('/state/b.sqlite'), candidate('/state/a.sqlite')]).path
		).toBe('/state/a.sqlite');
	});

	it('rejects materially different equally valid candidates', () => {
		expect(() =>
			selectCanonicalCandidate([
				candidate('/state/a.sqlite', { fingerprint: 'a' }),
				candidate('/state/b.sqlite', { fingerprint: 'b' })
			])
		).toThrow('Ambiguous valid SQLite candidates');
	});

	it('ignores WAL and SHM sidecars during discovery', () => {
		const directory = mkdtempSync(join(tmpdir(), 'synapse-state-'));
		try {
			writeFileSync(join(directory, 'database.sqlite-wal'), 'not a database');
			writeFileSync(join(directory, 'database.sqlite-shm'), 'not a database');
			expect(inspectDirectory(directory, 9)).toEqual([]);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it('rejects when no valid candidate exists', () => {
		expect(() =>
			selectCanonicalCandidate([
				candidate('/state/empty.sqlite', { valid: false, reason: 'missing required tables' })
			])
		).toThrow('No valid Synapse SQLite candidate');
	});
});

describe('backup retention planning', () => {
	it('rejects invalid retention overrides', () => {
		for (const value of ['', '0', '-1', '1.5', ' ten ', '999999999999999999999999']) {
			expect(() => readBackupRetention(value)).toThrow('SYNAPSE_BACKUP_KEEP');
		}
	});

	it('keeps the newest valid backups and reports invalid backups without pruning them', () => {
		const entries = Array.from({ length: 12 }, (_, index) => ({
			name: `backup-${index}`,
			timestamp: index,
			valid: index !== 2
		}));
		const plan = planBackupRetention(entries, 10);
		expect(plan.pruned).toEqual(['backup-0']);
		expect(plan.invalid).toEqual(['backup-2']);
		expect(plan.retained).toContain('backup-11');
	});
});
