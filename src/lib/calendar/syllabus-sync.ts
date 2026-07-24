export type ParsedSyllabusDate = { month: number; day: number; year?: number };

export type ExtractedSyllabusDate = {
	label: string;
	date: string;
	type: string;
	needsReview?: boolean;
};

export type PreparedSyllabusEvent = {
	title: string;
	type: string;
	date: number;
	month: number;
	year: number;
	fingerprint: string;
};

export type SyllabusEventPreparation = {
	events: PreparedSyllabusEvent[];
	skippedOld: number;
	skippedDuplicate: number;
	invalid: number;
};

const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11
};

function validDate(year: number, month: number, day: number): boolean {
	const date = new Date(year, month, day);
	return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

export function parseSyllabusCalendarDate(value: string): ParsedSyllabusDate | null {
	const text = value.trim();
	const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (iso) {
		const year = Number(iso[1]);
		const month = Number(iso[2]) - 1;
		const day = Number(iso[3]);
		return validDate(year, month, day) ? { year, month, day } : null;
	}

	const named = text.match(/^([a-zA-Z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
	if (!named) return null;
	const month = MONTHS[named[1].toLowerCase().slice(0, 3)];
	const day = Number(named[2]);
	const year = named[3] ? Number(named[3]) : undefined;
	if (month === undefined || !validDate(year ?? 2000, month, day)) return null;
	return year === undefined ? { month, day } : { year, month, day };
}

export function normalizeSyllabusEventTitle(value: string): string {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase('en-US')
		.replace(/[‐-―]/g, '-')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

export function syllabusEventFingerprint(input: {
	courseId: string;
	title: string;
	type: string;
	year: number;
	month: number;
	date: number;
	time?: string | null;
}): string {
	return [
		input.courseId,
		normalizeSyllabusEventTitle(input.title),
		input.type.trim().toLowerCase(),
		`${input.year}-${String(input.month + 1).padStart(2, '0')}-${String(input.date).padStart(2, '0')}`,
		input.time?.trim() ?? ''
	].join('|');
}

function calendarDate(year: number, month: number, date: number): Date {
	return new Date(year, month, date);
}

export function prepareSyllabusEvents(input: {
	courseId: string;
	semesterYear: number;
	rows: ExtractedSyllabusDate[];
	now?: Date;
	toCalendarType: (syllabusType: string, label: string) => string;
}): SyllabusEventPreparation {
	const now = input.now ?? new Date();
	const today = calendarDate(now.getFullYear(), now.getMonth(), now.getDate());
	const events: PreparedSyllabusEvent[] = [];
	const seen = new Set<string>();
	let skippedOld = 0;
	let skippedDuplicate = 0;
	let invalid = 0;

	for (const row of input.rows) {
		const parsed = parseSyllabusCalendarDate(row.date);
		if (!parsed) {
			invalid++;
			continue;
		}
		const year = parsed.year ?? input.semesterYear;
		const due = calendarDate(year, parsed.month, parsed.day);
		if (due.getTime() < today.getTime()) {
			skippedOld++;
			continue;
		}
		const type = input.toCalendarType(row.type, row.label);
		const fingerprint = syllabusEventFingerprint({
			courseId: input.courseId,
			title: row.label,
			type,
			year,
			month: parsed.month,
			date: parsed.day
		});
		if (seen.has(fingerprint)) {
			skippedDuplicate++;
			continue;
		}
		seen.add(fingerprint);
		events.push({
			title: row.label.trim(),
			type,
			date: parsed.day,
			month: parsed.month,
			year,
			fingerprint
		});
	}

	return { events, skippedOld, skippedDuplicate, invalid };
}
