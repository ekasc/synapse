import { beforeEach, describe, expect, it, vi } from 'vitest';

const { answerChat, getCourses } = vi.hoisted(() => ({
	answerChat: vi.fn(),
	getCourses: vi.fn()
}));

vi.mock('$lib/server/chat', () => ({
	parseChatRequest: (value: unknown) => value,
	answerChat
}));
vi.mock('$lib/server/store', () => ({ getCourses }));

import { POST } from './+server';

describe('POST /api/chat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getCourses.mockResolvedValue([]);
		answerChat.mockResolvedValue({
			answer: 'You have 15 courses.',
			confidence: 'grounded',
			sources: [],
			scope: 'all'
		});
	});

	it('passes the authenticated user ID to the chat service', async () => {
		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ question: 'How many courses do I have?', courseId: 'all' })
		});

		const response = await POST({
			request,
			locals: { user: { id: 'user-1' } },
			platform: { env: { BRIEF_DB: {}, MATERIALS: {} } }
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(answerChat).toHaveBeenCalledWith(
			expect.objectContaining({ question: 'How many courses do I have?', courseId: 'all' }),
			expect.objectContaining({ userId: 'user-1' })
		);
	});
});
