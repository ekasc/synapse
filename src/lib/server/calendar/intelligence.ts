export type CalendarEvent = {
	id: string;
	courseCode: string;
	title: string;
	type: string;
	date: number;
	month: number;
	year: number;
	time: string | null;
	gradeWeight: number | null;
	status: string | null;
	notes: string | null;
};

export type CourseInfo = {
	code: string;
	name: string;
	credits?: number;
};

export type CrunchPeriod = {
	startDate: string; // "MMM DD"
	endDate: string;
	events: CalendarEvent[];
	densityScore: number; // 0-1 how intense
	affectedCourses: string[];
	totalWeight: number;
};

export type GradeStake = {
	eventId: string;
	title: string;
	courseCode: string;
	weight: number;
	currentGrade: number | null;
	impactPerPoint: number; // how many final % points each exam point changes
};

export type StudyGap = {
	courseCode: string;
	lastEventDate: string | null;
	nextEventDate: string | null;
	gapDays: number;
	suggestion: string;
};

export type CalendarIntelligence = {
	crunchPeriods: CrunchPeriod[];
	gradeStakes: GradeStake[];
	studyGaps: StudyGap[];
	totalUpcomingWeight: number;
	atRiskCount: number;
	fullContext: string; // human-readable summary for AI prompts
};

/**
 * Analyze a set of calendar events and return intelligence data.
 * This is the primary API for AI features (digest, practice, brief) to
 * understand what's happening in a student's schedule.
 */
