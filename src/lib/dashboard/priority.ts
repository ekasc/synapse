import type { Course, Semester } from '$lib/server/store';
import type { Briefing, CalendarEventRow } from '$lib/server/db/d1';
import type { MaterialRecord } from '$lib/server/r2';
import type { PracticeSessionSummary } from '$lib/server/practice/sessions';

export type PriorityTone = 'critical' | 'warning' | 'neutral';
export type PriorityItem = {
	id: string;
	kind: string;
	title: string;
	courseCode?: string;
	eyebrow: string;
	reason: string;
	dateLabel?: string;
	tone: PriorityTone;
	href: string;
	actionLabel: string;
};
export type AgendaDay = { date: string; dateLabel: string; items: PriorityItem[] };
export type PrioritySummary = { urgentCount: number; upcomingCount: number; sentence: string };
export type TermRelation = 'current' | 'next' | 'latest';
export type TermContext = { semester: Semester; relation: TermRelation };
export type PriorityDashboard = {
	currentTermLabel: string | null;
	termContextLabel: 'Current term' | 'Next term' | 'Latest term' | null;
	summary: PrioritySummary;
	attentionItems: PriorityItem[];
	agendaDays: AgendaDay[];
	continueItems: PriorityItem[];
};
export type PriorityInput = {
	now: Date;
	semesters: Semester[];
	courses: Course[];
	events: CalendarEventRow[];
	practice: PracticeSessionSummary[];
	briefs: Briefing[];
	materials: MaterialRecord[];
};

const validDate = (date: Date) => Number.isFinite(date.getTime());
const day = (year: number, month: number, date: number) => new Date(year, month, date);
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
const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const dateKey = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const label = (date: Date) =>
	date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const readableEventType = (type: string) =>
	type.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const timestamp = (value: unknown) => {
	const number = Date.parse(String(value ?? ''));
	return Number.isFinite(number) ? number : 0;
};

const termStartMonth = (term: string) => {
	const lower = term.toLowerCase();
	if (lower.includes('winter')) return 0;
	if (lower.includes('spring')) return 4;
	if (lower.includes('summer')) return 6;
	if (lower.includes('fall') || lower.includes('autumn')) return 8;
	return null;
};

export function resolveTermContext(now: Date, semesters: Semester[]): TermContext | null {
	const year = now.getFullYear();
	const month = now.getMonth();
	const current = semesters
		.filter((semester) => {
			if (semester.year !== year) return false;
			const start = termStartMonth(semester.term);
			if (start === null) return false;
			const end = start === 0 ? 3 : start === 4 ? 5 : start === 6 ? 7 : 11;
			return month >= start && month <= end;
		})
		.sort((a, b) => b.order - a.order)[0];
	if (current) return { semester: current, relation: 'current' };

	const next = semesters
		.filter((semester) => {
			const start = termStartMonth(semester.term);
			return start !== null && (semester.year > year || (semester.year === year && start > month));
		})
		.sort((a, b) => {
			if (a.year !== b.year) return a.year - b.year;
			return (termStartMonth(a.term) ?? 12) - (termStartMonth(b.term) ?? 12);
		})[0];
	if (next) return { semester: next, relation: 'next' };

	const latest = semesters.slice().sort((a, b) => b.year - a.year || b.order - a.order)[0];
	return latest ? { semester: latest, relation: 'latest' } : null;
}

export function resolveCurrentTerm(now: Date, semesters: Semester[]): Semester | null {
	return resolveTermContext(now, semesters)?.semester ?? null;
}

function eventItem(event: CalendarEventRow, now: Date): PriorityItem {
	const date = day(event.year, event.month, event.date);
	const today = startOf(now);
	const overdue = date < today;
	const dueToday = dateKey(date) === dateKey(today);
	const withinAttentionWindow =
		date >= today &&
		date.getTime() - today.getTime() <= 72 * 3600000 &&
		(event.type.toLowerCase().includes('exam') || (event.gradeWeight ?? 0) >= 30);
	const eyebrow = overdue ? 'Overdue' : dueToday ? 'Due today' : readableEventType(event.type);
	const details = [
		event.time ? event.time : null,
		event.gradeWeight != null ? `${event.gradeWeight}% of grade` : null
	].filter(Boolean);
	const reason = details.join(' · ') || readableEventType(event.type);
	const tone = overdue || dueToday ? 'critical' : withinAttentionWindow ? 'warning' : 'neutral';
	return {
		id: `event:${event.id}`,
		kind: 'calendar',
		title: event.title,
		courseCode: event.courseCode,
		eyebrow,
		reason,
		dateLabel: label(date),
		tone,
		href: '/app/calendar',
		actionLabel: 'Open calendar'
	};
}

