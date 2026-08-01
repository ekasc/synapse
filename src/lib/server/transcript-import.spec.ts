import { beforeEach, describe, expect, it, vi } from 'vitest';

const { addCourse, addSemester, getAcademicDigest, getCourses, getSemesters } = vi.hoisted(() => ({
	addCourse: vi.fn(),
	addSemester: vi.fn(),
	getAcademicDigest: vi.fn(),
	getCourses: vi.fn(),
	getSemesters: vi.fn()
}));

vi.mock('./store', () => ({
	addCourse,
	addSemester,
	getAcademicDigest,
	getCourses,
	getSemesters
}));

import { getTranscriptImportPreview, importTranscriptCourses } from './transcript-import';

describe('transcript semester import', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getAcademicDigest.mockResolvedValue({
			source: 'transcript-upload',
			courses: [
				{
					code: 'CSIS 2270',
					name: 'Database Systems',
					term: 'Spring 2026',
					credits: 3,
					currentPercent: 94,
					projectedPercent: 94,
					status: 'finished'
				},
				{
					code: 'CSIS 4495',
					name: 'Applied Research',
					term: 'Summer 2026',
					credits: 3,
					currentPercent: 88,
					projectedPercent: 90,
					status: 'current'
				}
			]
		});
		getSemesters.mockResolvedValue([
			{ id: 'spring-2026', userId: 'user-1', term: 'Spring', year: 2026, order: 0 }
		]);
		getCourses.mockResolvedValue([
			{
				id: 'existing-course',
				userId: 'user-1',
				semesterId: 'spring-2026',
				code: 'CSIS 2270',
				name: 'Database Systems'
			}
		]);
	});

	it('previews and imports only missing records', async () => {
		expect(await getTranscriptImportPreview('user-1')).toEqual({
			semesterCount: 1,
			courseCount: 1,
			terms: ['Spring 2026', 'Summer 2026']
		});

		const result = await importTranscriptCourses('user-1');

		expect(result).toMatchObject({ semesterCount: 1, courseCount: 1 });
		expect(addSemester).toHaveBeenCalledOnce();
		expect(addCourse).toHaveBeenCalledOnce();
		expect(addCourse.mock.calls[0][1]).toMatchObject({
			userId: 'user-1',
			code: 'CSIS 4495',
			signals: { status: 'active', currentGrade: 88, projectedGrade: 90 }
		});
	});
});
