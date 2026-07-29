import { describe, expect, it } from 'vitest';
import { buildWeeklyDigest, type WeeklyDigestInput } from './weekly';
import type { Course, Semester, StudySession } from '$lib/server/store';
import type { Briefing, CalendarEventRow } from '$lib/server/db/d1';
import type { MaterialRecord } from '$lib/server/r2';
import type { PracticeSessionSummary } from '$lib/server/practice/sessions';
import type { MaterialIndexRecord } from '$lib/server/practice/material-index';

// Monday 20 July 2026, 09:00 local. Week window: 2026-07-20 → 2026-07-26.
const now = new Date(2026, 6, 20, 9, 0, 0);

function base(overrides: Partial<WeeklyDigestInput> = {}): WeeklyDigestInput {
	return {
		now,
		courses: [],
		semesters: [],
		courseGraph: { edges: [] },
		calendarEvents: [],
		practiceSessions: [],
		studySessions: [],
		materials: [],
		materialIndexes: [],
		briefings: [],
		...overrides
	};
}

function course(overrides: Partial<Course> = {}): Course {
	return {
		id: 'c1',
		semesterId: 's1',
		code: 'CSIS 4495',
		name: 'Applied Research Project',
		...overrides
	};
}

function event(overrides: Partial<CalendarEventRow> = {}): CalendarEventRow {
	return {
		id: 'e1',
		courseId: 'c1',
		courseCode: 'CSIS 4495',
		title: 'Milestone 1',
		type: 'assignment',
		date: 23,
		month: 6,
		year: 2026,
		time: null,
		gradeWeight: 25,
		status: 'pending',
		notes: null,
		createdAt: '',
		updatedAt: '',
		...overrides
	};
}

function studySession(overrides: Partial<StudySession> = {}): StudySession {
	return {
		id: 'st1',
		courseId: 'c1',
		intention: 'review milestone',
		plannedSeconds: 1500,
		completedSeconds: 1500,
		distractionCount: 0,
		focusScore: 80,
		startedAt: '2026-07-19T10:00:00',
		completedAt: '2026-07-19T10:25:00',
		...overrides
	};
}

function practice(overrides: Partial<PracticeSessionSummary> = {}): PracticeSessionSummary {
	return {
		id: 'p1',
		courseId: 'c1',
		courseCode: 'CSIS 4495',
		sourceMaterials: [],
		status: 'paused',
		score: 4,
		questionCount: 12,
		flashcardCount: 0,
		topics: [],
		createdAt: '2026-07-15T09:00:00',
		updatedAt: '2026-07-16T09:00:00',
		...overrides
	};
}

function material(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
	return {
		id: 'm1',
		courseId: 'c1',
		fileName: 'lecture-notes.pdf',
		mimeType: 'application/pdf',
		size: 1024,
		uploadedAt: '2026-07-18T09:00:00.000Z',
		...overrides
	};
}

function materialIndex(overrides: Partial<MaterialIndexRecord> = {}): MaterialIndexRecord {
	return {
		materialId: 'm1',
		courseId: 'c1',
		status: 'ready',
		pageCount: 10,
		nextPage: 11,
		characterCount: 5000,
		errorMessage: null,
		indexVersion: 1,
		createdAt: '2026-07-18T09:05:00.000Z',
		updatedAt: '2026-07-18T09:06:00.000Z',
		...overrides
	};
}

function semester(overrides: Partial<Semester> = {}): Semester {
	return { id: 's1', term: 'Fall', year: 2026, order: 1, ...overrides };
}

function briefing(overrides: Partial<Briefing> = {}): Briefing {
	return {
		code: 'CSIS 4495',
		name: 'Applied Research Project',
		institution: 'Douglas College',
		professor: 'Staff',
		rmpRating: 'n/a',
		workload: 'moderate',
		weeklyHours: null,
		prereqReadiness: 'n/a',
		gradeStructure: [],
		recommendation: 'Plan early.',
		sources: [],
		researchedAt: '2026-07-01T00:00:00.000Z',
		modelUsed: 'test-model',
		schemaVersion: 1,
		...overrides
	};
}

