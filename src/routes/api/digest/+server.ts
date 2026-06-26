import { json } from '@sveltejs/kit';
import { clearAcademicDigest } from '$lib/server/store';

export function DELETE() {
	return json({ ok: true, digest: clearAcademicDigest() });
}
