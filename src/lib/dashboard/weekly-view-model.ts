import type {
	DigestDeadline,
	DigestPriority,
	DigestWarning,
	WeeklyDigest
} from '$lib/dashboard/weekly';
import { deadlineDisplayTitle } from '$lib/dashboard/weekly';

const DAY_MS = 86_400_000;

// Some calendar events carry their weight only in the title
// ("Project Defense (20%) and Final report (40%) due" → 60).
function weightFromTitle(title: string): number | null {
	const matches = title.match(/\d+(?:\.\d+)?%/g);
	if (!matches) return null;
	return matches.reduce((sum, match) => sum + parseFloat(match), 0);
}

function weightOf(deadline: DigestDeadline): number | null {
	return deadline.gradeWeight ?? weightFromTitle(deadline.title);
}

export type WeeklyMetric = {
	label: string;
	value: string;
	detail: string | null;
	tone: 'neutral' | 'warning';
	empty?: boolean;
};

export type TimelineDay = {
	key: string;
	weekday: string;
	dateLabel: string;
	isToday: boolean;
	deadlines: DigestDeadline[];
	crunchCount: number;
};

export type CompactPriority = DigestPriority & {
	meta: string;
};

export type WeeklyViewModel = {
	metrics: WeeklyMetric[];
	days: TimelineDay[];
	overdue: DigestDeadline[];
	priorities: CompactPriority[];
	materialWarnings: Extract<DigestWarning, { kind: 'material_index' }>[];
	briefingWarnings: Extract<DigestWarning, { kind: 'briefing' }>[];
	prerequisiteWarnings: Extract<DigestWarning, { kind: 'prerequisite' }>[];
	invalidDateWarnings: Extract<DigestWarning, { kind: 'invalid_date' }>[];
	healthCount: number;
};

function parseDateKey(key: string): Date {
	const [year, month, date] = key.split('-').map(Number);
	return new Date(year, month - 1, date);
}

function dateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, amount: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + amount);
	return next;
}

function daysFromToday(dueDate: string, now: Date): number {
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	return Math.round((parseDateKey(dueDate).getTime() - today.getTime()) / DAY_MS);
}

function priorityMeta(priority: DigestPriority): string {
	const useful = priority.factors.slice(0, 2);
	if (useful.length) return useful.join(' · ');
	if (priority.dueDate) {
		return parseDateKey(priority.dueDate).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}
	return priority.kind === 'practice' ? 'Ready to continue' : 'Needs attention';
}

function normalizeDeadline(deadline: DigestDeadline): DigestDeadline {
	// Digests stored before displayTitle existed lack the field; heal them so the
	// UI never renders an empty title. Fresh digests pass through unchanged.
	if (deadline.displayTitle) return deadline;
	return { ...deadline, displayTitle: deadlineDisplayTitle(deadline.title, deadline.typeLabel) };
}

function normalizePriority(priority: DigestPriority, deadlines: DigestDeadline[]): DigestPriority {
	if (priority.displayTitle) return priority;
	// Deadline priorities predating displayTitle can recover the specific type
	// ("Midterm") from the matching stored deadline before the next regeneration.
	if (priority.kind === 'deadline' && priority.courseCode && priority.dueDate) {
		const match = deadlines.find(
			(deadline) =>
				deadline.courseCode === priority.courseCode && deadline.dueDate === priority.dueDate
		);
		if (match) {
			return {
				...priority,
				displayTitle: deadlineDisplayTitle(priority.title, match.typeLabel)
			};
		}
	}
	return { ...priority, displayTitle: priority.title };
}

export function buildWeeklyViewModel(digest: WeeklyDigest, now = new Date()): WeeklyViewModel {
	const overdue = digest.deadlines
		.filter((deadline) => daysFromToday(deadline.dueDate, now) < 0)
		.map(normalizeDeadline);
	const upcoming = digest.deadlines
		.filter((deadline) => daysFromToday(deadline.dueDate, now) >= 0)
		.map(normalizeDeadline);
	const knownWeight = digest.deadlines.reduce(
		(sum, deadline) => sum + (weightOf(deadline) ?? 0),
		0
	);
	const hasKnownWeight = digest.deadlines.some((deadline) => weightOf(deadline) != null);
	const focusCourses = new Set(
		[
			...digest.deadlines.map((deadline) => deadline.courseId ?? deadline.courseCode),
			...digest.priorities.map((priority) => priority.courseCode)
		].filter((value): value is string => !!value)
	);

	const metrics: WeeklyMetric[] = [
		{
			label: 'Deadlines',
			value: String(digest.deadlines.length),
			detail: overdue.length ? `${overdue.length} overdue` : 'This week',
			tone: overdue.length ? 'warning' : 'neutral'
		},
		{
			label: 'Known weight',
			value: hasKnownWeight ? `${knownWeight}%` : '—',
			detail: hasKnownWeight ? 'Across listed work' : 'Not provided',
			tone: 'neutral',
			empty: !hasKnownWeight
		},
		{
			label: 'Courses in focus',
			value: String(focusCourses.size),
			detail: focusCourses.size === 1 ? 'Course' : 'Courses',
			tone: 'neutral'
		},
		{
			label: 'Study gaps',
			value: String(digest.studyGaps.length),
			detail: digest.studyGaps.length ? 'Need attention' : 'All covered',
			tone: digest.studyGaps.length ? 'warning' : 'neutral'
		}
	];

	const start = parseDateKey(digest.weekStart);
	const todayKey = dateKey(now);
	const days: TimelineDay[] = Array.from({ length: 7 }, (_, index) => {
		const date = addDays(start, index);
		const key = dateKey(date);
		return {
			key,
			weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
			dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
			isToday: key === todayKey,
			deadlines: upcoming.filter((deadline) => deadline.dueDate === key),
			crunchCount: digest.crunchWindows.filter(
				(window) => key >= window.startDate && key <= window.endDate
			).length
		};
	});

	const materialWarnings = digest.warnings.filter(
		(warning): warning is Extract<DigestWarning, { kind: 'material_index' }> =>
			warning.kind === 'material_index'
	);
	const briefingWarnings = digest.warnings.filter(
		(warning): warning is Extract<DigestWarning, { kind: 'briefing' }> =>
			warning.kind === 'briefing'
	);
	const prerequisiteWarnings = digest.warnings.filter(
		(warning): warning is Extract<DigestWarning, { kind: 'prerequisite' }> =>
			warning.kind === 'prerequisite'
	);
	const invalidDateWarnings = digest.warnings.filter(
		(warning): warning is Extract<DigestWarning, { kind: 'invalid_date' }> =>
			warning.kind === 'invalid_date'
	);

	return {
		metrics,
		days,
		overdue,
		priorities: digest.priorities.map((priority) => ({
			...normalizePriority(priority, digest.deadlines),
			meta: priorityMeta(priority)
		})),
		materialWarnings,
		briefingWarnings,
		prerequisiteWarnings,
		invalidDateWarnings,
		healthCount:
			overdue.length +
			materialWarnings.length +
			briefingWarnings.length +
			prerequisiteWarnings.length +
			invalidDateWarnings.length
	};
}

export const weeklyViewModelInternals = {
	parseDateKey,
	daysFromToday,
	priorityMeta,
	DAY_MS
};