describe('buildWeeklyDigest — empty data', () => {
	it('returns the week window and empty sections for empty input', () => {
		const digest = buildWeeklyDigest(base());
		expect(digest.generatedAt).toBe(now.toISOString());
		expect(digest.weekStart).toBe('2026-07-20');
		expect(digest.weekEnd).toBe('2026-07-26');
		expect(digest.priorities).toEqual([]);
		expect(digest.deadlines).toEqual([]);
		expect(digest.crunchWindows).toEqual([]);
		expect(digest.studyGaps).toEqual([]);
		expect(digest.continuationItems).toEqual([]);
		expect(digest.warnings).toEqual([]);
	});

	it('throws for an invalid now instead of inventing a date', () => {
		expect(() => buildWeeklyDigest(base({ now: new Date('not-a-date') }))).toThrow(/valid `now`/);
	});
});

describe('buildWeeklyDigest — deadlines', () => {
	it('lists an upcoming deadline chronologically with a deterministic reason', () => {
		const digest = buildWeeklyDigest(base({ courses: [course()], calendarEvents: [event()] }));
		expect(digest.deadlines).toHaveLength(1);
		expect(digest.deadlines[0]).toMatchObject({
			id: 'e1',
			courseCode: 'CSIS 4495',
			title: 'Milestone 1',
			dueDate: '2026-07-23',
			gradeWeight: 25,
			daysUntil: 3,
			overdue: false
		});
		expect(digest.priorities).toHaveLength(1);
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Milestone 1 is due in 3 days, worth 25% of the course grade, and no study session has been recorded this week.'
		);
		expect(digest.priorities[0].factors).toContain('due in 3 days');
		expect(digest.priorities[0].link.href).toBe('/app/semesters/s1/courses/c1');
	});

	it('flags overdue work and orders overdue deadlines first', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [
					event({ id: 'e-late', title: 'Draft', date: 17 }),
					event({ id: 'e-soon', title: 'Final', date: 25 })
				]
			})
		);
		expect(digest.deadlines.map((deadline) => deadline.id)).toEqual(['e-late', 'e-soon']);
		expect(digest.deadlines[0]).toMatchObject({
			dueDate: '2026-07-17',
			daysUntil: -3,
			overdue: true
		});
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Draft was due 3 days ago, worth 25% of the course grade, and no study session has been recorded this week.'
		);
	});

	it('drops completed events entirely', () => {
		const digest = buildWeeklyDigest(
			base({ courses: [course()], calendarEvents: [event({ status: 'completed' })] })
		);
		expect(digest.deadlines).toEqual([]);
		expect(digest.priorities).toEqual([]);
	});

	it('keeps unknown weights unknown and omits the weight clause', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [event({ gradeWeight: null })],
				studySessions: [studySession()]
			})
		);
		expect(digest.deadlines[0].gradeWeight).toBeNull();
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Milestone 1 is due in 3 days.'
		);
		expect(digest.priorities[0].factors.some((factor) => factor.includes('%'))).toBe(false);
	});

	it('drops the study clause when a recent study session exists', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [event()],
				studySessions: [studySession()]
			})
		);
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Milestone 1 is due in 3 days, worth 25% of the course grade.'
		);
	});
});
describe('buildWeeklyDigest — priority ordering', () => {
	it('keeps only the top three priorities in a deterministic order', () => {
		const courses = [
			course({ id: 'ca', code: 'CSIS 1100' }),
			course({ id: 'cb', code: 'CSIS 1200' }),
			course({ id: 'cc', code: 'CSIS 1300' }),
			course({ id: 'cd', code: 'CSIS 1400' }),
			course({ id: 'ce', code: 'CSIS 1500' })
		];
		const digest = buildWeeklyDigest(
			base({
				courses,
				calendarEvents: [
					event({ id: 'ea', courseId: 'ca', courseCode: 'CSIS 1100', date: 19, gradeWeight: 40 }),
					event({ id: 'eb', courseId: 'cb', courseCode: 'CSIS 1200', date: 22, gradeWeight: 30 }),
					event({ id: 'ec', courseId: 'cc', courseCode: 'CSIS 1300', date: 24, gradeWeight: 50 }),
					event({ id: 'ed', courseId: 'cd', courseCode: 'CSIS 1400', date: 26, gradeWeight: 10 }),
					event({ id: 'ee', courseId: 'ce', courseCode: 'CSIS 1500', date: 21, gradeWeight: null })
				]
			})
		);
		expect(digest.priorities.map((priority) => priority.id)).toEqual([
			'event:ea',
			'event:eb',
			'event:ee'
		]);
		expect(digest.priorities.map((priority) => priority.rank)).toEqual([1, 2, 3]);
		expect(digest.priorities[0].score).toBeGreaterThan(digest.priorities[1].score);
		expect(digest.priorities[1].score).toBeGreaterThanOrEqual(digest.priorities[2].score);
	});

	it('breaks equal scores by due date, then course code, then record id', () => {
		const digest = buildWeeklyDigest(
			base({
				calendarEvents: [
					event({ id: 'z9', courseId: null, courseCode: 'CSIS 2300', date: 22, gradeWeight: null }),
					event({ id: 'a1', courseId: null, courseCode: 'CSIS 2300', date: 22, gradeWeight: null }),
					event({ id: 'm5', courseId: null, courseCode: 'CSIS 1175', date: 22, gradeWeight: null }),
					event({ id: 'q7', courseId: null, courseCode: 'CSIS 1175', date: 21, gradeWeight: null })
				]
			})
		);
		expect(digest.priorities.map((priority) => priority.id)).toEqual([
			'event:q7',
			'event:m5',
			'event:a1'
		]);
	});
});

