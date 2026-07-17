import { describe, expect, it } from 'vitest';
import { buildPriorityDashboard, resolveCurrentTerm, resolveTermContext } from './priority';

const base = (overrides = {}) => ({
	now: new Date(2026, 2, 10, 12),
	semesters: [{ id: 's', term: 'Spring', year: 2026, order: 1 }],
	courses: [],
	events: [],
	practice: [],
	briefs: [],
	materials: [],
	...overrides
});
const event = (id: string, date: number, extra = {}) => ({
	id,
	courseCode: 'CS101',
	title: id,
	type: 'assignment',
	date,
	month: 2,
	year: 2026,
	time: null,
	gradeWeight: null,
	status: null,
	notes: null,
	createdAt: '',
	updatedAt: '',
	...extra
});

describe('priority dashboard', () => {
	it('resolves Winter, Spring, Summer, Fall, and Autumn by their month windows', () => {
		const semesters = [
			{ id: 'w', term: 'Winter', year: 2026, order: 0 },
			{ id: 's', term: 'Spring', year: 2026, order: 1 },
			{ id: 'u', term: 'Summer', year: 2026, order: 2 },
			{ id: 'f', term: 'Fall', year: 2026, order: 3 }
		];
		expect(resolveCurrentTerm(new Date(2026, 2, 1), semesters)?.id).toBe('w');
		expect(resolveCurrentTerm(new Date(2026, 4, 1), semesters)?.id).toBe('s');
		expect(resolveCurrentTerm(new Date(2026, 5, 1), semesters)?.id).toBe('s');
		expect(resolveCurrentTerm(new Date(2026, 6, 1), semesters)?.id).toBe('u');
		expect(resolveCurrentTerm(new Date(2026, 7, 1), semesters)?.id).toBe('u');
		expect(resolveCurrentTerm(new Date(2026, 8, 1), semesters)?.id).toBe('f');
		expect(
			resolveCurrentTerm(new Date(2026, 9, 1), [{ id: 'a', term: 'Autumn', year: 2026, order: 3 }])
				?.id
		).toBe('a');
		expect(
			resolveCurrentTerm(new Date(2026, 2, 1), [{ id: 'x', term: 'Odd', year: 2026, order: 1 }])?.id
		).toBe('x');
	});
	it('distinguishes the current term from the next available term', () => {
		const semesters = [
			{ id: 'fall', term: 'Fall', year: 2026, order: 20263 },
			{ id: 'winter', term: 'Winter', year: 2027, order: 20270 }
		];
		expect(resolveTermContext(new Date(2026, 6, 16), semesters)).toEqual({
			semester: semesters[0],
			relation: 'next'
		});
		const result = buildPriorityDashboard(base({ now: new Date(2026, 6, 16), semesters }));
		expect(result.currentTermLabel).toBe('Fall 2026');
		expect(result.termContextLabel).toBe('Next term');
	});
	it('includes event time and grade weight in nonduplicative details', () => {
		const result = buildPriorityDashboard(
			base({ events: [event('details', 10, { time: '9:30 AM', gradeWeight: 25 })] })
		);
		const item = result.attentionItems[0];
		expect(item.eyebrow).toBe('Due today');
		expect(item.reason).toBe('9:30 AM · 25% of grade');
		expect(result.agendaDays[0]?.items[0]?.reason).toBe(item.reason);
	});
	it('falls back to a readable event type when details are absent', () => {
		const result = buildPriorityDashboard(
			base({ events: [event('study', 11, { type: 'study_session' })] })
		);
		expect(result.agendaDays[0]?.items[0]?.reason).toBe('Study Session');
	});
	it('uses zero-based calendar months without shifting March', () => {
		const result = buildPriorityDashboard(base({ events: [event('march', 11)] }));
		expect(result.agendaDays[0]?.date).toBe('2026-03-11');
	});
	it('rejects invalid calendar dates and accepts valid month boundaries', () => {
		const result = buildPriorityDashboard(
			base({
				now: new Date(2026, 1, 28, 12),
				events: [event('feb-31', 31, { month: 1 }), event('feb-28', 28, { month: 1 })]
			})
		);
		expect(result.agendaDays.map((item) => item.date)).toEqual(['2026-02-28']);
	});
	it('ranks, deduplicates, and excludes completed events', () => {
		const result = buildPriorityDashboard(
			base({
				events: [
					event('overdue', 9),
					event('today', 10),
					event('done', 10, { status: 'completed' }),
					event('exam', 11, { type: 'exam', gradeWeight: 40 })
				]
			})
		);
		expect(result.attentionItems.map((item) => item.id)).toEqual([
			'event:overdue',
			'event:today',
			'event:exam'
		]);
	});
	it('counts future events separately from urgent items and assigns tones', () => {
		const result = buildPriorityDashboard(
			base({
				events: [
					event('overdue', 9),
					event('today', 10),
					event('tomorrow', 11),
					event('later', 12),
					event('edge', 17)
				]
			})
		);
		expect(result.summary.urgentCount).toBe(2);
		expect(result.summary.upcomingCount).toBe(3);
		expect(result.summary.sentence).toContain('3 more this week');
		expect(result.attentionItems.slice(0, 2).map((item) => item.tone)).toEqual([
			'critical',
			'critical'
		]);
		expect(result.agendaDays.flatMap((day) => day.items).map((item) => item.tone)).toEqual([
			'critical',
			'neutral',
			'neutral',
			'neutral'
		]);
	});
	it('uses canonical nested URLs for risk and material items', () => {
		const result = buildPriorityDashboard(
			base({
				courses: [
					{
						id: 'course-1',
						semesterId: 'semester-1',
						code: 'CS101',
						signals: { riskLevel: 'high' }
					} as never
				],
				materials: [
					{
						id: 'material-1',
						courseId: 'course-1',
						fileName: 'notes',
						uploadedAt: '2026-03-10'
					} as never
				]
			})
		);
		expect(result.attentionItems[0]?.href).toBe('/app/semesters/semester-1/courses/course-1');
		expect(result.continueItems[0]?.href).toBe('/app/semesters/semester-1/courses/course-1');
	});

	it('uses canonical nested URLs for course practice sessions', () => {
		const result = buildPriorityDashboard(
			base({
				courses: [
					{ id: 'course-1', semesterId: 'semester-1', code: 'CS101', signals: {} } as never
				],
				practice: [
					{
						id: 'practice-1',
						courseId: 'course-1',
						courseCode: 'CS101',
						sourceMaterials: [],
						status: 'paused',
						score: 0,
						questionCount: 1,
						createdAt: '2026-03-10',
						updatedAt: '2026-03-10'
					}
				]
			})
		);
		expect(result.attentionItems[0]?.href).toBe(
			'/app/semesters/semester-1/courses/course-1/practice'
		);
		expect(result.continueItems[0]?.href).toBe(
			'/app/semesters/semester-1/courses/course-1/practice'
		);
	});

	it('falls back to semesters when a material course is missing', () => {
		const result = buildPriorityDashboard(
			base({
				materials: [
					{
						id: 'material-1',
						courseId: 'missing',
						fileName: 'notes',
						uploadedAt: '2026-03-10'
					} as never
				]
			})
		);
		expect(result.continueItems[0]?.href).toBe('/app/semesters');
	});

	it('marks high-risk course attention as critical and urgent', () => {
		const result = buildPriorityDashboard(
			base({
				courses: [
					{
						id: 'course-1',
						code: 'CS101',
						signals: { riskLevel: 'high' }
					} as never
				]
			})
		);

		expect(result.attentionItems[0]?.tone).toBe('critical');
		expect(result.summary.urgentCount).toBe(1);
	});
	it('uses today plus seven days and omits empty days', () => {
		const result = buildPriorityDashboard(
			base({ events: [event('start', 10), event('edge', 17), event('outside', 18)] })
		);
		expect(result.agendaDays.map((item) => item.date)).toEqual(['2026-03-10', '2026-03-17']);
	});
	it('limits continue items and prefers practice then briefing then material', () => {
		const result = buildPriorityDashboard(
			base({
				practice: [
					{
						id: 'p',
						courseId: 'c',
						courseCode: 'CS101',
						sourceMaterials: [],
						status: 'in_progress',
						score: 0,
						questionCount: 1,
						createdAt: '2026-01-01',
						updatedAt: '2026-03-10'
					}
				],
				briefs: [{ code: 'CS101', researchedAt: '2026-03-10' } as never],
				materials: [{ id: 'm', courseId: 'c', fileName: 'x', uploadedAt: '2026-03-10' } as never]
			})
		);
		expect(result.continueItems).toHaveLength(2);
		expect(result.continueItems.map((item) => item.kind)).toEqual(['practice', 'briefing']);
	});
});
