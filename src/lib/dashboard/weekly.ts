import type { Course, GraphState, Semester, StudySession } from '$lib/server/store';
import type { Briefing, CalendarEventRow } from '$lib/server/db/d1';
import type { MaterialRecord } from '$lib/server/r2';
import type { PracticeSessionSummary } from '$lib/server/practice/sessions';
import type { MaterialIndexRecord } from '$lib/server/practice/material-index';
import { getAcceptedRelations, getPlanViolations } from '$lib/components/course-map/simulation';
import type { MapRelation } from '$lib/components/course-map/types';

/**
 * Weekly Planning Digest — a deterministic, pure domain engine.
 *
 * Everything below is computed only from the injected inputs and `now`.
 * No I/O, no `new Date()`, no randomness. Identical inputs + identical `now`
 * always produce identical output. Unknown values (weights, grades, study
 * activity, timestamps) stay unknown — they are never invented.
 *
 * Priority scoring model (additive; constants live in SCORE):
 *
 *   deadline candidates (events due by week end, plus overdue):
 *     urgency       overdue: 60 + min(daysOverdue, 14); otherwise max(50 - 5*daysUntil, 20)
 *     weight        round(gradeWeight * 0.3) when gradeWeight is known, else 0
 *     overlap       +5 when another deadline lands within one day
 *     no study      +8 when the course has no study session in the last 7 days
 *     paused        +4 when the course has a paused practice session
 *     unindexed     +3 when the course has a material that is not indexed
 *     prereq impact +5 when other planned courses depend on this one
 *
 *   practice candidates (paused / in-progress sessions):
 *     24 + min(daysSinceLastActivity, 10)   (unknown timestamp counts as 0)
 *
 *   material candidates (materials without a ready index):
 *     base by index status (failed 20, needs_ocr 16, too_large 14, pending/indexing/missing 12,
 *     unsupported 8) plus +5 when the owning course has a deadline inside the window
 *
 * Deterministic ordering: score descending, then due date ascending (no date last),
 * then course code ascending (no code last), then record id ascending.
 */

export type DigestLink = { href: string; label: string };

export type DigestPriority = {
	id: string;
	kind: 'deadline' | 'practice' | 'material';
	rank: number;
	score: number;
	factors: string[];
	reason: string;
	courseCode: string | null;
	title: string;
	dueDate: string | null;
	link: DigestLink;
};

export type DigestDeadline = {
	id: string;
	courseCode: string;
	courseId: string | null;
	title: string;
	type: string;
	typeLabel: string;
	dueDate: string;
	time: string | null;
	gradeWeight: number | null;
	status: string | null;
	daysUntil: number;
	overdue: boolean;
	link: DigestLink;
};

export type DigestCrunchWindow = {
	startDate: string;
	endDate: string;
	eventIds: string[];
	eventTitles: string[];
	eventCount: number;
	totalWeight: number | null;
	reason: string;
	link: DigestLink;
};

export type DigestStudyGap = {
	courseId: string;
	courseCode: string;
	lastStudyAt: string | null;
	daysSinceLastStudy: number | null;
	reason: string;
	link: DigestLink;
};

export type DigestContinuationItem = {
	id: string;
	courseId: string;
	courseCode: string;
	status: 'paused' | 'in_progress';
	questionCount: number;
	flashcardCount: number;
	topics: string[];
	updatedAt: string | null;
	daysSinceUpdate: number | null;
	reason: string;
	link: DigestLink;
};

export type DigestWarning =
	| {
			kind: 'prerequisite';
			courseCode: string;
			message: string;
			link: DigestLink;
	  }
	| {
			kind: 'material_index';
			courseCode: string | null;
			materialId: string;
			fileName: string;
			status: string;
			message: string;
			link: DigestLink;
	  }
	| {
			kind: 'briefing';
			courseCode: string;
			message: string;
			link: DigestLink;
	  }
	| {
			kind: 'invalid_date';
			courseCode: string | null;
			message: string;
	  };