describe('buildWeeklyDigest — crunch windows', () => {
	it('detects three deadlines clustered within three days', () => {
		const digest = buildWeeklyDigest(
			base({
				calendarEvents: [
					event({ id: 'w1', date: 21, gradeWeight: null }),
					event({ id: 'w2', date: 22, gradeWeight: null }),
					event({ id: 'w3', date: 23, gradeWeight: null })
				]
			})
		);
		expect(digest.crunchWindows).toHaveLength(1);
		expect(digest.crunchWindows[0]).toMatchObject({
			startDate: '2026-07-21',
			endDate: '2026-07-23',
			eventCount: 3,
			totalWeight: null
		});
		expect(digest.crunchWindows[0].eventIds).toEqual(['w1', 'w2', 'w3']);
		expect(digest.crunchWindows[0].reason).toContain('3 deadlines land within 3 days');
	});

	it('detects two deadlines close together when one carries heavy weight', () => {
		const digest = buildWeeklyDigest(
			base({
				calendarEvents: [
					event({ id: 'h1', date: 24, gradeWeight: 30 }),
					event({ id: 'h2', date: 24, gradeWeight: null })
				]
			})
		);
		expect(digest.crunchWindows).toHaveLength(1);
		expect(digest.crunchWindows[0].totalWeight).toBe(30);
		expect(digest.crunchWindows[0].reason).toContain('known grade weights total 30%');
	});

	it('does not invent a crunch for light deadlines far apart', () => {
		const digest = buildWeeklyDigest(
			base({
				calendarEvents: [
					event({ id: 'f1', date: 21, gradeWeight: null }),
					event({ id: 'f2', date: 26, gradeWeight: null })
				]
			})
		);
		expect(digest.crunchWindows).toEqual([]);
	});

	it('never treats overdue events as an upcoming crunch', () => {
		const digest = buildWeeklyDigest(
			base({
				calendarEvents: [
					event({ id: 'o1', date: 17, gradeWeight: 30 }),
					event({ id: 'o2', date: 18, gradeWeight: 30 })
				]
			})
		);
		expect(digest.crunchWindows).toEqual([]);
	});
});

