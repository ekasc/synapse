import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Temp directory setup (must precede imports so FALLBACK_DIR resolves correctly) ──

const testDir = mkdtempSync(join(tmpdir(), 'synapse-r2-'));
process.chdir(testDir);

const {
	listMaterialsFallback,
	getMaterialRecordFallback,
	updateMaterialRecordFallback,
	uploadMaterialFallback,
	deleteMaterialRecordFallback,
	getMaterialStreamFallback,
	getMaterialBytesFallback
} = await import('./r2');

const fallbackDir = join(testDir, '.data', 'materials');
const fallbackIndex = join(fallbackDir, 'index.json');

// ── Helpers ──

interface TestRecord {
	id: string;
	courseId: string;
	fileName: string;
	mimeType: string;
	size: number;
	uploadedAt: string;
}

function makeRecord(overrides?: Partial<TestRecord>): TestRecord {
	return {
		id: 'mat-1',
		courseId: 'course-1',
		fileName: 'test.pdf',
		mimeType: 'application/pdf',
		size: 100,
		uploadedAt: new Date().toISOString(),
		...overrides
	};
}

function seedIndex(records: TestRecord[]) {
	if (!existsSync(fallbackDir)) mkdirSync(fallbackDir, { recursive: true });
	writeFileSync(fallbackIndex, JSON.stringify(records, null, '\t'));
}

function seedFile(id: string, fileName: string, content: string | Buffer) {
	if (!existsSync(fallbackDir)) mkdirSync(fallbackDir, { recursive: true });
	writeFileSync(join(fallbackDir, `${id}-${fileName}`), content);
}

function readIndex(): TestRecord[] {
	return JSON.parse(readFileSync(fallbackIndex, 'utf-8'));
}

function writeCorruptIndex(content: string) {
	if (!existsSync(fallbackDir)) mkdirSync(fallbackDir, { recursive: true });
	writeFileSync(fallbackIndex, content);
}

// ── Lifecycle ──

beforeEach(() => {
	if (existsSync(join(testDir, '.data'))) {
		rmSync(join(testDir, '.data'), { recursive: true, force: true });
	}
});

