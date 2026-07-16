import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { createDb } from '$lib/server/db/d1';

export async function POST() {
	return json(
		{ error: 'INVALID_REQUEST', detail: 'Use /api/briefing/jobs for course research.' },
		{ status: 410 }
	);
}

export async function DELETE({ url, platform }: RequestEvent) {
	if (!platform) {
		return json({ error: 'Cloudflare platform not available' }, { status: 500 });
	}
	const code = url.searchParams.get('code');
	if (!code) {
		return json({ error: 'Course code is required' }, { status: 400 });
	}
	const db = createDb(platform.env.BRIEF_DB);
	await db.deleteBrief(code.trim().toUpperCase());
	return json({ deleted: true });
}
