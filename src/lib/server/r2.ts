/**
 * Cloudflare R2 storage for course materials.
 *
 * Stores file content in R2 and metadata in a JSON index object.
 * Provides a local-filesystem fallback for `vite dev` without R2 bindings.
 *
 * Key structure in R2:
 *   materials-index.json  → JSON array of MaterialRecord[]
 *   {courseId}/{id}       → file content (id-based key so rename doesn't break links)
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Types ──

export type MaterialRecord = {
	id: string;
	courseId: string;
	fileName: string;
	mimeType: string;
	size: number;
	uploadedAt: string;
};

// ── R2-backed storage ──

const INDEX_KEY = 'materials-index.json';

function safeName(name: string): string {
	return path.basename(name).replace(/[^\w.\- ]/g, '_');
}

function materialKey(m: { courseId: string; id: string }): string {
	return `${m.courseId}/${m.id}`;
}

async function readIndex(bucket: R2Bucket): Promise<MaterialRecord[]> {
	const obj = await bucket.get(INDEX_KEY);
	if (!obj) return [];

	try {
		return JSON.parse(await obj.text());
	} catch (error) {
		console.warn(`[r2] Failed to parse ${INDEX_KEY}; returning an empty index.`, error);
		return [];
	}
}

async function writeIndex(bucket: R2Bucket, records: MaterialRecord[]): Promise<void> {
	await bucket.put(INDEX_KEY, JSON.stringify(records));
}

export async function listMaterials(
	bucket: R2Bucket,
	courseId?: string
): Promise<MaterialRecord[]> {
	const all = await readIndex(bucket);
	return courseId ? all.filter((m) => m.courseId === courseId) : all;
}

export async function getMaterialRecord(
	bucket: R2Bucket,
	id: string
): Promise<MaterialRecord | null> {
	const all = await readIndex(bucket);
	return all.find((m) => m.id === id) ?? null;
}

export async function uploadMaterial(
	bucket: R2Bucket,
	courseId: string,
	file: File
): Promise<MaterialRecord> {
	const id = crypto.randomUUID();
	const safe = safeName(file.name);
	const bytes = await file.arrayBuffer();

	await bucket.put(materialKey({ courseId, id }), bytes, {
		httpMetadata: { contentType: file.type || 'application/octet-stream' }
	});

	const record: MaterialRecord = {
		id,
		courseId,
		fileName: safe,
		mimeType: file.type || 'application/octet-stream',
		size: bytes.byteLength,
		uploadedAt: new Date().toISOString()
	};

	const all = await readIndex(bucket);
	all.push(record);
	await writeIndex(bucket, all);

	return record;
}

export async function updateMaterialRecord(
	bucket: R2Bucket,
	id: string,
	updates: { fileName?: string }
): Promise<MaterialRecord | null> {
	const all = await readIndex(bucket);
	const idx = all.findIndex((m) => m.id === id);
	if (idx === -1) return null;

	const old = all[idx];
	if (updates.fileName !== undefined) {
		all[idx] = { ...old, fileName: safeName(updates.fileName) };
	}
	await writeIndex(bucket, all);
	return all[idx];
}

export async function deleteMaterialRecord(bucket: R2Bucket, id: string): Promise<boolean> {
	const all = await readIndex(bucket);
	const target = all.find((m) => m.id === id);
	if (!target) return false;

	await bucket.delete(materialKey(target));
	const remaining = all.filter((m) => m.id !== id);
	await writeIndex(bucket, remaining);

	return true;
}

export async function getMaterialStream(
	bucket: R2Bucket,
	material: MaterialRecord
): Promise<ReadableStream<Uint8Array> | null> {
	const obj = await bucket.get(materialKey(material));
	return obj?.body ?? null;
}

// ── Local-filesystem fallback (for vite dev without R2) ──

const FALLBACK_DIR = path.resolve('.data', 'materials');

function ensureFallbackDir() {
	if (!fs.existsSync(FALLBACK_DIR)) fs.mkdirSync(FALLBACK_DIR, { recursive: true });
}

const FALLBACK_INDEX = path.join(FALLBACK_DIR, 'index.json');

function readFallbackIndex(): MaterialRecord[] {
	ensureFallbackDir();
	if (!fs.existsSync(FALLBACK_INDEX)) return [];

	try {
		return JSON.parse(fs.readFileSync(FALLBACK_INDEX, 'utf-8'));
	} catch (error) {
		console.warn('[r2] Failed to parse fallback index:', FALLBACK_INDEX, error);
		return [];
	}
}

function writeFallbackIndex(records: MaterialRecord[]): void {
	ensureFallbackDir();
	fs.writeFileSync(FALLBACK_INDEX, JSON.stringify(records, null, '\t'));
}

export function listMaterialsFallback(courseId?: string): MaterialRecord[] {
	const all = readFallbackIndex();
	return courseId ? all.filter((m) => m.courseId === courseId) : all;
}

export function getMaterialRecordFallback(id: string): MaterialRecord | null {
	return readFallbackIndex().find((m) => m.id === id) ?? null;
}

export function updateMaterialRecordFallback(
	id: string,
	updates: { fileName?: string }
): MaterialRecord | null {
	const all = readFallbackIndex();
	const idx = all.findIndex((m) => m.id === id);
	if (idx === -1) return null;

	const old = all[idx];
	if (updates.fileName !== undefined) {
		const oldPath = path.join(FALLBACK_DIR, `${old.id}-${old.fileName}`);
		all[idx] = { ...old, fileName: safeName(updates.fileName) };
		const newPath = path.join(FALLBACK_DIR, `${all[idx].id}-${all[idx].fileName}`);
		if (fs.existsSync(oldPath)) {
			fs.renameSync(oldPath, newPath);
		}
	}
	writeFallbackIndex(all);
	return all[idx];
}

export async function uploadMaterialFallback(
	courseId: string,
	file: File
): Promise<MaterialRecord> {
	ensureFallbackDir();
	const id = crypto.randomUUID();
	const safe = safeName(file.name);
	const bytes = Buffer.from(await file.arrayBuffer());

	fs.writeFileSync(path.join(FALLBACK_DIR, `${id}-${safe}`), bytes);

	const record: MaterialRecord = {
		id,
		courseId,
		fileName: safe,
		mimeType: file.type || 'application/octet-stream',
		size: bytes.byteLength,
		uploadedAt: new Date().toISOString()
	};

	const all = readFallbackIndex();
	all.push(record);
	writeFallbackIndex(all);

	return record;
}

export function deleteMaterialRecordFallback(id: string): boolean {
	const all = readFallbackIndex();
	const idx = all.findIndex((m) => m.id === id);
	if (idx === -1) return false;

	const target = all[idx];
	const filePath = path.join(FALLBACK_DIR, `${target.id}-${target.fileName}`);
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

	all.splice(idx, 1);
	writeFallbackIndex(all);
	return true;
}

export function getMaterialStreamFallback(material: MaterialRecord): Buffer {
	const filePath = path.join(FALLBACK_DIR, `${material.id}-${material.fileName}`);
	return fs.readFileSync(filePath);
}

export async function getMaterialBytes(
	bucket: R2Bucket,
	material: MaterialRecord
): Promise<Uint8Array | null> {
	const obj = await bucket.get(materialKey(material));
	if (!obj) return null;
	return new Uint8Array(await obj.arrayBuffer());
}

export function getMaterialBytesFallback(material: MaterialRecord): Uint8Array {
	const buf = getMaterialStreamFallback(material);
	return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
