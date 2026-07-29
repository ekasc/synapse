import { describe, expect, it } from 'vitest';
import { analyzeCalendar, type CalendarEvent, type CourseInfo } from './intelligence';

// ── Helpers ──

function evt(overrides?: Partial<CalendarEvent>): CalendarEvent {
	return {
		id: 'e1',
		courseCode: 'CS101',
		title: 'Midterm Exam',
		type: 'exam',
		date: 15,
		month: 5, // June (0-indexed)
		year: 2025,
		time: '10:00',
		gradeWeight: 20,
		status: null,
		notes: null,
		...overrides
	};
}

function course(code: string, name = 'Introduction', credits = 3): CourseInfo {
	return { code, name, credits };
}

const CLOCK = () => new Date(2025, 5, 15); // June 15, 2025

describe('analyzeCalendar', () => {
	// ── 1. Empty input ──

	it('returns empty data for empty inputs', () => {
		const result = analyzeCalendar([], [], {}, CLOCK);

		expect(result.crunchPeriods).toEqual([]);
		expect(result.gradeStakes).toEqual([]);
		expect(result.studyGaps).toEqual([]);
		expect(result.totalUpcomingWeight).toBe(0);
		expect(result.atRiskCount).toBe(0);
		expect(result.fullContext).toContain('0 upcoming events');
		expect(result.fullContext).toContain('0 graded events totaling 0% of final grades');
		expect(result.fullContext).toContain('0 crunch period(s) detected');
		expect(result.fullContext).toContain('0 at-risk event(s)');
	});

	// ── 2. Upcoming filtering ──

	describe('upcoming filtering', () => {
		it('excludes events with a date before the clock date in the same month', () => {
			const before = evt({ id: 'before', date: 14, gradeWeight: 10 });
			const on = evt({ id: 'on', date: 15, gradeWeight: 10 });
			const after = evt({ id: 'after', date: 16, gradeWeight: 10 });

			const result = analyzeCalendar([before, on, after], [], {}, CLOCK);

			const ids = result.gradeStakes.map((g) => g.eventId).sort();
			expect(ids).toEqual(['after', 'on']);
			expect(result.totalUpcomingWeight).toBe(20);
		});

		it('excludes events in months before the clock month of the same year', () => {
			const april = evt({ id: 'april', month: 3, date: 20, gradeWeight: 10 });
			const june = evt({ id: 'june', month: 5, date: 20, gradeWeight: 10 });
			const july = evt({ id: 'july', month: 6, date: 1, gradeWeight: 10 });

			const result = analyzeCalendar([april, june, july], [], {}, CLOCK);

			const ids = result.gradeStakes.map((g) => g.eventId).sort();
			expect(ids).toEqual(['july', 'june']);
		});

		it('excludes past years and includes future years', () => {
			const pastYear = evt({ id: 'past', year: 2024, month: 11, date: 31, gradeWeight: 10 });
			const futureYear = evt({ id: 'future', year: 2026, month: 0, date: 1, gradeWeight: 10 });

			const result = analyzeCalendar([pastYear, futureYear], [], {}, CLOCK);

			expect(result.gradeStakes).toHaveLength(1);
			expect(result.gradeStakes[0].eventId).toBe('future');
		});

		it('sorts upcoming events by year, month, then date', () => {
			const e1 = evt({ id: 'e1', year: 2025, month: 5, date: 16, courseCode: 'FIRST' });
			const e2 = evt({ id: 'e2', year: 2026, month: 0, date: 10, courseCode: 'THIRD' });
			const e3 = evt({ id: 'e3', year: 2025, month: 6, date: 1, courseCode: 'SECOND' });

			const result = analyzeCalendar([e2, e3, e1], [], {}, CLOCK);

			// Sorted order: e1 (Jun 16 2025), e3 (Jul 1 2025), e2 (Jan 10 2026)
			// Verify via the map of graded events (gradeStakes), which preserves order
			const codes = result.gradeStakes.map((g) => g.courseCode);
			expect(codes).toEqual(['FIRST', 'SECOND', 'THIRD']);
		});
	});

	// ── 3. Crunch detection ──

	describe('crunch detection', () => {
		it('detects a crunch period when two events are within 3 days', () => {
			const a = evt({ id: 'a', date: 15, gradeWeight: 20 });
			const b = evt({ id: 'b', date: 18, gradeWeight: 10 }); // 3 days apart

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.crunchPeriods).toHaveLength(1);
			expect(result.crunchPeriods[0]).toMatchObject({
				startDate: 'Jun 15',
				endDate: 'Jun 18',
				events: expect.arrayContaining([a, b]),
				densityScore: 0.75, // Math.min(1, 3 / (3 + 1))
				affectedCourses: ['CS101'],
				totalWeight: 30
			});
			expect(result.crunchPeriods[0].events).toHaveLength(2);
		});

		it('does not detect a crunch when events are more than 3 days apart', () => {
			const a = evt({ id: 'a', date: 10 });
			const b = evt({ id: 'b', date: 15 }); // 5 days apart

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.crunchPeriods).toHaveLength(0);
		});

		it('computes densityScore as 1 when events are on the same day', () => {
			const a = evt({ id: 'a', date: 16 });
			const b = evt({ id: 'b', date: 16 });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.crunchPeriods).toHaveLength(1);
			expect(result.crunchPeriods[0].densityScore).toBe(1); // Math.min(1, 3 / (0 + 1))
		});

		it('computed densityScore is 1 when events are 1 day apart', () => {
			const a = evt({ id: 'a', date: 15 });
			const b = evt({ id: 'b', date: 16 });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.crunchPeriods).toHaveLength(1);
			// densityScore = Math.min(1, 3 / (1 + 1)) = Math.min(1, 1.5) = 1
			expect(result.crunchPeriods[0].densityScore).toBe(1);
		});

		it('collects unique affected courses', () => {
			const a = evt({ id: 'a', date: 15, courseCode: 'CS101' });
			const b = evt({ id: 'b', date: 17, courseCode: 'CS101' });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.crunchPeriods[0].affectedCourses).toEqual(['CS101']);
		});

		it('lists distinct courses when events span multiple courses', () => {
			const a = evt({ id: 'a', date: 15, courseCode: 'MATH200' });
			const b = evt({ id: 'b', date: 17, courseCode: 'ENG101' });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.crunchPeriods[0].affectedCourses.sort()).toEqual(['ENG101', 'MATH200']);
		});

		it('only considers upcoming events for crunch detection', () => {
			const past = evt({ id: 'past', date: 13 }); // before clock (Jun 15)
			const now = evt({ id: 'now', date: 15 }); // on the clock date
			const future = evt({ id: 'future', date: 17 }); // 2 days after

			const result = analyzeCalendar([past, now, future], [], {}, CLOCK);

			// past is excluded; now-future diff = 2 days → crunch
			expect(result.crunchPeriods).toHaveLength(1);
			expect(result.crunchPeriods[0].events.map((e) => e.id).sort()).toEqual(['future', 'now']);
		});
	});

	// ── 4. Crunch merging ──

	describe('crunch merging', () => {
		it('creates one crunch period per adjacent pair when three events are consecutive', () => {
			// NOTE: The existing-crunch merge check uses new Date(c.endDate) where
			// endDate is "Jun 16" (no year), which parses as 2001.  The current date
			// from event data uses the actual year (2025), so the diff is ~8766 days
			// and the merge never matches.  As a result each adjacent pair within
			// 3 days produces its own crunch period rather than merging.
			const a = evt({ id: 'a', date: 15, courseCode: 'CS101', gradeWeight: 10 });
			const b = evt({ id: 'b', date: 16, courseCode: 'CS101', gradeWeight: 10 });
			const c = evt({ id: 'c', date: 17, courseCode: 'CS101', gradeWeight: 10 });

			const result = analyzeCalendar([a, b, c], [], {}, CLOCK);

			// a-b crunch + b-c crunch = 2 separate crunch periods
			expect(result.crunchPeriods).toHaveLength(2);
			expect(result.crunchPeriods[0].startDate).toBe('Jun 15');
			expect(result.crunchPeriods[0].endDate).toBe('Jun 16');
			expect(result.crunchPeriods[1].startDate).toBe('Jun 16');
			expect(result.crunchPeriods[1].endDate).toBe('Jun 17');
		});
	});

	// ── 5. Grade stakes ──

	describe('grade stakes', () => {
		it('includes upcoming events with a positive gradeWeight', () => {
			const e = evt({ id: 'stake', date: 20, gradeWeight: 25 });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.gradeStakes).toHaveLength(1);
			expect(result.gradeStakes[0]).toMatchObject({
				eventId: 'stake',
				title: 'Midterm Exam',
				courseCode: 'CS101',
				weight: 25,
				currentGrade: null,
				impactPerPoint: 0.25
			});
			expect(result.totalUpcomingWeight).toBe(25);
		});

		it('excludes events with a null gradeWeight', () => {
			const e = evt({ id: 'no-grade', date: 20, gradeWeight: null });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.gradeStakes).toHaveLength(0);
			expect(result.totalUpcomingWeight).toBe(0);
		});

		it('excludes events with a zero gradeWeight', () => {
			const e = evt({ id: 'zero', date: 20, gradeWeight: 0 });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.gradeStakes).toHaveLength(0);
		});

		it('populates currentGrade from the provided map', () => {
			const e = evt({ id: 's', date: 20, courseCode: 'MATH200', gradeWeight: 15 });

			const result = analyzeCalendar([e], [], { MATH200: 88 }, CLOCK);

			expect(result.gradeStakes[0].currentGrade).toBe(88);
		});

		it('leaves currentGrade as null when the course is not in the map', () => {
			const e = evt({ id: 's', date: 20, courseCode: 'PHYS300', gradeWeight: 15 });

			const result = analyzeCalendar([e], [], { MATH200: 88 }, CLOCK);

			expect(result.gradeStakes[0].currentGrade).toBeNull();
		});

		it('sums totalUpcomingWeight across all grade stakes', () => {
			const a = evt({ id: 'a', date: 16, gradeWeight: 10 });
			const b = evt({ id: 'b', date: 17, gradeWeight: 30 });
			const c = evt({ id: 'c', date: 18, gradeWeight: 5 });

			const result = analyzeCalendar([a, b, c], [], {}, CLOCK);

			expect(result.totalUpcomingWeight).toBe(45);
		});

		it('computes impactPerPoint as weight / 100', () => {
			const e = evt({ id: 's', date: 20, gradeWeight: 50 });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.gradeStakes[0].impactPerPoint).toBe(0.5);
		});
	});

	// ── 6. Study gaps ──

	describe('study gaps', () => {
		it('detects a study gap between events in the same course more than 7 days apart', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', date: 15 });
			const b = evt({ id: 'b', courseCode: 'CS101', date: 25 }); // 10 days later

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			// The gap between a (Jun 15) and b (Jun 25) = 10 days > 7 → study gap
			const csGaps = result.studyGaps.filter((g) => g.courseCode === 'CS101' && g.lastEventDate !== '—');
			expect(csGaps).toHaveLength(1);
			expect(csGaps[0]).toMatchObject({
				courseCode: 'CS101',
				lastEventDate: 'Jun 15',
				nextEventDate: 'Jun 25',
				gapDays: 10
			});
		});

		it('does not produce a gap when events are 7 or fewer days apart', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', date: 15 });
			const b = evt({ id: 'b', courseCode: 'CS101', date: 22 }); // 7 days later

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			// The event-pair gap is 7, which is not > 7 → no gap from that pair
			const csGaps = result.studyGaps.filter((g) => g.lastEventDate !== '—');
			expect(csGaps).toHaveLength(0);
		});

		it('uses the short-gap message for gaps ≤ 14 days', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', title: 'Quiz 1', date: 15 });
			const b = evt({ id: 'b', courseCode: 'CS101', title: 'Quiz 2', date: 29 }); // 14 days

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			const csGaps = result.studyGaps.filter((g) => g.lastEventDate !== '—');
			expect(csGaps).toHaveLength(1);
			expect(csGaps[0].suggestion).toContain('Plan study blocks.');
			expect(csGaps[0].suggestion).not.toContain('Long gap');
		});

		it('uses the long-gap message for gaps > 14 days', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', title: 'Midterm', date: 15 });
			const b = evt({ id: 'b', courseCode: 'CS101', title: 'Final', date: 31 }); // 16 days

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			const csGaps = result.studyGaps.filter((g) => g.lastEventDate !== '—');
			expect(csGaps).toHaveLength(1);
			expect(csGaps[0].gapDays).toBe(16);
			expect(csGaps[0].suggestion).toContain('Long gap');
			expect(csGaps[0].suggestion).toContain('Consider light review sessions.');
		});

		it('gaps are scoped per course, not across courses', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', date: 15 });
			const b = evt({ id: 'b', courseCode: 'MATH200', date: 25 }); // different course!

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			// No pair in the same course → no event-to-event gap
			const eventGaps = result.studyGaps.filter((g) => g.lastEventDate !== '—');
			expect(eventGaps).toHaveLength(0);
		});

		it('uses the injected clock for the first upcoming event in a course', () => {
			const result = analyzeCalendar([evt({ date: 25 })], [], {}, CLOCK);

			expect(result.studyGaps).toContainEqual(
				expect.objectContaining({
					courseCode: 'CS101',
					lastEventDate: '—',
					nextEventDate: 'Jun 25',
					gapDays: 10
				})
			);
		});

		it('formats the gap using correct month abbreviations', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', month: 0, date: 5 }); // Jan 5
			const b = evt({ id: 'b', courseCode: 'CS101', month: 0, date: 20 }); // Jan 20

			// Use a clock in January
			const janClock = () => new Date(2025, 0, 1);
			const result = analyzeCalendar([a, b], [], {}, janClock);

			const csGaps = result.studyGaps.filter((g) => g.lastEventDate !== '—');
			expect(csGaps).toHaveLength(1);
			expect(csGaps[0].lastEventDate).toBe('Jan 5');
			expect(csGaps[0].nextEventDate).toBe('Jan 20');
		});
	});

	// ── 7. At-risk count ──

	describe('at-risk count', () => {
		it('counts events with status at_risk', () => {
			const atRisk = evt({ id: 'r1', status: 'at_risk' });
			const atRisk2 = evt({ id: 'r2', status: 'at_risk' });
			const normal = evt({ id: 'ok', status: 'pending' });

			const result = analyzeCalendar([atRisk, atRisk2, normal], [], {}, CLOCK);

			expect(result.atRiskCount).toBe(2);
		});

		it('returns 0 when no events have at_risk status', () => {
			const a = evt({ id: 'a', status: 'pending' });
			const b = evt({ id: 'b', status: 'completed' });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.atRiskCount).toBe(0);
		});

		it('counts at-risk events regardless of whether they are upcoming', () => {
			// Past event with at_risk status should still be counted
			const pastAtRisk = evt({ id: 'past', date: 10, status: 'at_risk' });
			const upcomingOk = evt({ id: 'up', date: 20, status: 'pending' });

			const result = analyzeCalendar([pastAtRisk, upcomingOk], [], {}, CLOCK);

			expect(result.atRiskCount).toBe(1);
		});

		it('returns 0 for events with null status', () => {
			const e = evt({ id: 'e', status: null });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.atRiskCount).toBe(0);
		});
	});

	// ── 8. fullContext ──

	describe('fullContext', () => {
		it('opens with the Calendar Intelligence heading', () => {
			const result = analyzeCalendar([], [], {}, CLOCK);

			expect(result.fullContext).toMatch(/^## Calendar Intelligence/);
		});

		it('includes the summary line with upcoming event count', () => {
			const e = evt({ id: 'e', date: 20, gradeWeight: 10 });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.fullContext).toContain('- 1 upcoming events');
			expect(result.fullContext).toContain('- 1 graded events totaling 10% of final grades');
		});

		it('includes crunch period details when crunches exist', () => {
			const a = evt({ id: 'a', date: 15, courseCode: 'CS101', gradeWeight: 20 });
			const b = evt({ id: 'b', date: 17, courseCode: 'CS101', gradeWeight: 10 });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.fullContext).toContain('### Crunch Periods');
			expect(result.fullContext).toContain('**Jun 15–Jun 17**');
			expect(result.fullContext).toContain('CS101');
			expect(result.fullContext).toContain('30% of grade');
		});

		it('includes grade stakes section with current grade info when available', () => {
			const e = evt({ id: 's', date: 20, title: 'Final Exam', courseCode: 'PHYS300', gradeWeight: 40 });

			const result = analyzeCalendar([e], [], { PHYS300: 92 }, CLOCK);

			expect(result.fullContext).toContain('### Grade Stakes');
			expect(result.fullContext).toContain('**Final Exam** (PHYS300): 40%');
			expect(result.fullContext).toContain('Current: 92%');
		});

		it('does not show current grade in context when grade is unavailable', () => {
			const e = evt({ id: 's', date: 20, title: 'Quiz', courseCode: 'BIO101', gradeWeight: 10 });

			const result = analyzeCalendar([e], [], {}, CLOCK);

			expect(result.fullContext).toContain('### Grade Stakes');
			expect(result.fullContext).not.toContain('Current:');
		});

		it('includes the study gaps section when gaps exist', () => {
			const a = evt({ id: 'a', courseCode: 'CS101', date: 15 });
			const b = evt({ id: 'b', courseCode: 'CS101', date: 30 });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.fullContext).toContain('### Study Gaps');
			expect(result.fullContext).toContain('CS101');
		});

		it('includes the upcoming events list with weight annotations', () => {
			const a = evt({ id: 'a', date: 16, title: 'Homework', courseCode: 'CS101', gradeWeight: 5 });
			const b = evt({ id: 'b', date: 20, title: 'Reading', courseCode: 'CS101', gradeWeight: null });

			const result = analyzeCalendar([a, b], [], {}, CLOCK);

			expect(result.fullContext).toContain('### Upcoming Events');
			expect(result.fullContext).toContain('**Homework** — CS101 (5%)');
			expect(result.fullContext).toContain('**Reading** — CS101');
			// Reading should not show a weight percentage
			const readingLine = result.fullContext
				.split('\n')
				.find((l) => l.includes('Reading'));
			expect(readingLine).not.toContain('%)');
		});

		it('limits grade stakes and study gaps to 5 entries each in context', () => {
			const events: CalendarEvent[] = [];
			for (let i = 0; i < 8; i++) {
				events.push(evt({ id: `e${i}`, date: 16 + i * 10, gradeWeight: 10, courseCode: `C${i}` }));
			}

			const result = analyzeCalendar(events, [], {}, CLOCK);

			// fullContext should only mention at most 5 grade stakes
			const stakesSection = result.fullContext.split('### Grade Stakes')[1]?.split('###')[0] ?? '';
			const stakeLines = stakesSection.split('\n').filter((l) => l.startsWith('- '));
			expect(stakeLines.length).toBeLessThanOrEqual(5);

			// and at most 5 study gaps
			const gapsSection = result.fullContext.split('### Study Gaps')[1]?.split('###')[0] ?? '';
			const gapLines = gapsSection.split('\n').filter((l) => l.startsWith('- '));
			expect(gapLines.length).toBeLessThanOrEqual(5);
		});

		it('limits upcoming events to 10 entries in context', () => {
			const events: CalendarEvent[] = [];
			for (let i = 0; i < 15; i++) {
				events.push(evt({ id: `e${i}`, date: 16 + i }));
			}

			const result = analyzeCalendar(events, [], {}, CLOCK);

			const upcomingSection = result.fullContext.split('### Upcoming Events')[1] ?? '';
			const upcomingLines = upcomingSection.split('\n').filter((l) => l.startsWith('- '));
			expect(upcomingLines.length).toBeLessThanOrEqual(10);
		});

		it('does not include crunch/grade/gap sections when they are empty', () => {
			const result = analyzeCalendar([], [], {}, CLOCK);

			expect(result.fullContext).not.toContain('### Crunch Periods');
			expect(result.fullContext).not.toContain('### Grade Stakes');
			expect(result.fullContext).not.toContain('### Study Gaps');
		});
	});

	// ── 9. Determinism ──

	it('produces identical output for identical inputs (regression)', () => {
		const events: CalendarEvent[] = [
			evt({ id: 'a', courseCode: 'CS101', date: 15, gradeWeight: 15 }),
			evt({ id: 'b', courseCode: 'CS101', date: 17, gradeWeight: 5 }),
			evt({ id: 'c', courseCode: 'MATH200', date: 16, gradeWeight: 20 }),
			evt({ id: 'd', courseCode: 'MATH200', date: 28, gradeWeight: 30, status: 'at_risk' }),
			evt({ id: 'e', courseCode: 'ENG101', date: 10, status: 'pending' }) // before clock → excluded from upcoming
		];
		const courses = [course('CS101'), course('MATH200'), course('ENG101')];
		const grades = { CS101: 85, MATH200: 78 };

		const first = analyzeCalendar(events, courses, grades, CLOCK);
		const second = analyzeCalendar(events, courses, grades, CLOCK);

		expect(second).toEqual(first);
	});

	it('produces different output when the clock advances', () => {
		const e = evt({ id: 'e', date: 16, gradeWeight: 10 });

		const jun15 = analyzeCalendar([e], [], {}, () => new Date(2025, 5, 15));
		const jun18 = analyzeCalendar([e], [], {}, () => new Date(2025, 5, 18));

		// On Jun 15 the event is upcoming (Jun 16 is in the future).
		// On Jun 18 the event is in the past and should be excluded.
		expect(jun15.gradeStakes).toHaveLength(1);
		expect(jun18.gradeStakes).toHaveLength(0);
	});
});
