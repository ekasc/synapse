import {
	getCourses,
	getSyllabusImport,
	getGoogleToken,
	getGoogleSyncedEvents,
} from '$lib/server/store';
import {
	getValidAccessToken,
	listEvents as listGoogleEvents,
} from '$lib/server/google/calendar';
import type { GoogleCalendarEvent } from '$lib/server/google/calendar';
import type { SyllabusImport } from '$lib/server/store';

// ── Types ──

type CalendarEvent = {
	id: string;
	date: number; // day of month (1-31)
	month: number; // 0-11
	year: number;
	title: string;
	course: string;
	type: 'assignment' | 'midterm' | 'final' | 'quiz' | 'lecture' | 'google';
	time?: string;
	googleLink?: string;
};

type CourseColor = {
	code: string;
	color: string;
	name: string;
};

// ── Helpers ──

function parseShortDate(dateStr: string): { month: number; day: number } | null {
	const trimmed = dateStr.trim();
	const match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
	if (!match) return null;

	const months: Record<string, number> = {
		jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
		jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
	};

	const monthName = match[1].toLowerCase().slice(0, 3);
	const month = months[monthName];
	const day = parseInt(match[2], 10);
	if (month === undefined || isNaN(day)) return null;

	return { month, day };
}

function resolveYear(month: number): number {
	const now = new Date();
	const currentMonth = now.getMonth();
	return month < currentMonth ? now.getFullYear() + 1 : now.getFullYear();
}

function typeFromSyllabusType(st: string): CalendarEvent['type'] {
	const lower = st.toLowerCase();
	if (lower === 'quiz') return 'quiz';
	if (lower === 'exam' || lower === 'midterm') return 'midterm';
	if (lower === 'final') return 'final';
	if (lower === 'assignment' || lower === 'deadline') return 'assignment';
	return 'lecture';
}

function extractEventsFromSyllabus(syllabus: SyllabusImport, codes: string[]): CalendarEvent[] {
	return (syllabus.extractedData.dates ?? []).map((d, idx) => {
		const parsed = parseShortDate(d.date);
		if (!parsed) return null;
		const year = resolveYear(parsed.month);
		const code = codes.find((c) => c === syllabus.courseId || c.toUpperCase() === syllabus.courseId.toUpperCase());
		const ev: CalendarEvent = {
			id: `${syllabus.courseId}-${d.label}-${idx}`,
			date: parsed.day,
			month: parsed.month,
			year,
			title: d.label,
			course: code ?? syllabus.courseId,
			type: typeFromSyllabusType(d.type),
		};
		return ev;
	}).filter((e): e is CalendarEvent => e !== null);
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function extractGoogleEventDate(event: GoogleCalendarEvent): { year: number; month: number; day: number } | null {
	const dateStr = event.start?.date ?? event.start?.dateTime ?? '';
	const match = dateStr.match(DATE_ONLY_RE);
	if (match) {
		return {
			year: parseInt(match[1], 10),
			month: parseInt(match[2], 10) - 1,
			day: parseInt(match[3], 10),
		};
	}
	const d = new Date(dateStr);
	if (!isNaN(d.getTime())) {
		return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
	}
	return null;
}

// ── Loader ──

export async function load() {
	const courses = getCourses();
	const courseCodes = courses.map((c) => c.code);

	const syllabus = getSyllabusImport();
	const internalEvents: CalendarEvent[] = syllabus
		? extractEventsFromSyllabus(syllabus, courseCodes)
		: [];

	let googleEvents: CalendarEvent[] = [];
	const stored = getGoogleToken();
	if (stored) {
		try {
			const accessToken = await getValidAccessToken(stored.token);
			const rawEvents = await listGoogleEvents(accessToken, stored.calendarId, {
				timeMin: new Date(new Date().getFullYear(), 0, 1).toISOString(),
				timeMax: new Date(new Date().getFullYear() + 1, 11, 31).toISOString(),
				maxResults: 100,
			});

			googleEvents = rawEvents
				.map((evt): CalendarEvent | null => {
					const parsed = extractGoogleEventDate(evt);
					if (!parsed) return null;
					if (evt.extendedProperties?.private?.synapseDeadlineId) return null;

					return {
						id: `google-${evt.id}`,
						date: parsed.day,
						month: parsed.month,
						year: parsed.year,
						title: evt.summary || '(No title)',
						course: 'Google',
						type: 'google' as const,
						time: evt.start?.dateTime
							? new Date(evt.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
							: undefined,
						googleLink: evt.htmlLink,
					};
				})
				.filter((e): e is CalendarEvent => e !== null);
		} catch (err) {
			console.error('Failed to fetch Google Calendar events:', err);
		}
	}

	const events = [...internalEvents, ...googleEvents];

	const googleConnected = !!stored;
	const syncedCount = stored ? getGoogleSyncedEvents().length : 0;
	const courseColors: CourseColor[] = courses.map((c) => ({
		code: c.code,
		color: c.color ?? '#1a1814',
		name: c.name,
	}));

	return { events, courseColors, googleConnected, syncedCount };
}