describe('buildWeeklyDigest — practice sessions', () => {
	it('surfaces paused sessions as continuation items and priorities', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				practiceSessions: [
					practice({ topics: ['loops', 'arrays'], updatedAt: '2026-07-16T09:00:00' })
				]
			})
		);
		expect(digest.continuationItems).toHaveLength(1);
		expect(digest.continuationItems[0]).toMatchObject({
			id: 'p1',
			status: 'paused',
			questionCount: 12,
			daysSinceUpdate: 4
		});
		expect(digest.continuationItems[0].reason).toBe(
			'Paused with 12 questions on loops, arrays, last activity 4 days ago.'
		);
		expect(digest.continuationItems[0].link.href).toBe('/app/semesters/s1/courses/c1/practice');
		expect(digest.priorities[0]).toMatchObject({ kind: 'practice', id: 'practice:p1' });
	});

	it('keeps unknown activity times unknown instead of guessing', () => {
		const digest = buildWeeklyDigest(
			base({ practiceSessions: [practice({ updatedAt: 'garbage' })] })
		);
		expect(digest.continuationItems[0].daysSinceUpdate).toBeNull();
		expect(digest.continuationItems[0].updatedAt).toBeNull();
		expect(digest.continuationItems[0].reason).toBe('Paused with 12 questions.');
	});

	it('ignores completed sessions', () => {
		const digest = buildWeeklyDigest(
			base({ practiceSessions: [practice({ status: 'completed' })] })
		);
		expect(digest.continuationItems).toEqual([]);
		expect(digest.priorities).toEqual([]);
	});
});
describe('buildWeeklyDigest — material indexes', () => {
	it('warns about uploaded materials with no index record', () => {
		const digest = buildWeeklyDigest(base({ courses: [course()], materials: [material()] }));
		const warning = digest.warnings.find((item) => item.kind === 'material_index');
		expect(warning).toMatchObject({
			kind: 'material_index',
			courseCode: 'CSIS 4495',
			materialId: 'm1',
			fileName: 'lecture-notes.pdf',
			status: 'missing'
		});
		expect(digest.priorities[0]).toMatchObject({ kind: 'material', id: 'material:m1' });
		expect(digest.priorities[0].reason).toBe(
			'lecture-notes.pdf for CSIS 4495 has no index record yet.'
		);
	});

	it('says nothing when the material index is ready', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				materials: [material()],
				materialIndexes: [materialIndex()]
			})
		);
		expect(digest.warnings.filter((item) => item.kind === 'material_index')).toEqual([]);
		expect(digest.priorities).toEqual([]);
	});

	it('carries the failure reason for failed indexes', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				materials: [material()],
				materialIndexes: [materialIndex({ status: 'failed', errorMessage: 'pdf is encrypted' })]
			})
		);
		const warning = digest.warnings.find((item) => item.kind === 'material_index');
		expect(warning?.message).toBe(
			'lecture-notes.pdf for CSIS 4495 failed to index — pdf is encrypted.'
		);
	});
});

describe('buildWeeklyDigest — study gaps', () => {
	it('flags courses with deadlines but no recent study activity', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course({ signals: { status: 'active' } })],
				calendarEvents: [event()],
				studySessions: [studySession({ completedAt: '2026-07-10T10:25:00' })]
			})
		);
		expect(digest.studyGaps).toHaveLength(1);
		expect(digest.studyGaps[0]).toMatchObject({
			courseId: 'c1',
			courseCode: 'CSIS 4495',
			daysSinceLastStudy: 10
		});
		expect(digest.studyGaps[0].reason).toBe(
			'No study session recorded this week; last session was 10 days ago; Milestone 1 is due in 3 days.'
		);
		expect(digest.studyGaps[0].link.href).toBe('/app/timer');
	});

	it('says nothing when the course was studied this week', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course({ signals: { status: 'active' } })],
				calendarEvents: [event()],
				studySessions: [studySession()]
			})
		);
		expect(digest.studyGaps).toEqual([]);
	});

	it('keeps last-study unknown when no session was ever recorded', () => {
		const digest = buildWeeklyDigest(base({ courses: [course()], calendarEvents: [event()] }));
		expect(digest.studyGaps[0].lastStudyAt).toBeNull();
		expect(digest.studyGaps[0].daysSinceLastStudy).toBeNull();
		expect(digest.studyGaps[0].reason).toContain('no study sessions on record');
	});
});

