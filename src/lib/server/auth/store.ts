// ── Auth store: users and sessions backed by D1 (prod) or local JSON (dev) ──

let _d1: D1Database | null = null;

export function setAuthDb(d1: D1Database | null): void {
	_d1 = d1;
}

// ── Types ──

export type AuthUser = {
	id: string;
	workosId: string;
	email: string;
	name: string | null;
	createdAt: string;
};

export type AuthSession = {
	id: string;
	userId: string;
	workosSessionId: string | null;
	issuedAt: string;
	expiresAt: string;
	revokedAt: string | null;
};

// ── D1 helpers ──

async function d1First<T>(sql: string, ...bind: unknown[]): Promise<T | null> {
	if (!_d1) return null;
	const row = await _d1.prepare(sql).bind(...bind).first<T>();
	return row ?? null;
}

async function d1Run(sql: string, ...bind: unknown[]): Promise<void> {
	if (!_d1) return;
	await _d1.prepare(sql).bind(...bind).run();
}

// ── Local JSON fallback ──

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('.data');

function ensureDir() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readLocal<T>(name: string): T[] {
	ensureDir();
	const file = path.join(DATA_DIR, `${name}.json`);
	if (!fs.existsSync(file)) return [];
	return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeLocal<T>(name: string, data: T[]): void {
	ensureDir();
	fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, '\t'));
}

// ── User operations ──

export async function findOrCreateUser(workosUser: {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
}): Promise<AuthUser> {
	const now = new Date().toISOString();
	const name = [workosUser.firstName, workosUser.lastName].filter(Boolean).join(' ') || null;

	if (_d1) {
		// Try to find existing user
		const existing = await d1First<{
			id: string;
			workos_id: string;
			email: string;
			name: string | null;
			created_at: string;
		}>('SELECT id, workos_id, email, name, created_at FROM users WHERE workos_id = ?', workosUser.id);

		if (existing) {
			// Update email/name in case they changed in WorkOS
			await d1Run(
				'UPDATE users SET email = ?, name = ?, updated_at = ? WHERE id = ?',
				workosUser.email,
				name,
				now,
				existing.id
			);
			return {
				id: existing.id,
				workosId: existing.workos_id,
				email: existing.email,
				name: existing.name,
				createdAt: existing.created_at
			};
		}

		const id = crypto.randomUUID();
		await d1Run(
			'INSERT INTO users (id, workos_id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
			id,
			workosUser.id,
			workosUser.email,
			name,
			now,
			now
		);
		return { id, workosId: workosUser.id, email: workosUser.email, name, createdAt: now };
	}

	// Local JSON fallback
	const users = readLocal<AuthUser>('users');
	const existing = users.find((u) => u.workosId === workosUser.id);
	if (existing) {
		existing.email = workosUser.email;
		existing.name = name;
		writeLocal('users', users);
		return existing;
	}
	const newUser: AuthUser = { id: crypto.randomUUID(), workosId: workosUser.id, email: workosUser.email, name, createdAt: now };
	users.push(newUser);
	writeLocal('users', users);
	return newUser;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
	if (_d1) {
		const row = await d1First<{
			id: string;
			workos_id: string;
			email: string;
			name: string | null;
			created_at: string;
		}>('SELECT id, workos_id, email, name, created_at FROM users WHERE id = ?', id);
		if (!row) return null;
		return { id: row.id, workosId: row.workos_id, email: row.email, name: row.name, createdAt: row.created_at };
	}
	const users = readLocal<AuthUser>('users');
	return users.find((u) => u.id === id) ?? null;
}

// ── Session operations ──

export async function createSession(userId: string, workosSessionId?: string): Promise<{ id: string; expiresAt: string }> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	if (_d1) {
		await d1Run(
			'INSERT INTO sessions (id, user_id, workos_session_id, issued_at, expires_at) VALUES (?, ?, ?, ?, ?)',
			id,
			userId,
			workosSessionId ?? null,
			now,
			expiresAt
		);
		return { id, expiresAt };
	}

	const sessions = readLocal<AuthSession>('sessions');
	sessions.push({
		id,
		userId,
		workosSessionId: workosSessionId ?? null,
		issuedAt: now,
		expiresAt,
		revokedAt: null
	});
	writeLocal('sessions', sessions);
	return { id, expiresAt };
}

export async function getActiveSession(sessionId: string, userId: string): Promise<boolean> {
	if (_d1) {
		const row = await d1First<{ active: number }>(
			`SELECT 1 as active FROM sessions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL
			 AND s.expires_at > datetime('now') AND u.deleted_at IS NULL`,
			sessionId,
			userId
		);
		return row !== null;
	}
	const sessions = readLocal<AuthSession>('sessions');
	const session = sessions.find((s) => s.id === sessionId && s.userId === userId);
	if (!session || session.revokedAt) return false;
	return new Date(session.expiresAt) > new Date();
}

export async function revokeSession(sessionId: string): Promise<void> {
	const now = new Date().toISOString();
	if (_d1) {
		await d1Run('UPDATE sessions SET revoked_at = ? WHERE id = ?', now, sessionId);
		return;
	}
	const sessions = readLocal<AuthSession>('sessions');
	const idx = sessions.findIndex((s) => s.id === sessionId);
	if (idx !== -1) {
		sessions[idx].revokedAt = now;
		writeLocal('sessions', sessions);
	}
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
	const now = new Date().toISOString();
	if (_d1) {
		await d1Run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', now, userId);
		return;
	}
	const sessions = readLocal<AuthSession>('sessions');
	for (const s of sessions) {
		if (s.userId === userId && !s.revokedAt) {
			s.revokedAt = now;
		}
	}
	writeLocal('sessions', sessions);
}