export type WeeklyDigest = {
	generatedAt: string;
	weekStart: string;
	weekEnd: string;
	priorities: DigestPriority[];
	deadlines: DigestDeadline[];
	crunchWindows: DigestCrunchWindow[];
	studyGaps: DigestStudyGap[];
	continuationItems: DigestContinuationItem[];
	warnings: DigestWarning[];
};

export type WeeklyDigestInput = {
	now: Date;
	courses: Course[];
	semesters: Semester[];
	courseGraph: Pick<GraphState, 'edges'>;
	calendarEvents: CalendarEventRow[];
	practiceSessions: PracticeSessionSummary[];
	studySessions: StudySession[];
	materials: MaterialRecord[];
	materialIndexes: MaterialIndexRecord[];
	briefings: Briefing[];
};

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 6; // week covers today + 6 days (7 days total)
const RECENT_STUDY_DAYS = 6; // "this week" study activity = today back 6 days
const CRUNCH_SPAN_DAYS = 3;
const MAX_PRIORITIES = 3;

const SCORE = {
	overdueBase: 60,
	overduePerDayCap: 14,
	dueToday: 50,
	upcomingPerDay: 5,
	upcomingFloor: 20,
	weightFactor: 0.3,
	overlap: 5,
	noStudy: 8,
	pausedPractice: 4,
	unindexedMaterial: 3,
	prereqImpact: 5,
	practiceBase: 24,
	practicePerDayCap: 10,
	materialBase: {
		failed: 20,
		needs_ocr: 16,
		too_large: 14,
		pending: 12,
		indexing: 12,
		missing: 12,
		unsupported: 8
	} as Record<string, number>,
	materialDeadlineThisWeek: 5
};

const MAX_MATERIAL_WARNINGS = 12;
const MAX_BRIEFING_FINDINGS = 6;
const MAX_PREREQ_WARNINGS = 8;
const MAX_INVALID_DATE_WARNINGS = 8;

const validDate = (date: Date) => Number.isFinite(date.getTime());
const day = (year: number, month: number, date: number) => new Date(year, month, date);
const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dateKey = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
		date.getDate()
	).padStart(2, '0')}`;
const addDays = (date: Date, amount: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + amount);
	return next;
};
const diffDays = (from: Date, to: Date) =>
	Math.round((startOf(to).getTime() - startOf(from).getTime()) / DAY_MS);

const validCalendarParts = (year: number, month: number, date: number) => {
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(date) ||
		month < 0 ||
		month > 11 ||
		date < 1
	)
		return false;
	const result = day(year, month, date);
	return result.getFullYear() === year && result.getMonth() === month && result.getDate() === date;
};

const parseTimestamp = (value: unknown): Date | null => {
	const number = Date.parse(String(value ?? ''));
	return Number.isFinite(number) ? new Date(number) : null;
};

const readableEventType = (type: string) =>
	type.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const truncate = (text: string, limit: number) =>
	text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;

const compareStrings = (a: string, b: string) => a.localeCompare(b);

type DatedEvent = {
	event: CalendarEventRow;
	date: Date;
	courseId: string | null;
};

const MATERIAL_STATUS_PHRASE: Record<string, string> = {
	missing: 'has no index record yet',
	pending: 'is uploaded but not yet indexed',
	indexing: 'is still being indexed',
	failed: 'failed to index',
	needs_ocr: 'needs OCR before it can be indexed',
	too_large: 'is beyond the page limit for indexing',
	unsupported: 'is not a supported type for indexing'
};

function materialStatusPhrase(status: string, errorMessage: string | null): string {
	const base = MATERIAL_STATUS_PHRASE[status] ?? `is not indexed (status: ${status})`;
	if (status === 'failed' && errorMessage) return `${base} — ${truncate(errorMessage, 80)}`;
	return base;
}

function courseHref(course: Course | undefined): DigestLink {
	if (!course) return { href: '/app/courses', label: 'Open course map' };
	return {
		href: `/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(
			course.id
		)}`,
		label: `Open ${course.code}`
	};
}

function practiceHref(course: Course | undefined): DigestLink {
	if (!course) return { href: '/app/practice', label: 'Open practice' };
	return {
		href: `/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(
			course.id
		)}/practice`,
		label: `Practice ${course.code}`
	};
}

function toMapRelations(edges: GraphState['edges']): MapRelation[] {
	return edges.map((edge, index) => ({
		id: edge.id ?? `${edge.source}->${edge.target}#${index}`,
		source: edge.source,
		target: edge.target,
		type: edge.type ?? 'related',
		reviewStatus: edge.reviewStatus
	}));
}