describe('buildWeeklyDigest — invalid and missing data', () => {
	it('excludes events with impossible dates and warns instead of guessing', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [
					event({ id: 'bad1', title: 'Mystery', month: 13, date: 1 }),
					event({ id: 'bad2', title: 'Leap Day', month: 1, date: 30, year: 2026 }),
					event({ id: 'ok', title: 'Real', date: 24 })
				]
			})
		);
		expect(digest.deadlines.map((deadline) => deadline.id)).toEqual(['ok']);
		const invalid = digest.warnings.filter((item) => item.kind === 'invalid_date');
		expect(invalid).toHaveLength(2);
		expect(invalid.map((warning) => warning.message)).toEqual([
			'“Leap Day” (CSIS 4495) has an invalid date and was left out of this plan.',
			'“Mystery” (CSIS 4495) has an invalid date and was left out of this plan.'
		]);
	});

	it('resolves events without a courseId through a unique course code match', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [event({ courseId: null })],
				studySessions: [studySession()]
			})
		);
		expect(digest.deadlines[0].courseId).toBe('c1');
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Milestone 1 is due in 3 days, worth 25% of the course grade.'
		);
	});

	it('stays silent about study activity when the course cannot be resolved', () => {
		const digest = buildWeeklyDigest(base({ calendarEvents: [event({ courseId: null })] }));
		expect(digest.deadlines[0].courseId).toBeNull();
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Milestone 1 is due in 3 days, worth 25% of the course grade.'
		);
		expect(digest.studyGaps).toEqual([]);
	});
});
describe('buildWeeklyDigest — course map prerequisites', () => {
	const fall = semester({ id: 's1', term: 'Fall', year: 2026, order: 1 });
	const spring = semester({ id: 's2', term: 'Spring', year: 2027, order: 2 });
	const prereqCourse = course({ id: 'cp', semesterId: 's2', code: 'CSIS 1175' });
	const dependentCourse = course({ id: 'cd', semesterId: 's1', code: 'CSIS 2300' });

	it('warns when a course is planned before its prerequisite', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [prereqCourse, dependentCourse],
				semesters: [fall, spring],
				courseGraph: {
					edges: [{ source: 'cp', target: 'cd', type: 'prereq', reviewStatus: 'accepted' }]
				}
			})
		);
		const warning = digest.warnings.find((item) => item.kind === 'prerequisite');
		expect(warning).toMatchObject({ kind: 'prerequisite', courseCode: 'CSIS 2300' });
		expect(warning?.message).toBe(
			'CSIS 2300 is planned for Fall 2026, before its prerequisite CSIS 1175 (Spring 2027).'
		);
		expect(warning?.link.href).toBe('/app/courses');
	});

	it('ignores rejected and pending prerequisite relations', () => {
		for (const reviewStatus of ['rejected', 'pending'] as const) {
			const digest = buildWeeklyDigest(
				base({
					courses: [prereqCourse, dependentCourse],
					semesters: [fall, spring],
					courseGraph: { edges: [{ source: 'cp', target: 'cd', type: 'prereq', reviewStatus }] }
				})
			);
			expect(digest.warnings.filter((item) => item.kind === 'prerequisite')).toEqual([]);
		}
	});

	it('raises the priority of courses that other courses depend on', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course({ id: 'cp', code: 'CSIS 1175' }), course({ id: 'cd', code: 'CSIS 2300' })],
				courseGraph: {
					edges: [{ source: 'cp', target: 'cd', type: 'prereq', reviewStatus: 'accepted' }]
				},
				calendarEvents: [
					event({
						id: 'evp',
						courseId: 'cp',
						courseCode: 'CSIS 1175',
						date: 24,
						gradeWeight: null
					}),
					event({ id: 'evd', courseId: 'cd', courseCode: 'CSIS 2300', date: 24, gradeWeight: null })
				]
			})
		);
		const withImpact = digest.priorities.find((priority) => priority.id === 'event:evp');
		expect(withImpact?.factors).toContain('other planned courses depend on this one');
		const withoutImpact = digest.priorities.find((priority) => priority.id === 'event:evd');
		expect(withoutImpact?.factors ?? []).not.toContain('other planned courses depend on this one');
	});
});