afterAll(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ── Tests ──

describe('listMaterialsFallback', () => {
	it('returns empty array when index file does not exist', () => {
		expect(listMaterialsFallback()).toEqual([]);
	});

	it('returns parsed records when index file has valid JSON', () => {
		const records = [makeRecord(), makeRecord({ id: 'mat-2', fileName: 'notes.pdf' })];
		seedIndex(records);

		expect(listMaterialsFallback()).toEqual(records);
	});

	it('filters by courseId when provided', () => {
		const records = [
			makeRecord({ id: 'mat-1', courseId: 'course-a' }),
			makeRecord({ id: 'mat-2', courseId: 'course-b' })
		];
		seedIndex(records);

		expect(listMaterialsFallback('course-a')).toEqual([records[0]]);
		expect(listMaterialsFallback('course-b')).toEqual([records[1]]);
		expect(listMaterialsFallback('course-c')).toEqual([]);
	});

	it('returns empty array and warns via console.warn when index contains corrupt JSON', () => {
		writeCorruptIndex('{not valid json at all');

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		expect(listMaterialsFallback()).toEqual([]);
		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toBe('[r2] Failed to parse fallback index:');

		warn.mockRestore();
	});
});

describe('uploadMaterialFallback', () => {
	it('writes file content and updates the index', async () => {
		const file = new File(['hello world'], 'notes.pdf', { type: 'application/pdf' });
		const record = await uploadMaterialFallback('course-1', file);

		// Record shape
		expect(record.id).toMatch(/^[0-9a-f-]{36}$/i);
		expect(record.courseId).toBe('course-1');
		expect(record.fileName).toBe('notes.pdf');
		expect(record.mimeType).toBe('application/pdf');
		expect(record.size).toBe(11);
		expect(Number.isNaN(Date.parse(record.uploadedAt))).toBe(false);

		// File written to disk
		const filePath = join(fallbackDir, `${record.id}-notes.pdf`);
		expect(existsSync(filePath)).toBe(true);
		expect(readFileSync(filePath, 'utf-8')).toBe('hello world');

		// Index contains the record
		const index = readIndex();
		expect(index).toHaveLength(1);
		expect(index[0]).toEqual(record);
	});

	it('handles case where index does not exist yet', async () => {
		// No setup — fallback dir and index do not exist
		const file = new File(['content'], 'doc.txt', { type: 'text/plain' });
		const record = await uploadMaterialFallback('course-2', file);

		expect(record.courseId).toBe('course-2');
		expect(existsSync(fallbackIndex)).toBe(true);

		const index = readIndex();
		expect(index).toHaveLength(1);
		expect(index[0].id).toBe(record.id);
	});

	it('appends to an existing index without clobbering prior records', async () => {
		const existing = makeRecord({ id: 'existing', fileName: 'a.pdf' });
		seedIndex([existing]);

		const file = new File(['new content'], 'b.pdf', { type: 'application/pdf' });
		const record = await uploadMaterialFallback('course-1', file);

		const index = readIndex();
		expect(index).toHaveLength(2);
		expect(index[0]).toEqual(existing);
		expect(index[1]).toEqual(record);
	});

	it('sanitizes filenames with special characters via safeName', async () => {
		const file = new File(['data'], 'file<script>:name.pdf', { type: 'application/pdf' });
		const record = await uploadMaterialFallback('course-1', file);

		// safeName: basename then replace [^\w.\- ] with _
		expect(record.fileName).toBe('file_script__name.pdf');
		expect(existsSync(join(fallbackDir, `${record.id}-file_script__name.pdf`))).toBe(true);
	});
});

describe('deleteMaterialRecordFallback', () => {
	it('removes the record from the index and deletes the on-disk file', () => {
		seedIndex([makeRecord({ id: 'del-1', fileName: 'to-delete.pdf' }), makeRecord({ id: 'keep', fileName: 'keep.pdf' })]);
		seedFile('del-1', 'to-delete.pdf', 'delete me');
		seedFile('keep', 'keep.pdf', 'keep me');

		const result = deleteMaterialRecordFallback('del-1');

		expect(result).toBe(true);
		expect(existsSync(join(fallbackDir, 'del-1-to-delete.pdf'))).toBe(false);
		expect(existsSync(join(fallbackDir, 'keep-keep.pdf'))).toBe(true);

		const index = readIndex();
		expect(index).toHaveLength(1);
		expect(index[0].id).toBe('keep');
	});

	it('handles deleting non-existent material gracefully (returns false)', () => {
		expect(deleteMaterialRecordFallback('nonexistent')).toBe(false);
	});

	it('handles record whose on-disk file is already missing', () => {
		seedIndex([makeRecord({ id: 'orphan', fileName: 'gone.pdf' })]);
		// intentionally do not create the file

		const result = deleteMaterialRecordFallback('orphan');
		expect(result).toBe(true);

		const index = readIndex();
		expect(index).toHaveLength(0);
	});
});

describe('getMaterialRecordFallback', () => {
	it('returns record when found', () => {
		const record = makeRecord();
		seedIndex([record]);
		expect(getMaterialRecordFallback('mat-1')).toEqual(record);
	});

	it('returns null when not found', () => {
		expect(getMaterialRecordFallback('missing')).toBeNull();
	});
});

describe('updateMaterialRecordFallback', () => {
	it('updates fileName in index and renames the on-disk file', () => {
		seedIndex([makeRecord({ id: 'ren', fileName: 'old.pdf' })]);
		seedFile('ren', 'old.pdf', 'content');

		const result = updateMaterialRecordFallback('ren', { fileName: 'new.pdf' });

		expect(result).not.toBeNull();
		expect(result!.fileName).toBe('new.pdf');
		expect(existsSync(join(fallbackDir, 'ren-old.pdf'))).toBe(false);
		expect(existsSync(join(fallbackDir, 'ren-new.pdf'))).toBe(true);
	});

	it('returns null for non-existent record', () => {
		expect(updateMaterialRecordFallback('nope', { fileName: 'x.pdf' })).toBeNull();
	});
});

describe('getMaterialStreamFallback', () => {
	it('returns file content as a Buffer', () => {
		const record = makeRecord({ id: 'stream-1', fileName: 'data.bin' });
		seedFile('stream-1', 'data.bin', 'binary content');

		const buf = getMaterialStreamFallback(record);
		expect(buf).toBeInstanceOf(Buffer);
		expect(buf.toString('utf-8')).toBe('binary content');
	});
});

describe('getMaterialBytesFallback', () => {
	it('returns file content as a Uint8Array', () => {
		const record = makeRecord({ id: 'bytes-1', fileName: 'data.bin' });
		seedFile('bytes-1', 'data.bin', 'uint8 content');

		const bytes = getMaterialBytesFallback(record);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(new TextDecoder().decode(bytes)).toBe('uint8 content');
	});
});