export function buildWeeklyDigest(input: WeeklyDigestInput): WeeklyDigest {
	if (!(input.now instanceof Date) || !validDate(input.now)) {
		throw new Error('buildWeeklyDigest requires a valid `now` date');
	}
	const now = input.now;
	const today = startOf(now);
	const weekEnd = addDays(today, WINDOW_DAYS);
	const recentStudyStart = addDays(today, -RECENT_STUDY_DAYS);

	const courses = [...input.courses];
	const courseById = new Map(courses.map((course) => [course.id, course]));
	const courseByCode = new Map<string, Course[]>();
	for (const course of courses) {
		const key = course.code.trim().toLowerCase();
		const list = courseByCode.get(key) ?? [];
		list.push(course);
		courseByCode.set(key, list);
	}
	const semesterById = new Map(input.semesters.map((semester) => [semester.id, semester]));

	const resolveCourseId = (event: CalendarEventRow): string | null => {
		if (event.courseId) return event.courseId;
		const matches = courseByCode.get(event.courseCode.trim().toLowerCase()) ?? [];
		return matches.length === 1 ? matches[0].id : null;
	};

	// --- Calendar events: split valid/invalid, drop completed -----------------
	const invalidDateWarnings: Extract<DigestWarning, { kind: 'invalid_date' }>[] = [];
	const dated: DatedEvent[] = [];
	for (const event of input.calendarEvents) {
		if (!validCalendarParts(event.year, event.month, event.date)) {
			invalidDateWarnings.push({
				kind: 'invalid_date',
				courseCode: event.courseCode || null,
				message: `“${event.title}” (${event.courseCode || 'no course code'}) has an invalid date and was left out of this plan.`
			});
			continue;
		}
		if (event.status?.toLowerCase() === 'completed') continue;
		dated.push({
			event,
			date: day(event.year, event.month, event.date),
			courseId: resolveCourseId(event)
		});
	}
	dated.sort(
		(a, b) =>
			a.date.getTime() - b.date.getTime() ||
			compareStrings(a.event.courseCode, b.event.courseCode) ||
			compareStrings(a.event.id, b.event.id)
	);

	// Events due by the end of the week, plus everything already overdue.
	const inPlan = dated.filter((item) => item.date.getTime() <= weekEnd.getTime());
	const upcoming = inPlan.filter((item) => item.date.getTime() >= today.getTime());

	// --- Study activity per course ---------------------------------------------
	const studyByCourse = new Map<string, Date[]>();
	for (const session of input.studySessions) {
		if (!session.courseId) continue;
		const completed = parseTimestamp(session.completedAt);
		if (!completed) continue;
		const list = studyByCourse.get(session.courseId) ?? [];
		list.push(completed);
		studyByCourse.set(session.courseId, list);
	}
	const hasRecentStudy = (courseId: string) => {
		const sessions = studyByCourse.get(courseId) ?? [];
		return sessions.some(
			(completed) =>
				completed.getTime() >= recentStudyStart.getTime() && completed.getTime() <= now.getTime()
		);
	};
	const lastStudy = (courseId: string): Date | null => {
		const sessions = studyByCourse.get(courseId) ?? [];
		if (!sessions.length) return null;
		return sessions.reduce((latest, completed) =>
			completed.getTime() > latest.getTime() ? completed : latest
		);
	};

	// --- Practice / materials / graph lookups -----------------------------------
	const pausedByCourse = new Map<string, PracticeSessionSummary[]>();
	for (const session of input.practiceSessions) {
		if (session.status !== 'paused') continue;
		const list = pausedByCourse.get(session.courseId) ?? [];
		list.push(session);
		pausedByCourse.set(session.courseId, list);
	}

	const indexByMaterial = new Map(input.materialIndexes.map((index) => [index.materialId, index]));
	const materialsByCourse = new Map<
		string,
		{ material: MaterialRecord; index: MaterialIndexRecord | null }[]
	>();
	for (const material of input.materials) {
		const list = materialsByCourse.get(material.courseId) ?? [];
		list.push({ material, index: indexByMaterial.get(material.id) ?? null });
		materialsByCourse.set(material.courseId, list);
	}
	const hasUnindexedMaterial = (courseId: string) =>
		(materialsByCourse.get(courseId) ?? []).some(({ index }) => !index || index.status !== 'ready');

	const relations = getAcceptedRelations(toMapRelations(input.courseGraph.edges));
	const hasDependants = (courseId: string) =>
		relations.some((relation) => relation.source === courseId);

	const courseHasWindowEvent = (courseId: string) =>
		inPlan.some((item) => item.courseId === courseId);

	// --- Deadlines (chronological; overdue naturally sort first) ----------------
	const deadlines: DigestDeadline[] = inPlan.map(({ event, date, courseId }) => {
		const daysUntil = diffDays(date, today) * -1;
		return {
			id: event.id,
			courseCode: event.courseCode,
			courseId,
			title: event.title,
			type: event.type,
			typeLabel: readableEventType(event.type),
			dueDate: dateKey(date),
			time: event.time,
			gradeWeight: event.gradeWeight,
			status: event.status,
			daysUntil,
			overdue: daysUntil < 0,
			link: { href: '/app/calendar', label: 'Open calendar' }
		};
	});

	// --- Priority candidates -----------------------------------------------------
	type Candidate = {
		id: string;
		kind: DigestPriority['kind'];
		score: number;
		factors: string[];
		reason: string;
		courseCode: string | null;
		title: string;
		dueDate: string | null;
		link: DigestLink;
	};
	const candidates: Candidate[] = [];

	for (const item of inPlan) {
		const { event, date, courseId } = item;
		const daysUntil = diffDays(date, today) * -1;
		const overdue = daysUntil < 0;
		const course = courseId ? courseById.get(courseId) : undefined;
		const factors: string[] = [];
		let score = 0;

		if (overdue) {
			score += SCORE.overdueBase + Math.min(-daysUntil, SCORE.overduePerDayCap);
			factors.push(`overdue by ${plural(-daysUntil, 'day')}`);
		} else {
			score += Math.max(SCORE.dueToday - SCORE.upcomingPerDay * daysUntil, SCORE.upcomingFloor);
			factors.push(daysUntil === 0 ? 'due today' : `due in ${plural(daysUntil, 'day')}`);
		}

		if (event.gradeWeight != null && Number.isFinite(event.gradeWeight)) {
			score += Math.round(event.gradeWeight * SCORE.weightFactor);
			factors.push(`worth ${event.gradeWeight}% of the course grade`);
		}

		const overlaps = inPlan.some(
			(other) => other.event.id !== event.id && Math.abs(diffDays(other.date, date)) <= 1
		);
		if (overlaps) {
			score += SCORE.overlap;
			factors.push('overlaps another deadline');
		}

		if (courseId && !hasRecentStudy(courseId)) {
			score += SCORE.noStudy;
			factors.push('no study session recorded this week');
		}
		if (courseId && (pausedByCourse.get(courseId) ?? []).length > 0) {
			score += SCORE.pausedPractice;
			factors.push('practice is paused in this course');
		}
		if (courseId && hasUnindexedMaterial(courseId)) {
			score += SCORE.unindexedMaterial;
			factors.push('a course material is not indexed');
		}
		if (courseId && hasDependants(courseId)) {
			score += SCORE.prereqImpact;
			factors.push('other planned courses depend on this one');
		}

		const duePhrase = overdue
			? `was due ${plural(-daysUntil, 'day')} ago`
			: daysUntil === 0
				? 'is due today'
				: `is due in ${plural(daysUntil, 'day')}`;
		const weightPhrase =
			event.gradeWeight != null && Number.isFinite(event.gradeWeight)
				? `, worth ${event.gradeWeight}% of the course grade`
				: '';
		const studyPhrase =
			courseId && !hasRecentStudy(courseId)
				? ', and no study session has been recorded this week'
				: '';
		const reason = `Review ${event.courseCode} because ${event.title} ${duePhrase}${weightPhrase}${studyPhrase}.`;

		candidates.push({
			id: `event:${event.id}`,
			kind: 'deadline',
			score,
			factors,
			reason,
			courseCode: event.courseCode,
			title: event.title,
			dueDate: dateKey(date),
			link: course ? courseHref(course) : { href: '/app/calendar', label: 'Open calendar' }
		});
	}

	for (const session of input.practiceSessions) {
		if (session.status !== 'paused' && session.status !== 'in_progress') continue;
		const updated = parseTimestamp(session.updatedAt);
		const daysSince = updated ? diffDays(startOf(updated), today) : null;
		const daysFactor = daysSince != null && daysSince > 0 ? daysSince : 0;
		const score = SCORE.practiceBase + Math.min(daysFactor, SCORE.practicePerDayCap);
		const course = courseById.get(session.courseId);
		const factors: string[] = [
			session.status === 'paused' ? 'session is paused' : 'session is in progress'
		];
		if (daysSince != null && daysSince > 0)
			factors.push(`last activity ${plural(daysSince, 'day')} ago`);
		const topicsPhrase = session.topics.length
			? ` on ${session.topics.slice(0, 3).join(', ')}`
			: '';
		const activityPhrase =
			daysSince != null && daysSince > 0 ? `, last activity ${plural(daysSince, 'day')} ago` : '';
		const reason = `Resume ${session.courseCode} practice — ${
			session.status === 'paused' ? 'paused' : 'in progress'
		} with ${plural(session.questionCount, 'question')}${topicsPhrase}${activityPhrase}.`;
		candidates.push({
			id: `practice:${session.id}`,
			kind: 'practice',
			score,
			factors,
			reason,
			courseCode: session.courseCode,
			title: `${session.courseCode} practice session`,
			dueDate: null,
			link: practiceHref(course)
		});
	}

	for (const [courseId, entries] of materialsByCourse) {
		const course = courseById.get(courseId);
		const deadlineThisWeek = courseHasWindowEvent(courseId);
		for (const { material, index } of entries) {
			const status = index?.status ?? 'missing';
			if (status === 'ready') continue;
			const base = SCORE.materialBase[status] ?? 10;
			const score = base + (deadlineThisWeek ? SCORE.materialDeadlineThisWeek : 0);
			const factors = [`index status: ${status}`];
			if (deadlineThisWeek) factors.push('course has a deadline this week');
			const courseLabel = course?.code ?? 'an unknown course';
			const reason = `${material.fileName} for ${courseLabel} ${materialStatusPhrase(
				status,
				index?.errorMessage ?? null
			)}${deadlineThisWeek ? ', and the course has a deadline this week' : ''}.`;
			candidates.push({
				id: `material:${material.id}`,
				kind: 'material',
				score,
				factors,
				reason,
				courseCode: course?.code ?? null,
				title: material.fileName,
				dueDate: null,
				link: course ? courseHref(course) : { href: '/app/courses', label: 'Open course map' }
			});
		}
	}

	candidates.sort(
		(a, b) =>
			b.score - a.score ||
			(a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') ||
			(a.courseCode ?? '\uffff').localeCompare(b.courseCode ?? '\uffff') ||
			compareStrings(a.id, b.id)
	);

	const priorities: DigestPriority[] = candidates
		.slice(0, MAX_PRIORITIES)
		.map((candidate, index) => ({ ...candidate, rank: index + 1 }));

	// --- Crunch windows -----------------------------------------------------------
	const crunchWindows: DigestCrunchWindow[] = [];
	let cursor = 0;
	while (cursor < upcoming.length) {
		const anchor = upcoming[cursor];
		let last = cursor;
		while (
			last + 1 < upcoming.length &&
			diffDays(anchor.date, upcoming[last + 1].date) <= CRUNCH_SPAN_DAYS
		)
			last += 1;
		const cluster = upcoming.slice(cursor, last + 1);
		const anyHeavy = cluster.some(
			(item) => item.event.gradeWeight != null && item.event.gradeWeight >= 25
		);
		if (cluster.length >= 3 || (cluster.length >= 2 && anyHeavy)) {
			const end = cluster[cluster.length - 1].date;
			const spanDays = diffDays(anchor.date, end) + 1;
			const knownWeights = cluster
				.map((item) => item.event.gradeWeight)
				.filter((weight): weight is number => weight != null && Number.isFinite(weight));
			const totalWeight = knownWeights.length
				? knownWeights.reduce((sum, weight) => sum + weight, 0)
				: null;
			const weightPhrase = totalWeight != null ? `, known grade weights total ${totalWeight}%` : '';
			crunchWindows.push({
				startDate: dateKey(anchor.date),
				endDate: dateKey(end),
				eventIds: cluster.map((item) => item.event.id),
				eventTitles: cluster.map((item) => `${item.event.courseCode} — ${item.event.title}`),
				eventCount: cluster.length,
				totalWeight,
				reason: `${plural(cluster.length, 'deadline')} land within ${plural(spanDays, 'day')}${weightPhrase}.`,
				link: { href: '/app/calendar', label: 'Open calendar' }
			});
			cursor = last + 1;
		} else {
			cursor += 1;
		}
	}
	// --- Study gaps -----------------------------------------------------------------
	const studyGaps: DigestStudyGap[] = [];
	for (const course of courses) {
		if (course.signals?.status === 'completed') continue;
		const isActive = course.signals?.status === 'active';
		const hasPlanEvent = inPlan.some((item) => item.courseId === course.id);
		if (!isActive && !hasPlanEvent) continue;
		if (hasRecentStudy(course.id)) continue;
		const last = lastStudy(course.id);
		const daysSince = last ? diffDays(startOf(last), today) : null;
		const related =
			upcoming.find((item) => item.courseId === course.id) ??
			inPlan.find((item) => item.courseId === course.id && item.date.getTime() < today.getTime());
		const lastPhrase = last
			? `last session was ${plural(daysSince ?? 0, 'day')} ago`
			: 'no study sessions on record';
		let eventPhrase = '';
		if (related) {
			const behind = diffDays(related.date, today);
			eventPhrase =
				behind > 0
					? `; ${related.event.title} was due ${plural(behind, 'day')} ago`
					: behind === 0
						? `; ${related.event.title} is due today`
						: `; ${related.event.title} is due in ${plural(-behind, 'day')}`;
		}
		studyGaps.push({
			courseId: course.id,
			courseCode: course.code,
			lastStudyAt: last ? last.toISOString() : null,
			daysSinceLastStudy: daysSince,
			reason: `No study session recorded this week; ${lastPhrase}${eventPhrase}.`,
			link: { href: '/app/timer', label: 'Log study time' }
		});
	}
	studyGaps.sort(
		(a, b) => compareStrings(a.courseCode, b.courseCode) || compareStrings(a.courseId, b.courseId)
	);

	// --- Continuation items (paused / in-progress practice) ---------------------------
	const continuationItems: DigestContinuationItem[] = input.practiceSessions
		.filter(
			(session): session is PracticeSessionSummary & { status: 'paused' | 'in_progress' } =>
				session.status === 'paused' || session.status === 'in_progress'
		)
		.map((session) => {
			const updated = parseTimestamp(session.updatedAt);
			const daysSince = updated ? diffDays(startOf(updated), today) : null;
			const course = courseById.get(session.courseId);
			const topicsPhrase = session.topics.length
				? ` on ${session.topics.slice(0, 3).join(', ')}`
				: '';
			const activityPhrase =
				daysSince != null && daysSince > 0 ? `, last activity ${plural(daysSince, 'day')} ago` : '';
			return {
				id: session.id,
				courseId: session.courseId,
				courseCode: session.courseCode,
				status: session.status,
				questionCount: session.questionCount,
				flashcardCount: session.flashcardCount,
				topics: session.topics,
				updatedAt: updated ? updated.toISOString() : null,
				daysSinceUpdate: daysSince,
				reason: `${session.status === 'paused' ? 'Paused' : 'In progress'} with ${plural(
					session.questionCount,
					'question'
				)}${topicsPhrase}${activityPhrase}.`,
				link: practiceHref(course)
			};
		})
		.sort(
			(a, b) =>
				(a.daysSinceUpdate ?? Number.MAX_SAFE_INTEGER) -
					(b.daysSinceUpdate ?? Number.MAX_SAFE_INTEGER) || compareStrings(a.id, b.id)
		);
	// --- Warnings ----------------------------------------------------------------------
	type PrerequisiteWarning = Extract<DigestWarning, { kind: 'prerequisite' }>;
	type MaterialWarning = Extract<DigestWarning, { kind: 'material_index' }>;
	type BriefingFinding = Extract<DigestWarning, { kind: 'briefing' }>;
	type InvalidDateWarning = Extract<DigestWarning, { kind: 'invalid_date' }>;

	const prereqWarnings: PrerequisiteWarning[] = [];
	const violations = getPlanViolations(
		courses.map((course) => ({
			id: course.id,
			semesterId: course.semesterId,
			code: course.code,
			name: course.name
		})),
		input.semesters.map((semester) => ({
			id: semester.id,
			term: semester.term,
			year: semester.year,
			order: semester.order
		})),
		relations
	);
	const termLabel = (semester: Semester | undefined) =>
		semester ? `${semester.term} ${semester.year}` : 'a known term';
	for (const violation of violations) {
		const dependent = courseById.get(violation.courseId);
		const prerequisite = courseById.get(violation.prerequisiteCourseId);
		const dependentSemester = dependent ? semesterById.get(dependent.semesterId) : undefined;
		const prereqSemester = prerequisite ? semesterById.get(prerequisite.semesterId) : undefined;
		const dependentCode = dependent?.code ?? 'A course';
		const prereqCode = prerequisite?.code ?? violation.prerequisiteCourseId;
		let message: string;
		if (violation.reason === 'prerequisite-scheduled-later') {
			message = `${dependentCode} is planned for ${termLabel(dependentSemester)}, before its prerequisite ${prereqCode} (${termLabel(prereqSemester)}).`;
		} else if (violation.reason === 'same-semester') {
			message = `${dependentCode} and its prerequisite ${prereqCode} are planned in the same term (${termLabel(dependentSemester)}).`;
		} else if (violation.reason === 'unplaced-prerequisite') {
			message = `${prereqCode} (needed by ${dependentCode}) is not placed in a known term.`;
		} else if (violation.reason === 'missing-course') {
			message = `${dependentCode} has a prerequisite relation pointing to a course that is missing from the plan.`;
		} else {
			message = `${dependentCode} cannot be checked against its prerequisites because its term is unknown.`;
		}
		prereqWarnings.push({
			kind: 'prerequisite',
			courseCode: dependent?.code ?? prerequisite?.code ?? '',
			message,
			link: { href: '/app/courses', label: 'Open course map' }
		});
	}
	prereqWarnings.sort(
		(a, b) => compareStrings(a.courseCode, b.courseCode) || compareStrings(a.message, b.message)
	);

	const materialWarnings: MaterialWarning[] = [];
	for (const [courseId, entries] of materialsByCourse) {
		const course = courseById.get(courseId);
		for (const { material, index } of entries) {
			const status = index?.status ?? 'missing';
			if (status === 'ready') continue;
			materialWarnings.push({
				kind: 'material_index',
				courseCode: course?.code ?? null,
				materialId: material.id,
				fileName: material.fileName,
				status,
				message: `${material.fileName} for ${course?.code ?? 'an unknown course'} ${materialStatusPhrase(
					status,
					index?.errorMessage ?? null
				)}.`,
				link: course ? courseHref(course) : { href: '/app/courses', label: 'Open course map' }
			});
		}
	}
	materialWarnings.sort(
		(a, b) =>
			(a.courseCode === null ? 1 : 0) - (b.courseCode === null ? 1 : 0) ||
			compareStrings(a.courseCode ?? '', b.courseCode ?? '') ||
			compareStrings(a.fileName, b.fileName) ||
			compareStrings(a.materialId, b.materialId)
	);
	const briefingFindings: BriefingFinding[] = [];
	const briefingByCode = new Map<string, Briefing>();
	for (const brief of input.briefings) {
		const key = brief.code.trim().toLowerCase();
		if (!briefingByCode.has(key)) briefingByCode.set(key, brief);
	}
	const relevantCourseIds = new Set<string>([
		...inPlan.map((item) => item.courseId).filter((id): id is string => id != null),
		...studyGaps.map((gap) => gap.courseId)
	]);
	for (const course of courses) {
		if (!relevantCourseIds.has(course.id)) continue;
		const brief = briefingByCode.get(course.code.trim().toLowerCase());
		if (!brief) continue;
		const link: DigestLink = {
			href: `/app/brief/${encodeURIComponent(brief.code)}`,
			label: `Open ${brief.code} brief`
		};
		const weeklyHours = brief.weeklyHours?.trim() ?? '';
		const workloadText = weeklyHours
			? `expect about ${weeklyHours} of work per week`
			: brief.workload.trim()
				? `workload is described as ${truncate(brief.workload.trim(), 80)}`
				: '';
		if (workloadText)
			briefingFindings.push({
				kind: 'briefing',
				courseCode: course.code,
				message: `${course.code} brief: ${workloadText}.`,
				link
			});
		for (const contradiction of (brief.contradictions ?? []).slice(0, 2)) {
			briefingFindings.push({
				kind: 'briefing',
				courseCode: course.code,
				message: `${course.code} brief flags a contradiction: “${truncate(contradiction, 120)}”.`,
				link
			});
		}
		const missing = (brief.missingEvidence ?? [])[0];
		if (missing)
			briefingFindings.push({
				kind: 'briefing',
				courseCode: course.code,
				message: `${course.code} brief notes missing evidence: “${truncate(missing, 120)}”.`,
				link
			});
	}
	briefingFindings.sort(
		(a, b) => compareStrings(a.courseCode, b.courseCode) || compareStrings(a.message, b.message)
	);

	const sortedInvalidDates: InvalidDateWarning[] = [...invalidDateWarnings].sort(
		(a, b) =>
			(a.courseCode === null ? 1 : 0) - (b.courseCode === null ? 1 : 0) ||
			compareStrings(a.courseCode ?? '', b.courseCode ?? '') ||
			compareStrings(a.message, b.message)
	);

	const warnings: DigestWarning[] = [
		...prereqWarnings.slice(0, MAX_PREREQ_WARNINGS),
		...materialWarnings.slice(0, MAX_MATERIAL_WARNINGS),
		...briefingFindings.slice(0, MAX_BRIEFING_FINDINGS),
		...sortedInvalidDates.slice(0, MAX_INVALID_DATE_WARNINGS)
	];

	return {
		generatedAt: now.toISOString(),
		weekStart: dateKey(today),
		weekEnd: dateKey(weekEnd),
		priorities,
		deadlines,
		crunchWindows,
		studyGaps,
		continuationItems,
		warnings
	};
}