describe('buildWeeklyDigest — course brief findings', () => {
	it('surfaces workload findings for courses in the week plan', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [event()],
				briefings: [briefing({ weeklyHours: '6-8 hours' })]
			})
		);
		const finding = digest.warnings.find((item) => item.kind === 'briefing');
		expect(finding?.message).toBe('CSIS 4495 brief: expect about 6-8 hours of work per week.');
		expect(finding?.link.href).toBe('/app/brief/CSIS%204495');
	});

	it('surfaces contradictions recorded by the brief', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [event()],
				briefings: [
					briefing({ contradictions: ['Catalog and RMP disagree on the final exam weight.'] })
				]
			})
		);
		const findings = digest.warnings.filter((item) => item.kind === 'briefing');
		expect(findings.map((item) => item.message)).toContain(
			'CSIS 4495 brief flags a contradiction: “Catalog and RMP disagree on the final exam weight.”.'
		);
	});

	it('does not attach brief findings to courses outside the week plan', () => {
		const digest = buildWeeklyDigest(
			base({
				courses: [course()],
				calendarEvents: [event({ date: 15, month: 8, year: 2026 })],
				briefings: [briefing({ weeklyHours: '6-8 hours' })]
			})
		);
		expect(digest.warnings.filter((item) => item.kind === 'briefing')).toEqual([]);
	});
});

describe('buildWeeklyDigest — determinism and honesty', () => {
	const richInput = () =>
		base({
			courses: [course({ signals: { status: 'active' } }), course({ id: 'c2', code: 'CSIS 1175' })],
			semesters: [semester()],
			courseGraph: {
				edges: [{ source: 'c1', target: 'c2', type: 'prereq', reviewStatus: 'accepted' }]
			},
			calendarEvents: [
				event(),
				event({ id: 'e2', courseId: 'c2', courseCode: 'CSIS 1175', date: 24, gradeWeight: null })
			],
			practiceSessions: [practice()],
			studySessions: [studySession({ completedAt: '2026-07-10T10:25:00' })],
			materials: [material()],
			materialIndexes: [],
			briefings: [briefing({ weeklyHours: '6-8 hours' })]
		});

	it('produces identical output for identical input and now', () => {
		const first = buildWeeklyDigest(richInput());
		const second = buildWeeklyDigest(richInput());
		expect(second).toEqual(first);
	});

	it('never fabricates values for unknown fields', () => {
		const digest = buildWeeklyDigest(
			base({
				calendarEvents: [event({ courseId: null, gradeWeight: null, time: null })]
			})
		);
		expect(digest.deadlines[0].gradeWeight).toBeNull();
		expect(digest.deadlines[0].time).toBeNull();
		expect(digest.deadlines[0].courseId).toBeNull();
		expect(digest.priorities[0].reason).toBe(
			'Review CSIS 4495 because Milestone 1 is due in 3 days.'
		);
		expect(JSON.stringify(digest)).not.toContain('NaN');
		expect(JSON.stringify(digest)).not.toContain('undefined');
	});

	it('links every priority, deadline, continuation item, and warning to a real page', () => {
		const digest = buildWeeklyDigest(richInput());
		const links = [
			...digest.priorities.map((item) => item.link.href),
			...digest.deadlines.map((item) => item.link.href),
			...digest.continuationItems.map((item) => item.link.href),
			...digest.studyGaps.map((item) => item.link.href),
			...digest.crunchWindows.map((item) => item.link.href),
			...digest.warnings.filter((warning) => 'link' in warning).map((warning) => warning.link.href)
		];
		expect(links.length).toBeGreaterThan(0);
		for (const href of links) {
			expect(href.startsWith('/app/')).toBe(true);
		}
	});
});
