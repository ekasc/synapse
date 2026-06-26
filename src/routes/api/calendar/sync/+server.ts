import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import {
	getGoogleToken,
	getCourses,
	getSyllabusImport,
	getGoogleSyncedEvents,
	saveGoogleSyncedEvent,
	removeGoogleSyncedEvent,
} from '$lib/server/store';
import {
	getValidAccessToken,
	createEvent,
	updateEvent,
	deleteEvent,
	listEvents,
} from '$lib/server/google/calendar';
import type { SyllabusImport } from '$lib/server/store';

// ── Helpers ──

type Deadline = {
	id: string;
	label: string;
	date: string; // e.g. 'Sep 27' or 'Dec 12'
	type: 'quiz' | 'exam' | 'deadline';
	courseCode: string;
	courseName: string;
	needsReview?: boolean;
};

function parseDeadlineDate(dateStr: string): Date | null {
	// Accept formats like "Sep 27", "Dec 12", or full ISO dates
	const trimmed = dateStr.trim();
	// Try parsing as "Mon DD" — assume current year
	const shortMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
	if (shortMatch) {
		const month = new Date(`${shortMatch[1]} 1, 2000`).getMonth();
		const day = parseInt(shortMatch[2], 10);
		if (!isNaN(month) && !isNaN(day)) {
			const now = new Date();
			const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
			return new Date(year, month, day);
		}
	}
	// Try full ISO
	const iso = new Date(trimmed);
	if (!isNaN(iso.getTime())) return iso;
	return null;
}

function formatDateForCalendar(date: Date, isAllDay = true): { date?: string; dateTime?: string; timeZone?: string } {
	if (isAllDay) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return { date: `${y}-${m}-${d}` };
	}
	return { dateTime: date.toISOString(), timeZone: 'America/Vancouver' };
}

function extractDeadlines(syllabus: SyllabusImport): Deadline[] {
	const { extractedData, courseId } = syllabus;
	// Find course info
	const courses = getCourses();
	const course = courses.find((c) => c.id === courseId);
	const code = course?.code ?? courseId;
	const name = course?.name ?? courseId;

	return (extractedData.dates ?? []).map((d, idx) => ({
		id: `${courseId}-${d.label}-${idx}`,
		label: d.label,
		date: d.date,
		type: d.type,
		courseCode: code,
		courseName: name,
		needsReview: d.needsReview,
	}));
}

// ── Sync Handler ──

export async function POST(event: RequestEvent) {
	const stored = getGoogleToken();
	if (!stored) {
		return json({ ok: false, error: 'Google Calendar not connected' }, { status: 400 });
	}

	try {
		const accessToken = await getValidAccessToken(stored.token);

		// 1. Gather all deadlines from syllabus imports
		const courses = getCourses();
		const deadlines: Deadline[] = [];

		for (const course of courses) {
			const syllabus = getSyllabusImport(); // In a real multi-course setup, we'd have per-course syllabus
			if (syllabus && syllabus.extractedData.dates && syllabus.extractedData.dates.length > 0) {
				// Check if this syllabus belongs to this course
				if (syllabus.courseId === course.id) {
					deadlines.push(...extractDeadlines(syllabus));
				}
			}
		}

		if (deadlines.length === 0) {
			return json({ ok: true, synced: 0, total: 0, message: 'No deadlines to sync' });
		}

		// 2. Get existing synced events to know what needs update vs create
		const syncedEvents = getGoogleSyncedEvents();
		const syncedMap = new Map(syncedEvents.map((s) => [s.id, s]));

		let created = 0;
		let updated = 0;
		let deleted = 0;

		// 3. Process each deadline
		for (const dl of deadlines) {
			const parsed = parseDeadlineDate(dl.date);
			if (!parsed) continue;

			const existing = syncedMap.get(dl.id);
			const eventBody = {
				summary: `[${dl.courseCode}] ${dl.label}`,
				description: `${dl.courseName}\nType: ${dl.type}\nSynced from Synapse`,
				start: formatDateForCalendar(parsed, true),
				end: formatDateForCalendar(new Date(parsed.getTime() + 86400000), true), // next day for all-day
				...(dl.needsReview ? { colorId: '11' } : { colorId: '2' }), // 11=red (review), 2=green
				extendedProperties: {
					private: {
						synapseDeadlineId: dl.id,
						synapseCourse: dl.courseCode,
						synapseType: dl.type,
					},
				},
			};

			if (existing) {
				try {
					await updateEvent(accessToken, existing.googleEventId, eventBody, stored.calendarId);
					updated++;
				} catch {
					// Event might have been deleted externally — recreate
					try {
						const createdEvt = await createEvent(accessToken, eventBody, stored.calendarId);
						saveGoogleSyncedEvent({
							id: dl.id,
							googleEventId: createdEvt.id,
							calendarId: stored.calendarId,
							lastSyncedAt: new Date().toISOString(),
						});
						created++;
					} catch (err) {
						console.error(`Failed to recreate event ${dl.id}:`, err);
					}
				}
			} else {
				try {
					const createdEvt = await createEvent(accessToken, eventBody, stored.calendarId);
					saveGoogleSyncedEvent({
						id: dl.id,
						googleEventId: createdEvt.id,
						calendarId: stored.calendarId,
						lastSyncedAt: new Date().toISOString(),
					});
					created++;
				} catch (err) {
					console.error(`Failed to create event ${dl.id}:`, err);
				}
			}
		}

		// 4. Clean up synced events for deadlines that no longer exist
		const currentIds = new Set(deadlines.map((d) => d.id));
		const syncedIds = syncedEvents.map((s) => s.id);
		for (const sid of syncedIds) {
			if (!currentIds.has(sid)) {
				const synced = syncedMap.get(sid)!;
				try {
					await deleteEvent(accessToken, synced.googleEventId, stored.calendarId);
				} catch {
					// Ignore delete errors
				}
				removeGoogleSyncedEvent(sid);
				deleted++;
			}
		}

		return json({
			ok: true,
			created,
			updated,
			deleted,
			total: deadlines.length,
		});
	} catch (err) {
		console.error('Sync error:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ ok: false, error: message }, { status: 500 });
	}
}