export function buildPriorityDashboard(input: PriorityInput): PriorityDashboard {
	const now = validDate(input.now) ? input.now : new Date();
	const today = startOf(now);
	const pending = input.events
		.filter((event) => event.status?.toLowerCase() !== 'completed')
		.filter((event) => validCalendarParts(event.year, event.month, event.date));
	const dated = pending
		.map((event) => ({ event, date: day(event.year, event.month, event.date) }))
		.sort((a, b) => a.date.getTime() - b.date.getTime() || a.event.id.localeCompare(b.event.id));
	const practiceHref = (courseId: string) => {
		const course = input.courses.find((item) => item.id === courseId);
		return course
			? `/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}/practice`
			: '/app/semesters';
	};
	const attention: PriorityItem[] = [];
	const seen = new Set<string>();
	const add = (event: CalendarEventRow) => {
		if (!seen.has(event.id)) {
			seen.add(event.id);
			attention.push(eventItem(event, now));
		}
	};
	dated.filter((item) => item.date < today).forEach((item) => add(item.event));
	dated.filter((item) => dateKey(item.date) === dateKey(today)).forEach((item) => add(item.event));
	input.courses
		.filter(
			(course) => course.signals?.status === 'at-risk' || course.signals?.riskLevel === 'high'
		)
		.sort((a, b) => a.code.localeCompare(b.code))
		.forEach((course) =>
			attention.push({
				id: `risk:${course.id}`,
				kind: 'course-risk',
				title: `${course.code} needs attention`,
				courseCode: course.code,
				eyebrow: 'Course risk',
				reason: 'High-risk course',
				tone: 'critical',
				href: `/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}`,
				actionLabel: 'Review course'
			})
		);
	dated
		.filter(
			(item) =>
				item.date.getTime() - today.getTime() <= 72 * 3600000 &&
				item.date >= today &&
				(item.event.type.toLowerCase().includes('exam') || (item.event.gradeWeight ?? 0) >= 30)
		)
		.forEach((item) => add(item.event));
	input.practice
		.filter((session) => session.status === 'paused')
		.sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt) || a.id.localeCompare(b.id))
		.forEach((session) =>
			attention.push({
				id: `practice:${session.id}`,
				kind: 'practice',
				title: `Continue practice for ${session.courseCode}`,
				courseCode: session.courseCode,
				eyebrow: 'Paused practice',
				reason: 'Paused practice session',
				tone: 'warning',
				href: practiceHref(session.courseId),
				actionLabel: 'Continue'
			})
		);
	const agendaDays: AgendaDay[] = [];
	for (let i = 0; i <= 7; i += 1) {
		const date = new Date(today);
		date.setDate(today.getDate() + i);
		const items = dated
			.filter((item) => dateKey(item.date) === dateKey(date))
			.map((item) => eventItem(item.event, now));
		if (items.length) agendaDays.push({ date: dateKey(date), dateLabel: label(date), items });
	}
	const candidates: PriorityItem[] = [];
	input.practice
		.filter((session) => session.status === 'in_progress' || session.status === 'paused')
		.sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt) || a.id.localeCompare(b.id))
		.forEach((session) =>
			candidates.push({
				id: `continue:${session.id}`,
				kind: 'practice',
				title: `Continue ${session.courseCode} practice`,
				courseCode: session.courseCode,
				eyebrow: 'Practice',
				reason: session.status === 'paused' ? 'Paused session' : 'In progress',
				tone: 'neutral',
				href: practiceHref(session.courseId),
				actionLabel: 'Continue'
			})
		);
	[...input.briefs]
		.sort(
			(a, b) =>
				timestamp(b.researchedAt) - timestamp(a.researchedAt) || a.code.localeCompare(b.code)
		)
		.forEach((brief) =>
			candidates.push({
				id: `brief:${brief.code}`,
				kind: 'briefing',
				title: `${brief.code} course brief`,
				courseCode: brief.code,
				eyebrow: 'Recent research',
				reason: 'Researched recently',
				tone: 'neutral',
				href: `/app/brief/${encodeURIComponent(brief.code)}`,
				actionLabel: 'Open brief'
			})
		);
	[...input.materials]
		.sort((a, b) => timestamp(b.uploadedAt) - timestamp(a.uploadedAt) || a.id.localeCompare(b.id))
		.forEach((material) => {
			const course = input.courses.find((item) => item.id === material.courseId);
			candidates.push({
				id: `material:${material.id}`,
				kind: 'material',
				title: material.fileName,
				courseCode: course?.code,
				eyebrow: 'Latest material',
				reason: 'Recently uploaded',
				tone: 'neutral',
				href: course
					? `/app/semesters/${encodeURIComponent(course.semesterId)}/courses/${encodeURIComponent(course.id)}`
					: '/app/semesters',
				actionLabel: 'Open course'
			});
		});
	const urgent = attention.filter((item) => item.tone === 'critical').length;
	const upcoming = dated.filter(
		(item) => item.date > today && item.date.getTime() - today.getTime() <= 7 * 86400000
	).length;
	const next = dated.find((item) => item.date >= today);
	const sentence = urgent
		? `${urgent} item${urgent === 1 ? '' : 's'} need attention today; ${upcoming} more this week.`
		: upcoming
			? `Nothing urgent today. Your next deadline is ${next!.date.toLocaleDateString(undefined, { weekday: 'long' })}.`
			: 'Nothing needs attention yet. You’re all caught up.';
	const termContext = resolveTermContext(now, input.semesters);
	const termContextLabel = termContext
		? termContext.relation === 'current'
			? 'Current term'
			: termContext.relation === 'next'
				? 'Next term'
				: 'Latest term'
		: null;
	return {
		currentTermLabel: termContext
			? `${termContext.semester.term} ${termContext.semester.year}`
			: null,
		termContextLabel,
		summary: { urgentCount: urgent, upcomingCount: upcoming, sentence },
		attentionItems: attention,
		agendaDays,
		continueItems: candidates.slice(0, 2)
	};
}
