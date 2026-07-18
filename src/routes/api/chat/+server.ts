import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { answerChat, parseChatRequest } from '$lib/server/chat';

export async function POST({ request, platform }: RequestEvent) {
	try {
		const input = parseChatRequest(await request.json());
		const courses = await (await import('$lib/server/store')).getCourses();
		if (input.courseId !== 'all' && !courses.some((course) => course.id === input.courseId))
			return json({ ok: false, error: 'Course not found' }, { status: 404 });
		const result = await answerChat(input, {
			db: platform?.env?.BRIEF_DB,
			materials: platform?.env?.MATERIALS,
			apiKey: platform?.env?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
			model: platform?.env?.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL
		});
		return json({ ok: true, ...result });
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Unable to answer chat request'
			},
			{ status: 400 }
		);
	}
}
