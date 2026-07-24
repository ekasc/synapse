import type {
	DigestDeadline,
	DigestPriority,
	DigestWarning,
	WeeklyDigest
} from '$lib/dashboard/weekly';

const DAY_MS = 86_400_000;

export type WeeklyMetric = {
	label: string;
	value: string;
	detail: string | null;
	tone: 'neutral' | 'warning';
};

export type TimelineDay = {
	key: string;
	weekday: string;
	dateLabel: string;
	isToday: boolean;
	deadlines: DigestDeadline[];
	crunchCount: number;
};

export type NextUp =
	| { kind: 'deadline'; deadline: DigestDeadline; status: string }
	| { kind: 'priority'; priority: DigestPriority; status: string };

export type CompactPriority = DigestPriority & {
	kindLabel: string;
	meta: string;
};

export type WeeklyViewModel = {
	metrics: WeeklyMetric[];
	nextUp: NextUp | null;
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

function shortDeadlineStatus(deadline: DigestDeadline, now: Date): string {
	const daysUntil = daysFromToday(deadline.dueDate, now);
	if (daysUntil < 0) {
		const days = Math.abs(daysUntil);
		return `Overdue by ${days} day${days === 1 ? '' : 's'}`;
	}
	if (daysUntil === 0) return 'Due today';
	if (daysUntil === 1) return 'Due tomorrow';
	return `Due in ${daysUntil} days`;
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

export function buildWeeklyViewModel(digest: WeeklyDigest, now = new Date()): WeeklyViewModel {
	const overdue = digest.deadlines.filter((deadline) => daysFromToday(deadline.dueDate, now) < 0);
	const upcoming = digest.deadlines.filter((deadline) => daysFromToday(deadline.dueDate, now) >= 0);
	const knownWeight = digest.deadlines.reduce(
		(sum, deadline) => sum + (deadline.gradeWeight ?? 0),
		0
	);
	const hasKnownWeight = digest.deadlines.some((deadline) => deadline.gradeWeight != null);
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
			tone: 'neutral'
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

	const firstDeadline = overdue[0] ?? upcoming[0];
	const nextUp: NextUp | null = firstDeadline
		? { kind: 'deadline', deadline: firstDeadline, status: shortDeadlineStatus(firstDeadline, now) }
		: digest.priorities[0]
			? {
					kind: 'priority',
					priority: digest.priorities[0],
					status: priorityMeta(digest.priorities[0])
				}
			: null;

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
		nextUp,
		days,
		overdue,
		priorities: digest.priorities.map((priority) => ({
			...priority,
			kindLabel:
				priority.kind === 'deadline'
					? 'Deadline'
					: priority.kind === 'practice'
						? 'Practice'
						: 'Materials',
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
	shortDeadlineStatus,
	priorityMeta,
	DAY_MS
};
