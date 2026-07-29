import { json, type RequestEvent } from '@sveltejs/kit';
import {
	clearSyllabusImport,
	getCourses,
	getSyllabusImport,
	getSyllabusImports
} from '$lib/server/store';

export async function GET({ locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ extractions: [] });
	const [imports, courses] = await Promise.all([getSyllabusImports(userId), getCourses(userId)]);
	const courseCodes = new Map(courses.map((course) => [course.id, course.code]));
	return json({
		extractions: imports.map((item) => ({
			id: item.id,
			courseId: item.courseId,
			courseCode: courseCodes.get(item.courseId) ?? item.courseId,
			status: item.status === 'error' ? 'failed' : 'completed',
			fileName: item.fileName,
			createdAt: item.createdAt,
			completedAt: item.updatedAt
		}))
	});
}

export async function DELETE({ url, locals }: RequestEvent) {
	const userId = locals.user?.id;
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	const courseId = url.searchParams.get('courseId')?.trim();
	if (!courseId) return json({ error: 'Missing courseId' }, { status: 400 });
	if (!(await getSyllabusImport(userId, courseId)))
		return json({ error: 'Syllabus not found' }, { status: 404 });

	await clearSyllabusImport(userId, courseId);
	return json({ ok: true });
}