export function analyzeCalendar(
	events: CalendarEvent[],
	courses: CourseInfo[],
	currentGrades: Record<string, number> = {}
): CalendarIntelligence {
	const now = new Date();
	const today = now.getDate();
	const thisMonth = now.getMonth();
	const thisYear = now.getFullYear();

	// ── Upcoming events (today and forward) ──
	const upcoming = events.filter((e) => {
		if (e.year > thisYear) return true;
		if (e.year < thisYear) return false;
		if (e.month > thisMonth) return true;
		if (e.month < thisMonth) return false;
		return e.date >= today;
	}).sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.date - b.date));

	// ── Crunch detection ──
	const crunchPeriods: CrunchPeriod[] = [];
	for (let i = 0; i < upcoming.length - 1; i++) {
		const current = upcoming[i];
		const next = upcoming[i + 1];
		const currentDate = new Date(current.year, current.month, current.date);
		const nextDate = new Date(next.year, next.month, next.date);
		const daysDiff = (nextDate.getTime() - currentDate.getTime()) / 86400000;

		if (daysDiff <= 3 && daysDiff >= 0) {
			const existingCrunch = crunchPeriods.find((c) => {
				const cEnd = new Date(c.endDate);
				const diff = (currentDate.getTime() - cEnd.getTime()) / 86400000;
				return diff <= 3;
			});

			const fmtDate = (d: number, m: number) => {
				const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
				return `${months[m]} ${d}`;
			};

			if (existingCrunch) {
				existingCrunch.events.push(current);
				existingCrunch.endDate = fmtDate(next.date, next.month);
				existingCrunch.events.push(next);
				// deduplicate
				existingCrunch.events = [...new Map(existingCrunch.events.map(e => [e.id, e])).values()];
			} else {
				crunchPeriods.push({
					startDate: fmtDate(current.date, current.month),
					endDate: fmtDate(next.date, next.month),
					events: [current, next],
					densityScore: Math.min(1, 3 / (daysDiff + 1)),
					affectedCourses: [...new Set([current.courseCode, next.courseCode])],
					totalWeight: (current.gradeWeight ?? 0) + (next.gradeWeight ?? 0),
				});
			}
		}
	}

	// Fix density scores and unique affected courses
	for (const cp of crunchPeriods) {
		cp.affectedCourses = [...new Set(cp.affectedCourses)];
		cp.totalWeight = cp.events.reduce((sum, e) => sum + (e.gradeWeight ?? 0), 0);
	}

	// ── Grade stakes ──
	const gradeStakes: GradeStake[] = upcoming
		.filter((e) => e.gradeWeight && e.gradeWeight > 0)
		.map((e) => ({
			eventId: e.id,
			title: e.title,
			courseCode: e.courseCode,
			weight: e.gradeWeight!,
			currentGrade: currentGrades[e.courseCode] ?? null,
			impactPerPoint: e.gradeWeight! / 100,
		}));

	// ── Study gaps ──
	const studyGaps: StudyGap[] = [];
	const courseMap = new Map<string, CalendarEvent[]>();
	for (const e of upcoming) {
		if (!courseMap.has(e.courseCode)) courseMap.set(e.courseCode, []);
		courseMap.get(e.courseCode)!.push(e);
	}

	for (const [code, courseEvents] of courseMap) {
		const course = courses.find((c) => c.code === code);
		for (let i = 0; i < courseEvents.length; i++) {
			const current = courseEvents[i];
			const prev = i > 0 ? courseEvents[i - 1] : null;
			const gapDays = prev
				? Math.round((new Date(current.year, current.month, current.date).getTime() -
					new Date(prev.year, prev.month, prev.date).getTime()) / 86400000)
				: Math.round((new Date(current.year, current.month, current.date).getTime() - Date.now()) / 86400000);

			if (gapDays > 7) {
				const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
				studyGaps.push({
					courseCode: code,
					lastEventDate: prev ? `${months[prev.month]} ${prev.date}` : '—',
					nextEventDate: `${months[current.month]} ${current.date}`,
					gapDays,
					suggestion: gapDays > 14
						? `Long gap before ${current.title}. Consider light review sessions.`
						: `${gapDays} days before ${current.title}. Plan study blocks.`,
				});
			}
		}
	}

	// ── At-risk count ──
	const atRiskCount = events.filter((e) => e.status === 'at_risk').length;

	// ── Total upcoming weight ──
	const totalUpcomingWeight = gradeStakes.reduce((sum, g) => sum + g.weight, 0);

	// ── Full context string (for AI prompts) ──
	const fmt = (d: number, m: number) => {
		const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		return `${months[m]} ${d}`;
	};

	let context = `## Calendar Intelligence\n\n`;
	context += `- ${upcoming.length} upcoming events\n`;
	context += `- ${gradeStakes.length} graded events totaling ${totalUpcomingWeight}% of final grades\n`;
	context += `- ${crunchPeriods.length} crunch period(s) detected\n`;
	context += `- ${atRiskCount} at-risk event(s)\n\n`;

	if (crunchPeriods.length > 0) {
		context += `### Crunch Periods\n`;
		for (const cp of crunchPeriods) {
			context += `- **${cp.startDate}–${cp.endDate}**: ${cp.events.length} events across ${cp.affectedCourses.join(', ')} (${cp.totalWeight}% of grade)\n`;
		}
		context += '\n';
	}

	if (gradeStakes.length > 0) {
		context += `### Grade Stakes\n`;
		for (const gs of gradeStakes.slice(0, 5)) {
			const gradeInfo = gs.currentGrade !== null
				? ` | Current: ${gs.currentGrade}%`
				: '';
			context += `- **${gs.title}** (${gs.courseCode}): ${gs.weight}%${gradeInfo}\n`;
		}
		context += '\n';
	}

	if (studyGaps.length > 0) {
		context += `### Study Gaps\n`;
		for (const sg of studyGaps.slice(0, 5)) {
			context += `- ${sg.courseCode}: ${sg.suggestion}\n`;
		}
		context += '\n';
	}

	context += `### Upcoming Events\n`;
	for (const e of upcoming.slice(0, 10)) {
		const weight = e.gradeWeight ? ` (${e.gradeWeight}%)` : '';
		context += `- ${fmt(e.date, e.month)}: **${e.title}** — ${e.courseCode}${weight}\n`;
	}

	return {
		crunchPeriods,
		gradeStakes,
		studyGaps,
		totalUpcomingWeight,
		atRiskCount,
		fullContext: context,
	};
}
